'use server';

/**
 * SERVER ACTION — modul konten sosmed.
 *
 * Aturan yang dipegang di sini:
 *  1. Setiap aksi memanggil `wajibKemampuan`/`bolehKonten` DULU. Menyembunyikan
 *     tombol bukan pengamanan: server action bisa dipanggil langsung via POST.
 *  2. Transisi status lewat `transisiStatus()` (fungsi murni, ada unit test) —
 *     jangan menulis perbandingan status sendiri di sini.
 *  3. Cakupan data (siapa boleh menyentuh konten siapa) ditentukan oleh
 *     kemampuan `lihat_semua_konten` + kepemilikan + jalur penyetuju, bukan
 *     oleh `role === 'MANAGER'`.
 */

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db';
import { pegawaiDariSesi, catatAudit, type PegawaiSesi } from '@/lib/auth';
import { bolehEfek, bolehKonten } from '@/lib/sosmed/akses';
import { transisiStatus, type StatusKonten } from '@/lib/sosmed/status';
import { bacaKonfigSosmed } from '@/lib/sosmed/konfig';
import { kirimKePlatform, type HasilPlatform } from '@/lib/sosmed/penerbit';

export type HasilAksi = { error?: string; sukses?: boolean; pesan?: string };

const MAKS_DATA_URL = 28 * 1024 * 1024;
/** Ambil konten + pembuatnya, sekaligus periksa hak akses dasar. */
async function ambilKonten(kontenId: string, saya: PegawaiSesi) {
  const konten = await prisma.kontenSosmed.findUnique({
    where: { id: kontenId },
    include: {
      pembuat: { select: { id: true, nama: true, nip: true, role: true, cabangId: true } },
      penyetuju: { select: { id: true, nama: true, role: true } },
    },
  });
  if (!konten) return { konten: null, error: 'Konten tidak ditemukan.' };
  return { konten, error: null };
}

/** URL publik media — dibutuhkan platform (mereka menarik sendiri berkasnya). */
function urlMedia(kontenId: string, dasar?: string) {
  const basis =
    dasar ??
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.APP_URL ??
    'http://localhost:3000';
  return `${basis.replace(/\/$/, '')}/sosmed/media/${kontenId}`;
}

// ===========================================================================
// Simpan / ubah
// ===========================================================================

/**
 * Simpan konten (draft baru atau perubahan draft/revisi).
 *
 * `penyetujuId` ikut disimpan saat DRAFT. Saat pengajuan (AJUKAN) ia dipakai
 * sebagai penentu siapa yang berhak menyetujui, lalu DIKUNCI.
 */
