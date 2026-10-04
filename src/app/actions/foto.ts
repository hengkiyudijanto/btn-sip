'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db';
import { pegawaiDariSesi, catatAudit } from '@/lib/auth';
import { boleh } from '@/lib/sip/akses';

export type HasilFoto = {
  error?: string;
  sukses?: boolean;
  pesan?: string;
  /** kembalikan data URL supaya UI bisa langsung menampilkan tanpa refresh */
  dataUrl?: string;
  byte?: number;
};

/** Batas ukuran data URL yang diterima server (± 400 KB base64 = ± 300 KB file). */
const MAKS_DATA_URL = 400 * 1024;

/**
 * Simpan foto pegawai. Gambar sudah dikompres di sisi browser
 * (lihat src/lib/foto.ts), server hanya memvalidasi dan menyimpan.
 *
 * Hanya admin. Data disimpan sebagai data URL di database karena Vercel
 * tidak menyediakan filesystem persisten.
 */
export async function simpanFoto(
  _sebelumnya: HasilFoto,
  formData: FormData
): Promise<HasilFoto> {
  const saya = await pegawaiDariSesi();
  if (!saya) return { error: 'Sesi habis. Silakan masuk kembali.' };
  if (!boleh(saya.role, 'kelola_pegawai')) return { error: 'Peran Anda hanya bisa melihat, tidak bisa mengubah data.' };

  const pegawaiId = String(formData.get('pegawaiId') ?? '');
  const dataUrl = String(formData.get('dataUrl') ?? '');
  const mime = String(formData.get('mime') ?? '');
  const byte = Number(formData.get('byte') ?? 0);

  if (!pegawaiId) return { error: 'Pegawai tidak ditemukan.' };
  if (!dataUrl) return { error: 'Tidak ada gambar yang dikirim.' };

  // validasi format: harus JPEG/PNG data URL
  if (!/^data:image\/(jpeg|png|webp);base64,/.test(dataUrl)) {
    return { error: 'Format gambar tidak didukung. Gunakan JPG atau PNG.' };
  }
  if (dataUrl.length > MAKS_DATA_URL) {
    return {
      error:
        'Ukuran gambar melebihi batas. Coba unggah foto dengan resolusi lebih kecil.',
    };
  }

  const target = await prisma.pegawai.findUnique({
    where: { id: pegawaiId },
    select: { nama: true, fotoUrl: true },
  });
  if (!target) return { error: 'Pegawai tidak ditemukan.' };

  await prisma.pegawai.update({
    where: { id: pegawaiId },
    data: {
      fotoData: dataUrl,
      fotoMime: mime || 'image/jpeg',
      fotoUkuran: byte || undefined,
      fotoUrl: null, // hapus URL lama supaya tidak tumpang tindih
      fotoDiperbarui: new Date(),
    },
  });

  await catatAudit({
    pegawaiId: saya.id,
    aksi: 'UNGGAH_FOTO_PEGAWAI',
    entitas: 'Pegawai',
    entitasId: pegawaiId,
    dataBaru: { nama: target.nama, mime, byte },
  });

  revalidatePath('/pegawai');
  revalidatePath('/laporan');

  return {
    sukses: true,
    pesan: `Foto ${target.nama} tersimpan.`,
    dataUrl,
    byte,
  };
}

/** Hapus foto pegawai. */
export async function hapusFoto(
  _sebelumnya: HasilFoto,
  formData: FormData
): Promise<HasilFoto> {
  const saya = await pegawaiDariSesi();
  if (!saya) return { error: 'Sesi habis. Silakan masuk kembali.' };
  if (!boleh(saya.role, 'kelola_pegawai')) return { error: 'Peran Anda hanya bisa melihat, tidak bisa mengubah data.' };

  const pegawaiId = String(formData.get('pegawaiId') ?? '');
  if (!pegawaiId) return { error: 'Pegawai tidak ditemukan.' };

  const target = await prisma.pegawai.findUnique({
    where: { id: pegawaiId },
    select: { nama: true, fotoData: true, fotoUrl: true },
  });
  if (!target) return { error: 'Pegawai tidak ditemukan.' };
  if (!target.fotoData && !target.fotoUrl) {
    return { error: 'Pegawai ini belum punya foto.' };
  }

  await prisma.pegawai.update({
    where: { id: pegawaiId },
    data: {
      fotoData: null,
      fotoMime: null,
      fotoUkuran: null,
      fotoUrl: null,
      fotoDiperbarui: null,
    },
  });

  await catatAudit({
    pegawaiId: saya.id,
    aksi: 'HAPUS_FOTO_PEGAWAI',
    entitas: 'Pegawai',
    entitasId: pegawaiId,
    dataBaru: { nama: target.nama },
  });

  revalidatePath('/pegawai');
  revalidatePath('/laporan');

  return { sukses: true, pesan: `Foto ${target.nama} dihapus.` };
}

/** Setel foto dari URL eksternal (alternatif unggahan). */
export async function simpanFotoDariUrl(
  _sebelumnya: HasilFoto,
  formData: FormData
): Promise<HasilFoto> {
  const saya = await pegawaiDariSesi();
  if (!saya) return { error: 'Sesi habis. Silakan masuk kembali.' };
  if (!boleh(saya.role, 'kelola_pegawai')) return { error: 'Peran Anda hanya bisa melihat, tidak bisa mengubah data.' };

  const pegawaiId = String(formData.get('pegawaiId') ?? '');
  const url = String(formData.get('fotoUrl') ?? '').trim();

  if (!pegawaiId) return { error: 'Pegawai tidak ditemukan.' };
  if (!url) return { error: 'URL foto wajib diisi.' };
  if (!/^https?:\/\//i.test(url)) {
    return { error: 'URL harus dimulai dengan http:// atau https://' };
  }

  const target = await prisma.pegawai.findUnique({
    where: { id: pegawaiId },
    select: { nama: true },
  });
  if (!target) return { error: 'Pegawai tidak ditemukan.' };

  await prisma.pegawai.update({
    where: { id: pegawaiId },
    data: {
      fotoUrl: url,
      fotoData: null,
      fotoMime: null,
      fotoUkuran: null,
      fotoDiperbarui: new Date(),
    },
  });

  await catatAudit({
    pegawaiId: saya.id,
    aksi: 'SET_FOTO_URL_PEGAWAI',
    entitas: 'Pegawai',
    entitasId: pegawaiId,
    dataBaru: { nama: target.nama, url },
  });

  revalidatePath('/pegawai');
  revalidatePath('/laporan');

  return { sukses: true, pesan: `URL foto ${target.nama} tersimpan.` };
}
