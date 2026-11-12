'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db';
import { pegawaiDariSesi, catatAudit, hashPassword } from '@/lib/auth';
import crypto from 'node:crypto';
import { boleh, SEMUA_PERAN } from '@/lib/sip/akses';
import { validasiDataFisikPegawai } from '@/lib/sip/data-fisik';
import { cakupanCabangUntukPegawai } from '@/lib/sip/cakupan-cabang-server';
import { kumpulkanTurunan } from '@/lib/sip/hierarki';
import { hitungBMI, kategoriBMI } from '@/lib/sip/kesehatan';

export type HasilImpor = {
  error?: string;
  sukses?: boolean;
  ringkasan?: {
    total: number;
    berhasil: number;
    gagal: number;
    detail: { baris: number; nip: string; nama: string; status: string }[];
  };
};

/** Hanya admin yang boleh mengelola pegawai. */
async function pastikanAdmin() {
  const saya = await pegawaiDariSesi();
  if (!saya) return { error: 'Sesi habis. Silakan masuk kembali.' as const };
  if (!boleh(saya.role, 'kelola_pegawai') && saya.role !== 'SUPERVISOR') return { error: 'Peran Anda tidak boleh mengubah data pegawai.' };
  return { saya };
}

async function cabangDalamCakupanSupervisor(saya: { role: string; cabang: { id: string } }, cabangId: string): Promise<boolean> {
  if (saya.role !== 'SUPERVISOR') return false;
  const semua = await prisma.cabang.findMany({ select: { id: true, indukId: true } });
  return kumpulkanTurunan(saya.cabang.id, semua).includes(cabangId);
}

/** Buat password awal acak yang mudah dibaca tapi tetap kuat. */
function passwordAwal(): string {
  const kata = ['Biru', 'Merah', 'Hijau', 'Kuning', 'Putih', 'Emas', 'Perak', 'Baja'];
  const k = kata[crypto.randomInt(kata.length)];
  const n = crypto.randomInt(1000, 9999);
  const s = String.fromCharCode(65 + crypto.randomInt(26));
  return `${k}${n}${s}!`;
}

/**
 * Impor pegawai dari data CSV/teks yang di-paste atau dibaca dari file.
 * Format kolom: NIP, Nama, KodeCabang, KodeJabatan, Role
 * Pemisah: koma, titik koma, atau TAB.
 */
