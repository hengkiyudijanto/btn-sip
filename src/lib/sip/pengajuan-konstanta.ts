/**
 * Konstanta pengajuan pegawai.
 *
 * Dipisah dari src/lib/sip/pengajuan.ts dengan sengaja: berkas itu
 * mengimpor Prisma, dan kalau konstanta ini ikut dari sana, komponen
 * klien (form) akan ikut menarik Prisma + driver `pg` ke bundel browser
 * dan build gagal ("Can't resolve 'dns'").
 *
 * Jadi: berkas ini hanya boleh berisi nilai murni, tanpa impor apa pun.
 */

/** Role yang boleh mengajukan penambahan pegawai */
export const BOLEH_MENGAJUKAN = new Set(['SUPERVISOR', 'MANAGER', 'ADMIN']);

/** Panjang minimal password pegawai baru */
export const MIN_PANJANG_PASSWORD = 8;

/** Format NIP yang diterima: huruf, angka, tanda hubung (3-30 karakter) */
export const POLA_NIP = /^[A-Za-z0-9-]{3,30}$/;

export function nipValid(nip: string): boolean {
  return POLA_NIP.test(nip);
}
