/**
 * Ikon & teks pendek per status konten — dipakai lintas halaman.
 *
 * Ditaruh di berkas terpisah (bukan di status.ts) supaya berkas konstanta murni
 * tetap bebas dari apa pun yang berbau tampilan.
 */

export function statusIkon(status: string): string {
  switch (status) {
    case 'DRAFT':
      return '✎';
    case 'MENUNGGU':
      return '⧗';
    case 'REVISI':
      return '↩';
    case 'DISETUJUI':
      return '✓';
    case 'DIJADWALKAN':
      return '⌚';
    case 'DIKIRIM':
      return '⇪';
    case 'DIARSIPKAN':
      return '🗄';
    default:
      return '•';
  }
}

/** Keterangan satu baris: apa arti status ini bagi pemakai. */
export function keteranganStatus(status: string): string {
  switch (status) {
    case 'DRAFT':
      return 'Masih bisa diubah bebas. Belum dilihat siapa pun.';
    case 'MENUNGGU':
      return 'Sudah diajukan. Menunggu keputusan penyetuju — isi tidak bisa diubah sampai ditarik.';
    case 'REVISI':
      return 'Dikembalikan penyetuju. Baca alasannya, perbaiki, lalu ajukan ulang.';
    case 'DISETUJUI':
      return 'Sudah lolos approval. Siap dikirim ke platform.';
    case 'DIJADWALKAN':
      return 'Akan dikirim otomatis pada waktu yang ditentukan.';
    case 'DIKIRIM':
      return 'Sudah dipublikasikan ke platform.';
    case 'DIARSIPKAN':
      return 'Disimpan sebagai arsip dan tidak akan dikirim.';
    default:
      return '';
  }
}

/**
 * Label jalur persetujuan untuk satu konten.
 * Sengaja tidak menyebut nama peran — yang penting bagi pemakai adalah
 * "sedang di siapa", bukan jabatannya.
 */
export function labelJalur(penyetujuNama: string | null | undefined): string {
  if (!penyetujuNama) return 'Penyetuju belum ditentukan';
  return `Disetujui oleh ${penyetujuNama}`;
}
