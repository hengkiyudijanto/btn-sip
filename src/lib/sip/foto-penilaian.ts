import { prisma } from '@/lib/db';

/**
 * Foto penilaian: satu foto per periode penilaian.
 *
 * Berbeda dari foto pegawai (foto identitas yang jarang berubah), foto
 * penilaian membuktikan kondisi petugas pada periode itu — kerapihan
 * seragam, kelengkapan atribut, kebersihan area. Karena itu foto dibuat
 * baru setiap periode, dan foto periode lama tetap tersimpan sebagai
 * riwayat.
 *
 * Kompresi dilakukan di peramban (src/lib/foto.ts): 3x4, maks 80 KB.
 * Server memeriksa ulang format dan ukurannya.
 */

/** Batas data URL yang diterima server (sedikit di atas 80 KB untuk toleransi base64) */
export const MAKS_DATA_URL_PENILAIAN = 400 * 1024;

const FORMAT_DITERIMA = /^data:image\/(jpeg|png|webp);base64,/;

export type HasilValidasiFoto = {
  ok: boolean;
  error?: string;
  byte: number;
};

/** Hitung ukuran asli dari data URL base64 */
export function ukuranDataUrl(dataUrl: string): number {
  const i = dataUrl.indexOf(',');
  if (i < 0) return 0;
  const b64 = dataUrl.slice(i + 1);
  const pad = b64.endsWith('==') ? 2 : b64.endsWith('=') ? 1 : 0;
  return Math.floor((b64.length * 3) / 4) - pad;
}

/**
 * Validasi foto penilaian di server.
 *
 * SVG sengaja ditolak: SVG bisa memuat skrip, dan foto ini ditampilkan
 * di laporan yang dicetak serta dibuka orang lain.
 */
export function validasiFotoPenilaian(dataUrl: string): HasilValidasiFoto {
  if (!dataUrl || dataUrl.length < 50) {
    return { ok: false, error: 'Foto belum dipilih.', byte: 0 };
  }
  if (!FORMAT_DITERIMA.test(dataUrl)) {
    return {
      ok: false,
      error: 'Format foto harus JPEG, PNG, atau WebP. Format lain ditolak.',
      byte: 0,
    };
  }
  if (dataUrl.length > MAKS_DATA_URL_PENILAIAN) {
    return {
      ok: false,
      error: `Foto terlalu besar (${Math.round(dataUrl.length / 1024)} KB). Maksimal ${Math.round(MAKS_DATA_URL_PENILAIAN / 1024)} KB.`,
      byte: 0,
    };
  }
  const byte = ukuranDataUrl(dataUrl);
  if (byte < 100) {
    return { ok: false, error: 'Berkas foto tampak rusak atau kosong.', byte: 0 };
  }
  return { ok: true, byte };
}

/** Simpan foto ke sebuah penilaian */
export async function simpanFotoPenilaian(
  penilaianId: string,
  data: { dataUrl: string; mime: string; byte: number; catatan?: string }
) {
  return prisma.penilaian.update({
    where: { id: penilaianId },
    data: {
      fotoData: data.dataUrl,
      fotoMime: data.mime,
      fotoUkuran: data.byte,
      fotoDiperbarui: new Date(),
      fotoCatatan: data.catatan?.trim() || null,
    },
  });
}

/** Ambil foto penilaian (data URL atau null) */
export async function ambilFotoPenilaian(penilaianId: string): Promise<string | null> {
  const p = await prisma.penilaian.findUnique({
    where: { id: penilaianId },
    select: { fotoData: true },
  });
  return p?.fotoData ?? null;
}

/** Ringkas status foto untuk ditampilkan tanpa memuat gambarnya */
export type StatusFoto = {
  ada: boolean;
  byte: number | null;
  diperbarui: Date | null;
  catatan: string | null;
};
