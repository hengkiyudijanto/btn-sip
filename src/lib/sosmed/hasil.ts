/**
 * Pembaca hasil pengiriman (kolom JSON `hasilKirim`).
 *
 * Dipisah dari komponen supaya bentuk JSON dari database diperiksa di satu
 * tempat: isi kolom JSON Prisma bertipe `unknown`, dan kalau langsung di-cast
 * di komponen, perubahan bentuk data akan muncul sebagai layar putih.
 */

export type HasilSatuPlatform = {
  platform: string;
  berhasil: boolean;
  idPlatform?: string;
  urlPublik?: string;
  pesan: string;
  perluPolling?: boolean;
};

export type PetaHasilKirim = Record<string, HasilSatuPlatform>;

function adalahHasilSatu(v: unknown): v is HasilSatuPlatform {
  if (typeof v !== 'object' || v === null) return false;
  const o = v as Record<string, unknown>;
  return typeof o.berhasil === 'boolean' && typeof o.pesan === 'string';
}

/** Bentuk JSON hasil kirim valid? Dipakai sebagai type guard di UI. */
export function hasIlKirim(v: unknown): v is PetaHasilKirim {
  if (typeof v !== 'object' || v === null || Array.isArray(v)) return false;
  const nilai = Object.values(v as Record<string, unknown>);
  return nilai.length > 0 && nilai.every(adalahHasilSatu);
}

/**
 * Ringkasan satu baris untuk daftar konten, mis. "TikTok berhasil · Instagram GAGAL".
 * Mengembalikan null kalau belum pernah dikirim.
 */
export function ringkasHasilKirim(v: unknown): { teks: string; adaGagal: boolean } | null {
  if (!hasIlKirim(v)) return null;
  const bagian = Object.entries(v).map(
    ([platform, h]) => `${platform} ${h.berhasil ? 'berhasil' : 'GAGAL'}`
  );
  return { teks: bagian.join(' · '), adaGagal: Object.values(v).some((h) => !h.berhasil) };
}

/**
 * Platform yang masih perlu dikirim ulang (gagal pada percobaan terakhir).
 * Dipakai supaya tombol "Kirim" hanya muncul kalau memang masih ada yang gagal.
 */
export function platformGagal(v: unknown): string[] {
  if (!hasIlKirim(v)) return [];
  return Object.entries(v)
    .filter(([, h]) => !h.berhasil)
    .map(([p]) => p);
}
