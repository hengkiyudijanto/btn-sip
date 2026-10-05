/**
 * Kolom "nilai per jabatan" di dasbor: memilih jabatan mana yang wajib tampil
 * walaupun belum ada penilaian di periode itu.
 *
 * Dipisah ke modul sendiri (bukan inline di `grafik-batang-data.ts`) supaya
 * bisa diuji tanpa database — aturannya murni soal himpunan kode.
 */

export type BatangJabatan = { jabatanKode?: string; jumlah: number };

/**
 * Susun daftar jabatan untuk grafik, dengan **jabatan yang terpilih di filter
 * selalu ikut** walau tidak ada satu pun petugasnya dinilai pada periode itu.
 *
 * Kenapa perlu: jabatan seperti Security bisa punya petugas tapi belum dinilai
 * sama sekali — filter "Security" kalau dibiarkan apa adanya akan menghasilkan
 * daftar kosong, dan layar terlihat seperti aplikasi rusak padahal datanya
 * memang belum ada. Yang benar: tetap tampilkan batangnya dengan keterangan
 * "belum ada nilai", sama seperti perlakuan jabatan yang punya pegawai.
 *
 * Batang yang sudah ada dipertahankan persis (kunci, label, nilai); yang
 * ditambahkan hanyalah jabatan terpilih yang belum ada di daftar itu.
 */
export function denganJabatanTerpilih<T extends BatangJabatan>(
  batang: T[],
  kodeTerpilih: string,
  kandidat: { kode: string; nama: string }[]
): T[] {
  if (!kodeTerpilih) return batang;
  if (batang.some((b) => b.jabatanKode === kodeTerpilih)) return batang;

  const info = kandidat.find((k) => k.kode === kodeTerpilih);
  if (!info) return batang;

  const tambahan = {
    kunci: `jab-${kodeTerpilih}`,
    label: info.nama,
    keterangan: 'belum ada nilai',
    nilai: 0,
    jumlah: 0,
    jabatanKode: kodeTerpilih,
  } as unknown as T;

  return [...batang, tambahan];
}