export async function simpanKonten(
  _sebelumnya: HasilAksi,
  formData: FormData
): Promise<HasilAksi> {
  const saya = await pegawaiDariSesi();
  if (!saya) return { error: 'Sesi habis. Silakan masuk kembali.' };
  if (!bolehEfek(saya.role, 'kelola_konten')) {
    return { error: 'Peran Anda tidak berhak membuat konten.' };
  }

  const id = String(formData.get('id') ?? '').trim();
  const judul = String(formData.get('judul') ?? '').trim();
  const caption = String(formData.get('caption') ?? '');
  const tujuan = String(formData.get('tujuan') ?? 'KEDUANYA');
  const penyetujuId = String(formData.get('penyetujuId') ?? '').trim();

  if (judul.length < 3) return { error: 'Judul internal minimal 3 karakter.' };
  if (judul.length > 120) return { error: 'Judul internal maksimal 120 karakter.' };
  if (caption.length > 2200) {
    return { error: `Caption ${caption.length} karakter, melebihi batas platform (2200).` };
  }
  if (!['TIKTOK', 'INSTAGRAM', 'KEDUANYA'].includes(tujuan)) {
    return { error: 'Platform tujuan tidak dikenal.' };
  }

  // ==== berkas ====
  const mediaData = String(formData.get('mediaData') ?? '');
  const mediaMime = String(formData.get('mediaMime') ?? '');
  const mediaByte = Number(formData.get('mediaByte') ?? 0);
  const mediaLebar = Number(formData.get('mediaLebar') ?? 0) || null;
  const mediaTinggi = Number(formData.get('mediaTinggi') ?? 0) || null;
  const durasiDetik = Number(formData.get('durasiDetik') ?? 0) || null;
  const jenisForm = String(formData.get('jenis') ?? '');

  const adaBerkasBaru = mediaData.length > 0;
  if (adaBerkasBaru) {
    if (!/^data:(image\/(jpeg|png|webp)|video\/(mp4|quicktime|webm));base64,/.test(mediaData)) {
      return { error: 'Format berkas tidak didukung. Gambar JPG/PNG/WebP atau video MP4/MOV.' };
    }
    if (mediaData.length > MAKS_DATA_URL) {
      return { error: 'Berkas terlalu besar untuk disimpan. Kompres dulu berkasnya.' };
    }
  }

  const jenis = jenisForm === 'VIDEO' || mediaMime.startsWith('video/') ? 'VIDEO' : 'GAMBAR';

  // TikTok menolak gambar — dicegah di sini, bukan setelah dikirim.
  if (jenis === 'GAMBAR' && tujuan === 'TIKTOK') {
    return {
      error:
        'TikTok hanya menerima video. Pilih tujuan "Instagram saja" atau unggah video.',
    };
  }
  if (jenis === 'GAMBAR' && mediaMime && mediaMime !== 'image/jpeg' && tujuan !== 'TIKTOK') {
    // berkas dari unggahan UI selalu sudah JPEG; ini jaring pengaman
    return { error: 'Instagram feed hanya menerima gambar JPEG.' };
  }

  // penyetuju wajib punya kemampuan menyetujui, dan bukan diri sendiri
  if (penyetujuId) {
    if (penyetujuId === saya.id) {
      return { error: 'Anda tidak dapat menunjuk diri sendiri sebagai penyetuju.' };
    }
    const calon = await prisma.pegawai.findUnique({
      where: { id: penyetujuId },
      select: { id: true, nama: true, role: true, aktif: true },
    });
    if (!calon || !calon.aktif) return { error: 'Penyetuju tidak ditemukan atau tidak aktif.' };
    if (!bolehEfek(calon.role, 'setujui_konten')) {
      return { error: `${calon.nama} tidak berhak menyetujui konten.` };
    }
  }

  if (id) {
    // ==== ubah ====
    const { konten, error } = await ambilKonten(id, saya);
    if (!konten || error) return { error: error ?? 'Konten tidak ditemukan.' };

    const hak = bolehKonten(
      {
        pembuatId: konten.pembuatId,
        penyetujuId: konten.penyetujuId,
        status: konten.status as StatusKonten,
      },
      { id: saya.id, role: saya.role },
      'ubah'
    );
    if (!hak.boleh) return { error: hak.alasan };

    await prisma.kontenSosmed.update({
      where: { id },
      data: {
        judul,
        caption,
        tujuan,
        jenis,
        penyetujuId: penyetujuId || konten.penyetujuId,
        ...(adaBerkasBaru
          ? {
              mediaData,
              mediaMime,
              mediaByte,
              mediaLebar,
              mediaTinggi,
              durasiDetik,
              mediaDilihat: 0,
            }
          : {}),
      },
    });

    await catatAudit({
      pegawaiId: saya.id,
      aksi: 'UBAH_KONTEN',
      entitas: 'KontenSosmed',
      entitasId: id,
      dataBaru: { judul, tujuan, jenis, gantiBerkas: adaBerkasBaru },
    });

    revalidatePath('/sosmed');
    revalidatePath(`/sosmed/${id}`);
    return { sukses: true, pesan: 'Konten tersimpan.' };
  }

  // ==== buat baru ====
  if (!adaBerkasBaru) {
    return { error: 'Pilih berkas gambar atau video terlebih dahulu.' };
  }

  const baru = await prisma.kontenSosmed.create({
    data: {
      judul,
      caption,
      tujuan,
      jenis,
      status: 'DRAFT',
      mediaData,
      mediaMime,
      mediaByte,
      mediaLebar,
      mediaTinggi,
      durasiDetik,
      pembuatId: saya.id,
      penyetujuId: penyetujuId || null,
    },
  });

  await prisma.keputusanKonten.create({
    data: {
      kontenId: baru.id,
      aksi: 'DIBUAT',
      olehId: saya.id,
      catatan: 'Konten dibuat sebagai draft.',
    },
  });

  await catatAudit({
    pegawaiId: saya.id,
    aksi: 'BUAT_KONTEN',
    entitas: 'KontenSosmed',
    entitasId: baru.id,
    dataBaru: { judul, jenis, tujuan },
  });

  revalidatePath('/sosmed');
  return { sukses: true, pesan: `Konten "${judul}" dibuat sebagai draft.` };
}