export async function imporPegawai(
  _sebelumnya: HasilImpor,
  formData: FormData
): Promise<HasilImpor> {
  const cek = await pastikanAdmin();
  if ('error' in cek) return { error: cek.error };
  const saya = cek.saya;
  if (saya.role !== 'ADMIN') return { error: 'Hanya Admin yang boleh mengimpor pegawai.' };

  const teks = String(formData.get('data') ?? '').trim();
  if (!teks) return { error: 'Data kosong. Tempelkan data atau pilih file CSV.' };

  const baris = teks
    .split(/\r?\n/)
    .map((b) => b.trim())
    .filter(Boolean);

  if (baris.length < 2) {
    return { error: 'Data minimal harus punya 1 baris judul dan 1 baris isi.' };
  }

  // deteksi pemisah
  const kepala = baris[0];
  const pemisah = kepala.includes('\t') ? '\t' : kepala.includes(';') ? ';' : ',';

  const kolom = kepala.split(pemisah).map((k) => k.trim().toLowerCase());
  const idx = {
    nip: kolom.findIndex((k) => k.includes('nip')),
    nama: kolom.findIndex((k) => k.includes('nama')),
    cabang: kolom.findIndex((k) => k.includes('cabang')),
    jabatan: kolom.findIndex((k) => k.includes('jabatan')),
    role: kolom.findIndex((k) => k.includes('role') || k.includes('peran')),
  };

  if (idx.nip < 0 || idx.nama < 0) {
    return {
      error:
        'Kolom NIP dan Nama wajib ada di baris judul. Contoh: NIP,Nama,Cabang,Jabatan,Role',
    };
  }

  // siapkan peta cabang & jabatan
  const cabangSemua = await prisma.cabang.findMany();
  const jabatanSemua = await prisma.jabatan.findMany();
  const cabangMap = new Map(cabangSemua.map((c) => [c.kode.toLowerCase(), c]));
  const jabatanMap = new Map(jabatanSemua.map((j) => [j.kode.toLowerCase(), j]));

  const detail: HasilImpor['ringkasan'] extends undefined
    ? never
    : { baris: number; nip: string; nama: string; status: string }[] = [];
  let berhasil = 0;
  let gagal = 0;

  const roleSah = new Set<string>(SEMUA_PERAN);

  for (let i = 1; i < baris.length; i++) {
    const sel = baris[i].split(pemisah).map((s) => s.trim());
    const nip = sel[idx.nip] ?? '';
    const nama = sel[idx.nama] ?? '';

    if (!nip || !nama) {
      gagal++;
      detail.push({ baris: i + 1, nip: nip || '(kosong)', nama: nama || '(kosong)', status: 'NIP/Nama kosong' });
      continue;
    }

    // cabang: pakai yang ada, atau buat baru kalau diberi "KODE|Nama"
    const kodeCabangRaw = idx.cabang >= 0 ? (sel[idx.cabang] ?? '') : '';
    let cabangId: string | null = null;
    if (kodeCabangRaw) {
      const [kode, namaCabang] = kodeCabangRaw.split('|').map((x) => x.trim());
      const ada = cabangMap.get(kode.toLowerCase());
      if (ada) {
        cabangId = ada.id;
      } else {
        const baru = await prisma.cabang.create({
          data: { kode, nama: namaCabang || kode },
        });
        cabangMap.set(kode.toLowerCase(), baru);
        cabangId = baru.id;
      }
    } else {
      // pakai cabang yang sudah ada sebagai default
      cabangId = cabangSemua[0]?.id ?? null;
    }
    if (!cabangId) {
      gagal++;
      detail.push({ baris: i + 1, nip, nama, status: 'Tidak ada cabang' });
      continue;
    }

    const kodeJabatanRaw = idx.jabatan >= 0 ? (sel[idx.jabatan] ?? '') : '';
    const jabatanId = kodeJabatanRaw
      ? (jabatanMap.get(kodeJabatanRaw.toLowerCase())?.id ?? null)
      : null;

    const roleRaw = (idx.role >= 0 ? (sel[idx.role] ?? '') : '').toUpperCase();
    const role = roleSah.has(roleRaw) ? (roleRaw as 'PEGAWAI' | 'SUPERVISOR' | 'MANAGER' | 'ADMIN') : 'PEGAWAI';

    const pw = passwordAwal();
    try {
      const ada = await prisma.pegawai.findUnique({ where: { nip } });
      if (ada) {
        await prisma.pegawai.update({
          where: { nip },
          data: { nama, cabangId, jabatanId, role, aktif: true },
        });
        gagal++;
        detail.push({ baris: i + 1, nip, nama, status: 'NIP sudah ada — data diperbarui, password tidak diubah' });
      } else {
        await prisma.pegawai.create({
          data: {
            nip,
            nama,
            passwordHash: await hashPassword(pw),
            role,
            harusGantiPassword: true,
            cabangId,
            jabatanId,
          },
        });
        berhasil++;
        detail.push({ baris: i + 1, nip, nama, status: `Berhasil — password awal: ${pw}` });
      }
    } catch (e) {
      gagal++;
      detail.push({
        baris: i + 1,
        nip,
        nama,
        status: `Gagal: ${e instanceof Error ? e.message.slice(0, 60) : 'tidak diketahui'}`,
      });
    }
  }

  await catatAudit({
    pegawaiId: saya.id,
    aksi: 'IMPOR_PEGAWAI',
    entitas: 'Pegawai',
    dataBaru: { total: baris.length - 1, berhasil, gagal },
  });

  revalidatePath('/pegawai');
  revalidatePath('/dasbor');

  return {
    sukses: true,
    ringkasan: { total: baris.length - 1, berhasil, gagal, detail },
  };
}

/** Admin mereset password pegawai. Mengembalikan password baru sekali saja. */
export async function resetPassword(
  _sebelumnya: { error?: string; sukses?: boolean; password?: string; nama?: string },
  formData: FormData
): Promise<{ error?: string; sukses?: boolean; password?: string; nama?: string }> {
  const cek = await pastikanAdmin();
  if ('error' in cek) return { error: cek.error };
  const saya = cek.saya;
  if (saya.role !== 'ADMIN') return { error: 'Hanya Admin yang boleh mereset password.' };

  const pegawaiId = String(formData.get('pegawaiId') ?? '');
  const target = await prisma.pegawai.findUnique({ where: { id: pegawaiId } });
  if (!target) return { error: 'Pegawai tidak ditemukan.' };

  const pw = passwordAwal();
  await prisma.pegawai.update({
    where: { id: pegawaiId },
    data: {
      passwordHash: await hashPassword(pw),
      harusGantiPassword: true,
    },
  });

  // cabut semua sesi aktif pegawai tersebut
  await prisma.sesi.updateMany({
    where: { pegawaiId, revokedAt: null },
    data: { revokedAt: new Date() },
  });

  await catatAudit({
    pegawaiId: saya.id,
    aksi: 'RESET_PASSWORD_PEGAWAI',
    entitas: 'Pegawai',
    entitasId: pegawaiId,
    dataBaru: { nip: target.nip },
  });

  return { sukses: true, password: pw, nama: target.nama };
}

