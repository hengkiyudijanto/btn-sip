'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db';
import { pegawaiDariSesi, catatAudit, hashPassword } from '@/lib/auth';
import crypto from 'node:crypto';

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
  if (saya.role !== 'ADMIN') return { error: 'Hanya admin yang dapat melakukan aksi ini.' as const };
  return { saya };
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

  const roleSah = new Set(['PEGAWAI', 'SUPERVISOR', 'MANAGER', 'ADMIN']);

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

  const nip = String(formData.get('nip') ?? '').trim();
  const nama = String(formData.get('nama') ?? '').trim();
  const cabangId = String(formData.get('cabangId') ?? '');
  const jabatanId = String(formData.get('jabatanId') ?? '') || null;
  const roleRaw = String(formData.get('role') ?? 'PEGAWAI').toUpperCase();
  const roleSah = ['PEGAWAI', 'SUPERVISOR', 'MANAGER', 'ADMIN'];
  const role = roleSah.includes(roleRaw) ? (roleRaw as 'PEGAWAI' | 'SUPERVISOR' | 'MANAGER' | 'ADMIN') : 'PEGAWAI';

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

// ===========================================================================
// UBAH PEGAWAI
// ===========================================================================

const ROLE_SAH = ['PEGAWAI', 'SUPERVISOR', 'MANAGER', 'ADMIN'] as const;

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

  const id = String(formData.get('id') ?? '');
  const nama = String(formData.get('nama') ?? '').trim();
  const nip = String(formData.get('nip') ?? '').trim();
  const emailRaw = String(formData.get('email') ?? '').trim();
  const cabangId = String(formData.get('cabangId') ?? '');
  const jabatanId = String(formData.get('jabatanId') ?? '') || null;
  const roleRaw = String(formData.get('role') ?? '').toUpperCase();

  if (!id) return { error: 'Pegawai tidak ditemukan.' };
  if (!nama) return { error: 'Nama wajib diisi.' };
  if (!nip) return { error: 'NIP wajib diisi.' };
  if (!cabangId) return { error: 'Cabang wajib dipilih.' };
  if (!/^[A-Za-z0-9._-]+$/.test(nip)) {
    return { error: 'NIP hanya boleh huruf, angka, titik, garis bawah, dan tanda hubung.' };
  }
  if (nip.length > 30) return { error: 'NIP maksimal 30 karakter.' };

  const role = (ROLE_SAH as readonly string[]).includes(roleRaw)
    ? (roleRaw as (typeof ROLE_SAH)[number])
    : null;
  if (!role) return { error: 'Peran tidak valid.' };

  const lama = await prisma.pegawai.findUnique({ where: { id } });
  if (!lama) return { error: 'Pegawai tidak ditemukan.' };

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
    data: { nama, nip, email, cabangId, jabatanId, role },
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