/** Hapus berkas media saja (konten tetap ada, jadi draft tanpa berkas). */
export async function hapusMediaKonten(
  _sebelumnya: HasilAksi,
  formData: FormData
): Promise<HasilAksi> {
  const saya = await pegawaiDariSesi();
  if (!saya) return { error: 'Sesi habis. Silakan masuk kembali.' };

  const id = String(formData.get('id') ?? '');
  const { konten, error } = await ambilKonten(id, saya);
  if (!konten || error) return { error: error ?? 'Konten tidak ditemukan.' };

  const hak = bolehKonten(
    { pembuatId: konten.pembuatId, penyetujuId: konten.penyetujuId, status: konten.status as StatusKonten },
    { id: saya.id, role: saya.role },
    'ubah'
  );
  if (!hak.boleh) return { error: hak.alasan };

  await prisma.kontenSosmed.update({
    where: { id },
    data: {
      mediaData: null,
      mediaMime: null,
      mediaByte: null,
      mediaLebar: null,
      mediaTinggi: null,
      durasiDetik: null,
    },
  });

  revalidatePath(`/sosmed/${id}`);
  return { sukses: true, pesan: 'Berkas dihapus. Unggah berkas pengganti, lalu simpan.' };
}

/** Hapus konten — hanya draft/revisi milik sendiri, atau admin. */
export async function hapusKonten(
  _sebelumnya: HasilAksi,
  formData: FormData
): Promise<HasilAksi> {
  const saya = await pegawaiDariSesi();
  if (!saya) return { error: 'Sesi habis. Silakan masuk kembali.' };

  const id = String(formData.get('id') ?? '');
  const { konten, error } = await ambilKonten(id, saya);
  if (!konten || error) return { error: error ?? 'Konten tidak ditemukan.' };

  const hak = bolehKonten(
    { pembuatId: konten.pembuatId, penyetujuId: konten.penyetujuId, status: konten.status as StatusKonten },
    { id: saya.id, role: saya.role },
    'hapus'
  );
  if (!hak.boleh) return { error: hak.alasan };

  await prisma.kontenSosmed.delete({ where: { id } });

  await catatAudit({
    pegawaiId: saya.id,
    aksi: 'HAPUS_KONTEN',
    entitas: 'KontenSosmed',
    entitasId: id,
    dataLama: { judul: konten.judul, status: konten.status },
  });

  revalidatePath('/sosmed');
  return { sukses: true, pesan: `Konten "${konten.judul}" dihapus.` };
}

// ===========================================================================
// Alur persetujuan — satu pintu untuk semua transisi status
// ===========================================================================

/**
 * Menjalankan satu transisi status. Semua aksi approval (ajukan, setujui,
 * minta revisi, tarik, jadwalkan, arsip) lewat sini supaya aturannya hanya
 * hidup di `transisiStatus()`.
 */