/** Aktifkan / nonaktifkan akun pegawai. */
export async function ubahStatusAktif(
  _sebelumnya: { error?: string; sukses?: boolean; pesan?: string },
  formData: FormData
): Promise<{ error?: string; sukses?: boolean; pesan?: string }> {
  const cek = await pastikanAdmin();
  if ('error' in cek) return { error: cek.error };
  const saya = cek.saya;
  if (saya.role !== 'ADMIN') return { error: 'Hanya Admin yang boleh mengubah status akun.' };

  const pegawaiId = String(formData.get('pegawaiId') ?? '');
  const target = await prisma.pegawai.findUnique({ where: { id: pegawaiId } });
  if (!target) return { error: 'Pegawai tidak ditemukan.' };
  if (target.id === saya.id) return { error: 'Anda tidak dapat menonaktifkan akun sendiri.' };

  const baru = !target.aktif;
  await prisma.pegawai.update({ where: { id: pegawaiId }, data: { aktif: baru } });

  if (!baru) {
    await prisma.sesi.updateMany({
      where: { pegawaiId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  await catatAudit({
    pegawaiId: saya.id,
    aksi: baru ? 'AKTIFKAN_PEGAWAI' : 'NONAKTIFKAN_PEGAWAI',
    entitas: 'Pegawai',
    entitasId: pegawaiId,
  });

  revalidatePath('/pegawai');
  return { sukses: true, pesan: `${target.nama} kini ${baru ? 'aktif' : 'nonaktif'}.` };
}

/** Tambah satu pegawai manual. */
export async function tambahPegawai(
  _sebelumnya: { error?: string; sukses?: boolean; password?: string; pesan?: string },
  formData: FormData
): Promise<{ error?: string; sukses?: boolean; password?: string; pesan?: string }> {
  const cek = await pastikanAdmin();
  if ('error' in cek) return { error: cek.error };
  const saya = cek.saya;
  if (saya.role !== 'ADMIN') return { error: 'Hanya Admin yang boleh menambah pegawai.' };
  const nip = String(formData.get('nip') ?? '').trim();
  const nama = String(formData.get('nama') ?? '').trim();
  const cabangId = String(formData.get('cabangId') ?? '');
  const jabatanId = String(formData.get('jabatanId') ?? '') || null;
  const roleRaw = String(formData.get('role') ?? 'PEGAWAI').toUpperCase();
  const role = (SEMUA_PERAN as readonly string[]).includes(roleRaw)
    ? (roleRaw as (typeof SEMUA_PERAN)[number])
    : 'PEGAWAI';
  const tanggalLahirRaw = String(formData.get('tanggalLahir') ?? '').trim();
  const tinggiBadanRaw = String(formData.get('tinggiBadan') ?? '').trim();
  const beratBadanRaw = String(formData.get('beratBadan') ?? '').trim();
  const errorDataFisik = validasiDataFisikPegawai(role, tanggalLahirRaw, tinggiBadanRaw);
  if (errorDataFisik) return { error: errorDataFisik };
  const beratBadan = Number(beratBadanRaw);
  if (role === 'PEGAWAI' && (!Number.isFinite(beratBadan) || beratBadan <= 0)) return { error: 'Berat badan awal wajib diisi untuk peran Pegawai.' };

  if (!nip || !nama) return { error: 'NIP dan Nama wajib diisi.' };
  if (!cabangId) return { error: 'Cabang wajib dipilih.' };

  const ada = await prisma.pegawai.findUnique({ where: { nip } });
  if (ada) return { error: `NIP ${nip} sudah terdaftar.` };

  const pw = passwordAwal();
  const dibuat = await prisma.pegawai.create({
    data: {
      nip,
      nama,
      passwordHash: await hashPassword(pw),
      role,
      harusGantiPassword: true,
      cabangId,
      jabatanId,
      tanggalLahir: tanggalLahirRaw ? new Date(`${tanggalLahirRaw}T00:00:00.000Z`) : null,
      tinggiBadan: tinggiBadanRaw ? Number(tinggiBadanRaw) : null,
      beratBadan: role === 'PEGAWAI' ? beratBadan : null,
    },
  });

  await catatAudit({
    pegawaiId: saya.id,
    aksi: 'TAMBAH_PEGAWAI',
    entitas: 'Pegawai',
    entitasId: dibuat.id,
    dataBaru: { nip, nama, role },
  });

  revalidatePath('/pegawai');
  return { sukses: true, password: pw, pesan: `${nama} berhasil ditambahkan.` };
}

export async function simpanBeratBadan(formData: FormData): Promise<void> {
  const cek = await pastikanAdmin();
  if ('error' in cek) throw new Error(cek.error);
  if (cek.saya.role !== 'ADMIN') throw new Error('Hanya Admin yang boleh mengubah berat badan.');
  const pegawaiId = String(formData.get('pegawaiId') ?? '');
  const beratRaw = String(formData.get('beratBadan') ?? '').trim();
  const berat = Number(beratRaw);
  if (!pegawaiId || !Number.isFinite(berat) || berat <= 0) throw new Error('Berat badan harus lebih besar dari 0.');
  const target = await prisma.pegawai.findUnique({ where: { id: pegawaiId, role: 'PEGAWAI' }, select: { id: true } });
  if (!target) throw new Error('Pegawai tidak ditemukan.');
  await prisma.pegawai.update({ where: { id: pegawaiId }, data: { beratBadan: berat } });
  revalidatePath('/monitoring');
}

export async function simpanPengukuranIMT(formData: FormData): Promise<void> {
  const pengukur = await pegawaiDariSesi();
  if (!pengukur) throw new Error('Sesi habis. Silakan masuk kembali.');
  if (!boleh(pengukur.role, 'isi_monitoring')) throw new Error('Hanya Supervisor yang dapat mengisi IMT.');
  const pegawaiId = String(formData.get('pegawaiId') ?? '');
  const periodeId = String(formData.get('periodeId') ?? '');
  const tanggalRaw = String(formData.get('tanggal') ?? '');
  const berat = Number(formData.get('beratBadan'));
  const lingkarPinggang = Number(formData.get('lingkarPinggang'));
  const fotoSeluruhBadanData = String(formData.get('fotoSeluruhBadanData') ?? '');
  const fotoTimbanganData = String(formData.get('fotoTimbanganData') ?? '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(tanggalRaw) || !Number.isFinite(berat) || berat <= 0 || !Number.isFinite(lingkarPinggang) || lingkarPinggang <= 0) throw new Error('Tanggal, berat badan, atau lingkar pinggang tidak valid.');
  if (!/^data:image\/(jpeg|png|webp);base64,/.test(fotoSeluruhBadanData) || !/^data:image\/(jpeg|png|webp);base64,/.test(fotoTimbanganData)) throw new Error('Foto seluruh badan dan foto alat timbang wajib diunggah.');
  if (fotoSeluruhBadanData.length > 550000 || fotoTimbanganData.length > 550000) throw new Error('Ukuran foto terlalu besar. Gunakan foto maksimal sekitar 400 KB.');
  const tanggal = new Date(`${tanggalRaw}T00:00:00.000Z`);
  const [target, periode] = await Promise.all([
    prisma.pegawai.findUnique({ where: { id: pegawaiId, role: 'PEGAWAI' }, select: { id: true, cabangId: true, tinggiBadan: true } }),
    prisma.periode.findUnique({ where: { id: periodeId }, select: { id: true, tanggalMulai: true, tanggalSelesai: true, dikunci: true } }),
  ]);
  const cakupanCabang = await cakupanCabangUntukPegawai(pengukur);
  if (!target || (cakupanCabang && !cakupanCabang.includes(target.cabangId))) throw new Error('Pegawai tidak ditemukan atau di luar cabang Anda.');
  if (!periode) throw new Error('Periode tidak ditemukan.');
  if (periode.dikunci) throw new Error('Periode sudah dikunci.');
  if (tanggal < periode.tanggalMulai || tanggal > periode.tanggalSelesai) throw new Error('Tanggal harus berada di dalam periode.');
  if (!target.tinggiBadan || target.tinggiBadan <= 0) throw new Error('Tinggi badan pegawai belum diisi.');
  const nilaiIMT = hitungBMI(berat, target.tinggiBadan)!;
  await prisma.pengukuranIMT.upsert({
    where: { pegawaiId_periodeId_tanggal: { pegawaiId, periodeId, tanggal } },
    update: { pengukurId: pengukur.id, tinggiBadan: target.tinggiBadan, beratBadan: berat, lingkarPinggang, nilaiIMT, kategori: kategoriBMI(nilaiIMT), fotoSeluruhBadanData, fotoSeluruhBadanMime: 'image/jpeg', fotoTimbanganData, fotoTimbanganMime: 'image/jpeg' },
    create: { pegawaiId, pengukurId: pengukur.id, periodeId, tanggal, tinggiBadan: target.tinggiBadan, beratBadan: berat, lingkarPinggang, nilaiIMT, kategori: kategoriBMI(nilaiIMT), fotoSeluruhBadanData, fotoSeluruhBadanMime: 'image/jpeg', fotoTimbanganData, fotoTimbanganMime: 'image/jpeg' },
  });
  revalidatePath('/monitoring');
}

// ===========================================================================
// UBAH PEGAWAI
// ===========================================================================

export async function ajukanPerubahanDataFisik(
  _sebelumnya: { error?: string; sukses?: boolean; pesan?: string },
  formData: FormData
): Promise<{ error?: string; sukses?: boolean; pesan?: string }> {
  const cek = await pastikanAdmin();
  if ('error' in cek) return { error: cek.error };
  const saya = cek.saya;
  if (saya.role !== 'SUPERVISOR') return { error: 'Hanya Supervisor yang dapat mengajukan perubahan ini.' };

  const pegawaiId = String(formData.get('id') ?? '');
  const target = await prisma.pegawai.findUnique({ where: { id: pegawaiId } });
  if (!target || target.role !== 'PEGAWAI' || !(await cabangDalamCakupanSupervisor(saya, target.cabangId))) {
    return { error: 'Supervisor hanya boleh mengubah pegawai di cabangnya sendiri.' };
  }
  const tanggalRaw = String(formData.get('tanggalLahir') ?? '').trim();
  const tinggiRaw = String(formData.get('tinggiBadan') ?? '').trim();
  const errorDataFisik = validasiDataFisikPegawai(target.role, tanggalRaw, tinggiRaw);
  if (errorDataFisik) return { error: errorDataFisik };
  const tanggal = new Date(`${tanggalRaw}T00:00:00.000Z`);
  const tinggi = Number(tinggiRaw);

  const pending = await prisma.perubahanDataPegawai.findFirst({
    where: { pegawaiId, status: 'MENUNGGU' },
  });
  if (pending) return { error: 'Masih ada perubahan data yang menunggu persetujuan admin.' };

  await prisma.perubahanDataPegawai.create({
    data: {
      pegawaiId,
      pengajuId: saya.id,
      tanggalLahirLama: target.tanggalLahir,
      tanggalLahirBaru: tanggal,
      tinggiBadanLama: target.tinggiBadan,
      tinggiBadanBaru: tinggi,
      catatanPengaju: String(formData.get('catatan') ?? '').trim() || null,
    },
  });
  await catatAudit({ pegawaiId: saya.id, aksi: 'AJUKAN_PERUBAHAN_DATA_FISIK', entitas: 'Pegawai', entitasId: pegawaiId, dataBaru: { nip: target.nip, tanggalLahir: tanggalRaw, tinggiBadan: tinggi } });
  revalidatePath('/pegawai');
  return { sukses: true, pesan: 'Perubahan diajukan dan menunggu persetujuan admin.' };
}

export async function ajukanPerubahanDataUmum(
  _sebelumnya: { error?: string; sukses?: boolean; pesan?: string },
  formData: FormData
): Promise<{ error?: string; sukses?: boolean; pesan?: string }> {
  const cek = await pastikanAdmin();
  if ('error' in cek) return { error: cek.error };
  const saya = cek.saya;
  if (saya.role !== 'SUPERVISOR') return { error: 'Hanya Supervisor yang dapat mengajukan perubahan data.' };
  const id = String(formData.get('id') ?? '');
  const target = await prisma.pegawai.findUnique({ where: { id } });
  if (!target || target.role !== 'PEGAWAI' || !(await cabangDalamCakupanSupervisor(saya, target.cabangId))) return { error: 'Supervisor hanya boleh mengubah pegawai di cabang dan KCP bawah cakupannya.' };
  const nama = String(formData.get('nama') ?? '').trim();
  const nip = String(formData.get('nip') ?? '').trim();
  const email = String(formData.get('email') ?? '').trim() || null;
  const cabangId = String(formData.get('cabangId') ?? '').trim();
  const jabatanId = String(formData.get('jabatanId') ?? '').trim() || null;
  const tanggalRaw = String(formData.get('tanggalLahir') ?? '').trim();
  const tinggiRaw = String(formData.get('tinggiBadan') ?? '').trim();
  const beratRaw = String(formData.get('beratBadan') ?? '').trim();
  if (!nama || !nip || !cabangId) return { error: 'Nama, NIP, dan cabang wajib diisi.' };
  if (!/^[A-Za-z0-9._-]+$/.test(nip) || nip.length > 30) return { error: 'NIP tidak valid.' };
  const errorFisik = validasiDataFisikPegawai(target.role, tanggalRaw, tinggiRaw);
  if (errorFisik) return { error: errorFisik };
  if (nip !== target.nip && await prisma.pegawai.findUnique({ where: { nip } })) return { error: `NIP ${nip} sudah dipakai.` };
  if (email && await prisma.pegawai.findFirst({ where: { email, id: { not: id } } })) return { error: `Email ${email} sudah dipakai.` };
  if (!await prisma.cabang.findUnique({ where: { id: cabangId } })) return { error: 'Cabang tidak ditemukan.' };
  if (jabatanId && !await prisma.jabatan.findUnique({ where: { id: jabatanId } })) return { error: 'Jabatan tidak ditemukan.' };
  const berat = Number(beratRaw);
  if (!Number.isFinite(berat) || berat <= 0) return { error: 'Berat badan awal harus lebih besar dari 0.' };
  if (await prisma.perubahanDataPegawai.findFirst({ where: { pegawaiId: id, status: 'MENUNGGU' } })) return { error: 'Masih ada perubahan yang menunggu persetujuan admin.' };
  await prisma.perubahanDataPegawai.create({ data: {
    pegawaiId: id, pengajuId: saya.id, namaLama: target.nama, namaBaru: nama, nipLama: target.nip, nipBaru: nip,
    emailLama: target.email, emailBaru: email, jabatanIdLama: target.jabatanId, jabatanIdBaru: jabatanId,
    cabangIdLama: target.cabangId, cabangIdBaru: cabangId, tanggalLahirLama: target.tanggalLahir,
    tanggalLahirBaru: new Date(`${tanggalRaw}T00:00:00.000Z`), tinggiBadanLama: target.tinggiBadan, tinggiBadanBaru: Number(tinggiRaw), beratBadanLama: target.beratBadan, beratBadanBaru: berat,
    catatanPengaju: String(formData.get('catatan') ?? '').trim() || null,
  }});
  await catatAudit({ pegawaiId: saya.id, aksi: 'AJUKAN_PERUBAHAN_DATA_PEGAWAI', entitas: 'Pegawai', entitasId: id, dataBaru: { nip, nama } });
  revalidatePath('/pegawai');
  return { sukses: true, pesan: 'Perubahan data diajukan dan menunggu persetujuan admin.' };
}

export async function setujuiPerubahanDataFisik(
  _sebelumnya: { error?: string; sukses?: boolean; pesan?: string },
  formData: FormData
): Promise<{ error?: string; sukses?: boolean; pesan?: string }> {
  const cek = await pastikanAdmin();
  if ('error' in cek || cek.saya.role !== 'ADMIN') return { error: 'Hanya Admin yang dapat menyetujui perubahan.' };
  const id = String(formData.get('perubahanId') ?? '');
  const p = await prisma.perubahanDataPegawai.findUnique({ where: { id } });
  if (!p || p.status !== 'MENUNGGU') return { error: 'Pengajuan perubahan tidak ditemukan atau sudah diputuskan.' };
  const hasil = await prisma.$transaction(async (tx) => {
    if (p.namaBaru && p.nipBaru) {
      const bentrok = await tx.pegawai.findFirst({ where: { nip: p.nipBaru, id: { not: p.pegawaiId } }, select: { id: true } });
      if (bentrok) return false;
    }
    const keputusan = await tx.perubahanDataPegawai.updateMany({
      where: { id, status: 'MENUNGGU' },
      data: { status: 'DISETUJUI', diputuskanOlehId: cek.saya.id, diputuskanAt: new Date() },
    });
    if (keputusan.count !== 1) return false;
    if (p.namaBaru && p.nipBaru) {
      const bentrok = await tx.pegawai.findFirst({ where: { nip: p.nipBaru, id: { not: p.pegawaiId } }, select: { id: true } });
      if (bentrok) return false;
    }
    await tx.pegawai.update({ where: { id: p.pegawaiId }, data: p.namaBaru ? { nama: p.namaBaru, nip: p.nipBaru ?? undefined, email: p.emailBaru, jabatanId: p.jabatanIdBaru, cabangId: p.cabangIdBaru ?? undefined, tanggalLahir: p.tanggalLahirBaru, tinggiBadan: p.tinggiBadanBaru, beratBadan: p.beratBadanBaru } : { tanggalLahir: p.tanggalLahirBaru, tinggiBadan: p.tinggiBadanBaru, beratBadan: p.beratBadanBaru } });
    return true;
  });
  if (!hasil) return { error: 'Pengajuan perubahan sudah diputuskan oleh admin lain.' };
  await catatAudit({ pegawaiId: cek.saya.id, aksi: p.namaBaru ? 'SETUJUI_PERUBAHAN_DATA_PEGAWAI' : 'SETUJUI_PERUBAHAN_DATA_FISIK', entitas: 'Pegawai', entitasId: p.pegawaiId, dataBaru: { perubahanId: id } });
  revalidatePath('/pegawai');
  return { sukses: true, pesan: 'Perubahan data disetujui.' };
}

export async function tolakPerubahanDataFisik(
  _sebelumnya: { error?: string; sukses?: boolean; pesan?: string },
  formData: FormData
): Promise<{ error?: string; sukses?: boolean; pesan?: string }> {
  const cek = await pastikanAdmin();
  if ('error' in cek || cek.saya.role !== 'ADMIN') return { error: 'Hanya Admin yang dapat menolak perubahan.' };
  const id = String(formData.get('perubahanId') ?? '');
  const alasan = String(formData.get('alasan') ?? '').trim();
  if (alasan.length < 5) return { error: 'Alasan penolakan minimal 5 karakter.' };
  const p = await prisma.perubahanDataPegawai.findUnique({ where: { id } });
  if (!p || p.status !== 'MENUNGGU') return { error: 'Pengajuan perubahan tidak ditemukan atau sudah diputuskan.' };
  const keputusan = await prisma.perubahanDataPegawai.updateMany({
    where: { id, status: 'MENUNGGU' },
    data: { status: 'DITOLAK', diputuskanOlehId: cek.saya.id, catatanAdmin: alasan, diputuskanAt: new Date() },
  });
  if (keputusan.count !== 1) return { error: 'Pengajuan perubahan sudah diputuskan oleh admin lain.' };
  revalidatePath('/pegawai');
  return { sukses: true, pesan: 'Perubahan data ditolak.' };
}

// Daftar peran sah diambil dari modul akses (SEMUA_PERAN) — SATU sumber.
// Dulu daftarnya disalin di tiga tempat dan tidak ikut diperbarui saat peran
// PENGAMAT ditambahkan, sehingga 'ubah peran ke Pengamat' ditolak dengan
// pesan 'Peran tidak valid' padahal pilihannya ada di form.
const ROLE_SAH = SEMUA_PERAN;

/**
 * Ubah data pegawai (nama, NIP, cabang, jabatan, peran, email).
 *
 * Aturan:
 * - Hanya admin.
 * - NIP boleh diubah, tapi dicek keunikan & dicatat di audit log.
 * - Perubahan peran tidak boleh membuat admin terakhir kehilangan hak admin.
 * - Menonaktifkan lewat perubahan peran tidak diizinkan; pakai tombol status.
 */
export async function ubahPegawai(
  _sebelumnya: { error?: string; sukses?: boolean; pesan?: string; nipBaru?: string },
  formData: FormData
): Promise<{ error?: string; sukses?: boolean; pesan?: string; nipBaru?: string }> {
  const cek = await pastikanAdmin();
  if ('error' in cek) return { error: cek.error };
  const saya = cek.saya;
  if (saya.role !== 'ADMIN') return { error: 'Hanya Admin yang boleh mengubah data umum pegawai.' };

  const id = String(formData.get('id') ?? '');
  const emailRaw = String(formData.get('email') ?? '').trim();
  const cabangIdInput = String(formData.get('cabangId') ?? '');
  const jabatanIdInput = String(formData.get('jabatanId') ?? '') || null;
  const roleRawInput = String(formData.get('role') ?? '').toUpperCase();

  if (!id) return { error: 'Pegawai tidak ditemukan.' };
  const lama = await prisma.pegawai.findUnique({ where: { id } });
  if (!lama) return { error: 'Pegawai tidak ditemukan.' };
  const namaFinal = String(formData.get('nama') ?? '').trim();
  const nipFinal = String(formData.get('nip') ?? '').trim();
  const cabangId = cabangIdInput;
  const jabatanId = jabatanIdInput;
  const roleRaw = roleRawInput;
  if (!namaFinal) return { error: 'Nama wajib diisi.' };
  if (!nipFinal) return { error: 'NIP wajib diisi.' };
  if (!cabangId) return { error: 'Cabang wajib dipilih.' };
  if (!/^[A-Za-z0-9._-]+$/.test(nipFinal)) {
    return { error: 'NIP hanya boleh huruf, angka, titik, garis bawah, dan tanda hubung.' };
  }
  if (nipFinal.length > 30) return { error: 'NIP maksimal 30 karakter.' };

  const role = (ROLE_SAH as readonly string[]).includes(roleRaw)
    ? (roleRaw as (typeof ROLE_SAH)[number])
    : null;
  if (!role) return { error: 'Peran tidak valid.' };
  const tanggalLahirRaw = String(formData.get('tanggalLahir') ?? '').trim();
  const tinggiBadanRaw = String(formData.get('tinggiBadan') ?? '').trim();
  const errorDataFisik = validasiDataFisikPegawai(role, tanggalLahirRaw, tinggiBadanRaw);
  if (errorDataFisik) return { error: errorDataFisik };

  const nama = namaFinal;
  const nip = nipFinal;
  // NIP harus unik
  if (nip !== lama.nip) {
    const bentrok = await prisma.pegawai.findUnique({ where: { nip } });
    if (bentrok) {
      return { error: `NIP ${nip} sudah dipakai oleh ${bentrok.nama}.` };
    }
  }

  // email harus unik juga (kalau diisi)
  const email = emailRaw || null;
  if (email) {
    const bentrokEmail = await prisma.pegawai.findFirst({
      where: { email, id: { not: id } },
    });
    if (bentrokEmail) {
      return { error: `Email ${email} sudah dipakai oleh ${bentrokEmail.nama}.` };
    }
  }

  // Jangan sampai tidak ada admin tersisa
  if (lama.role === 'ADMIN' && role !== 'ADMIN') {
    const jumlahAdmin = await prisma.pegawai.count({
      where: { role: 'ADMIN', aktif: true, id: { not: id } },
    });
    if (jumlahAdmin === 0) {
      return {
        error:
          'Ini satu-satunya akun admin yang aktif. Buat akun admin lain dulu sebelum mengubah peran akun ini.',
      };
    }
  }

  const cabang = await prisma.cabang.findUnique({ where: { id: cabangId } });
  if (!cabang) return { error: 'Cabang tidak ditemukan.' };

  await prisma.pegawai.update({
    where: { id },
    data: { nama, nip, email, cabangId, jabatanId, role,
      tanggalLahir: tanggalLahirRaw ? new Date(`${tanggalLahirRaw}T00:00:00.000Z`) : null,
      tinggiBadan: tinggiBadanRaw ? Number(tinggiBadanRaw) : null,
    },
  });

  await catatAudit({
    pegawaiId: saya.id,
    aksi: nip !== lama.nip ? 'UBAH_PEGAWAI_NIP' : 'UBAH_PEGAWAI',
    entitas: 'Pegawai',
    entitasId: id,
    dataLama: {
      nip: lama.nip,
      nama: lama.nama,
      email: lama.email,
      cabangId: lama.cabangId,
      jabatanId: lama.jabatanId,
      role: lama.role,
    },
    dataBaru: { nip, nama, email, cabangId, jabatanId, role },
  });

  revalidatePath('/pegawai');
  revalidatePath('/dasbor');

  const pesanNip =
    nip !== lama.nip
      ? `Data ${nama} diperbarui. NIP diubah dari ${lama.nip} menjadi ${nip} — pastikan pegawai diberi tahu.`
      : `Data ${nama} diperbarui.`;

  return { sukses: true, pesan: pesanNip, nipBaru: nip };
}