export async function ubahStatusKonten(
  _sebelumnya: HasilAksi,
  formData: FormData
): Promise<HasilAksi> {
  const saya = await pegawaiDariSesi();
  if (!saya) return { error: 'Sesi habis. Silakan masuk kembali.' };

  const id = String(formData.get('id') ?? '');
  const aksi = String(formData.get('aksi') ?? '');
  const catatan = String(formData.get('catatan') ?? '').trim();
  const jadwalMentah = String(formData.get('jadwalAt') ?? '').trim();

  const { konten, error } = await ambilKonten(id, saya);
  if (!konten || error) return { error: error ?? 'Konten tidak ditemukan.' };

  const status = konten.status as StatusKonten;
  const pemilik = konten.pembuatId === saya.id;

  // peran ditentukan kepemilikan dulu; jika penyetuju terkunci, ia yang sah
  const bolehJadiPenyetuju =
    konten.penyetujuId !== null &&
    konten.penyetujuId === saya.id &&
    bolehEfek(saya.role, 'setujui_konten');
  const bolehJadiPenyetujuLain = bolehEfek(saya.role, 'setujui_konten');

  const peran = pemilik ? 'PEMILIK' : bolehJadiPenyetuju || bolehJadiPenyetujuLain ? 'PENYETUJU' : 'PEMILIK';

  if (!pemilik && !bolehJadiPenyetuju && !bolehJadiPenyetujuLain) {
    return { error: 'Anda tidak berhak mengubah konten ini.' };
  }

  // ==== aksi yang hanya boleh oleh pemilik ====
  if ((aksi === 'AJUKAN' || aksi === 'TARIK') && !pemilik) {
    return { error: 'Hanya pembuat konten yang dapat mengajukan atau menarik konten.' };
  }

  // ==== aksi penyetuju: siapa yang sah menyetujui konten ini ====
  if (aksi === 'SETUJUI' || aksi === 'MINTA_REVISI') {
    if (!bolehEfek(saya.role, 'setujui_konten')) {
      return { error: 'Peran Anda tidak berhak menyetujui konten.' };
    }
    if (pemilik) {
      return { error: 'Anda tidak dapat menyetujui konten Anda sendiri.' };
    }
    // kalau penyetuju sudah dikunci saat pengajuan, hanya dia yang sah
    if (konten.penyetujuId && konten.penyetujuId !== saya.id) {
      return { error: 'Konten ini sudah ditugaskan ke penyetuju lain.' };
    }
  }

  // ==== validasi khusus ====
  if (aksi === 'AJUKAN') {
    if (!konten.mediaData) return { error: 'Konten belum punya berkas media.' };
    if (!konten.penyetujuId) {
      return {
        error:
          'Penyetuju belum ditentukan. Buka konten, pilih penyetuju, lalu simpan sebelum mengajukan.',
      };
    }
  }
  if (aksi === 'MINTA_REVISI' && !catatan) {
    return { error: 'Alasan revisi wajib diisi.' };
  }
  if (aksi === 'JADWALKAN') {
    if (!jadwalMentah) return { error: 'Waktu jadwal wajib diisi.' };
    const t = new Date(jadwalMentah);
    if (Number.isNaN(t.getTime())) return { error: 'Format waktu jadwal tidak dikenali.' };
    if (t.getTime() < Date.now() - 60_000) {
      return { error: 'Waktu jadwal sudah lewat. Pilih waktu setelah sekarang.' };
    }
  }

  const hasil = transisiStatus(status, aksi as never, peran);
  if (!hasil.boleh) return { error: hasil.alasan };

  const sekarang = new Date();

  await prisma.kontenSosmed.update({
    where: { id },
    data: {
      status: hasil.statusBaru,
      ...(aksi === 'AJUKAN'
        ? {
            pengajuId: saya.id,
            diajukanAt: sekarang,
            catatanKreator: catatan || null,
            alasanRevisi: null,
            // kalau penunjukan penyetuju diubah dari halaman detail, ambil
            // nilai terbaru dari form (hanya saat mengajukan)
            ...(String(formData.get('penyetujuId') ?? '').trim()
              ? { penyetujuId: String(formData.get('penyetujuId')) }
              : {}),
          }
        : {}),
      ...(aksi === 'SETUJUI'
        ? { diputusAt: sekarang, catatanPenyetuju: catatan || null, alasanRevisi: null }
        : {}),
      ...(aksi === 'MINTA_REVISI'
        ? {
            diputusAt: sekarang,
            alasanRevisi: catatan,
            jumlahRevisi: { increment: 1 },
          }
        : {}),
      ...(aksi === 'TARIK' ? { diajukanAt: null, pengajuId: null } : {}),
      ...(aksi === 'JADWALKAN' ? { jadwalAt: new Date(jadwalMentah) } : {}),
      ...(aksi === 'BATAL_JADWAL' ? { jadwalAt: null } : {}),
    },
  });

  await prisma.keputusanKonten.create({
    data: {
      kontenId: id,
      aksi,
      olehId: saya.id,
      catatan: catatan || null,
    },
  });

  await catatAudit({
    pegawaiId: saya.id,
    aksi: `KONTEN_${aksi}`,
    entitas: 'KontenSosmed',
    entitasId: id,
    dataLama: { status },
    dataBaru: { status: hasil.statusBaru, catatan: catatan || undefined },
  });

  revalidatePath('/sosmed');
  revalidatePath(`/sosmed/${id}`);
  revalidatePath('/sosmed/persetujuan');

  const pesan: Record<string, string> = {
    AJUKAN: 'Konten diajukan. Penyetuju akan menerima notifikasi.',
    SETUJUI: 'Konten disetujui. Sekarang dapat dikirim ke platform.',
    MINTA_REVISI: 'Konten dikembalikan ke kreator untuk direvisi.',
    TARIK: 'Pengajuan ditarik. Konten kembali menjadi draft.',
    JADWALKAN: 'Konten dijadwalkan. Pengiriman otomatis akan berjalan sesuai waktu.',
    BATAL_JADWAL: 'Jadwal dibatalkan.',
    ARSIPKAN: 'Konten diarsipkan.',
  };

  return { sukses: true, pesan: pesan[aksi] ?? 'Status konten diperbarui.' };
}

// ===========================================================================
// Pengiriman ke platform
// ===========================================================================

/**
 * Kirim konten yang SUDAH disetujui ke TikTok/Instagram.
 *
 * Kegagalan platform TIDAK mengembalikan status ke sebelum disetujui — hasil
 * per platform disimpan di `hasilKirim` supaya bisa dicoba ulang hanya untuk
 * platform yang gagal.
 */
export async function kirimKeSosmed(
  _sebelumnya: HasilAksi,
  formData: FormData
): Promise<HasilAksi> {
  const saya = await pegawaiDariSesi();
  if (!saya) return { error: 'Sesi habis. Silakan masuk kembali.' };

  const id = String(formData.get('id') ?? '');
  const { konten, error } = await ambilKonten(id, saya);
  if (!konten || error) return { error: error ?? 'Konten tidak ditemukan.' };

  const status = konten.status as StatusKonten;
  const pemilik = konten.pembuatId === saya.id;
  const penyetuju = konten.penyetujuId === saya.id || bolehEfek(saya.role, 'setujui_konten');

  if (!pemilik && !penyetuju) return { error: 'Anda tidak berhak mengirim konten ini.' };
  if (!konten.mediaData) return { error: 'Konten tidak punya berkas media.' };

  const hasil = transisiStatus(status, 'PUBLISH', 'PEMILIK');
  if (!hasil.boleh) return { error: hasil.alasan };

  const konfig = bacaKonfigSosmed();
  const kirim = await kirimKePlatform(
    {
      kontenId: id,
      tujuan: konten.tujuan as never,
      caption: konten.caption,
      mediaUrl: urlMedia(id),
      jenis: konten.jenis as never,
      sampulUrl: null,
    },
    konfig
  );

  const peta: Record<string, HasilPlatform> = {};
  for (const h of kirim.hasil) peta[h.platform] = h;

  await prisma.kontenSosmed.update({
    where: { id },
    data: {
      // status jadi DIKIRIM hanya kalau SEMUA platform berhasil; kalau sebagian
      // gagal, konten tetap DISETUJUI supaya tombol "Kirim" masih masuk akal.
      status: kirim.semuaBerhasil ? 'DIKIRIM' : status,
      hasilKirim: peta as never,
      terkirimAt: kirim.semuaBerhasil ? new Date() : konten.terkirimAt,
    },
  });

  await prisma.keputusanKonten.create({
    data: {
      kontenId: id,
      aksi: 'KIRIM',
      olehId: saya.id,
      catatan: kirim.hasil
        .map((h) => `${h.platform}: ${h.berhasil ? 'berhasil' : 'GAGAL'} — ${h.pesan}`)
        .join(' | '),
    },
  });

  await catatAudit({
    pegawaiId: saya.id,
    aksi: 'KIRIM_KONTEN',
    entitas: 'KontenSosmed',
    entitasId: id,
    dataBaru: {
      modus: konfig.modus,
      hasil: kirim.hasil.map((h) => ({
        platform: h.platform,
        berhasil: h.berhasil,
        idPlatform: h.idPlatform,
      })),
    },
  });

  revalidatePath('/sosmed');
  revalidatePath(`/sosmed/${id}`);

  if (kirim.semuaBerhasil) {
    const simulasi = kirim.modus === 'mock';
    return {
      sukses: true,
      pesan: simulasi
        ? 'Disimulasikan terkirim ke semua platform (modus simulasi).'
        : 'Berhasil dikirim ke semua platform.',
    };
  }

  const gagal = kirim.hasil.filter((h) => !h.berhasil).map((h) => h.platform).join(', ');
  return {
    error: `Gagal dikirim ke: ${gagal}. Konten tetap berstatus disetujui — periksa pesan di detail konten, lalu coba kirim lagi.`,
  };
}

// ===========================================================================
// Daftar pilihan untuk form (dipakai halaman, bukan klien)
// ===========================================================================

/** Petugas yang berhak menjadi penyetuju konten (punya kemampuan menyetujui). */
export async function daftarCalonPenyetuju(saya: PegawaiSesi) {
  const semua = await prisma.pegawai.findMany({
    where: {
      aktif: true,
      role: { in: ['MANAGER', 'ADMIN'] },
      id: { not: saya.id },
    },
    select: { id: true, nama: true, nip: true, role: true, cabang: { select: { nama: true } } },
    orderBy: { nama: 'asc' },
  });
  // saring lewat sumber kebenaran akses, bukan daftar role yang ditulis ulang
  return semua.filter((p) => bolehEfek(p.role, 'setujui_konten'));
}

/** Cari pegawai untuk keperluan notifikasi (dipakai lib pengingat sosmed). */
export async function pegawaiRingkas(id: string) {
  return prisma.pegawai.findUnique({
    where: { id },
    select: { id: true, nama: true, role: true },
  });
}
