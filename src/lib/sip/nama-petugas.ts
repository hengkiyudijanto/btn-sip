/**
 * Menentukan bagaimana nama petugas ditulis di slide.
 *
 * Aturan (permintaan user): kata kedua BOLEH ditulis penuh kalau tidak
 * menabrak kotak nilai. Jadi yang menentukan bukan jumlah kata, melainkan
 * APAKAH MUAT.
 *
 * Cara kerjanya: panjang teks diperkirakan dulu, lalu dipilih bentuk
 * terpanjang yang masih muat — mulai dari nama lengkap, lalu bertahap
 * diringkas.
 *
 * Lebar diperkirakan dari jumlah huruf, bukan diukur dari font aslinya.
 * Font Aptos tidak tersedia di server, dan mengukur lewat render terlalu mahal
 * untuk dijalankan setiap kali laporan dibuat. Perkiraannya sengaja dibuat
 * sedikit LEBIH LEBAR dari kenyataan, karena akibat "terlalu panjang" (teks
 * menabrak kotak nilai) jauh lebih buruk daripada akibat "terlalu pendek"
 * (nama diringkas padahal masih muat).
 *
 * Angka pembandingnya dari pengukuran pada slide nyata
 * (scripts/ukur-lebar-nama.py). Pada 16 pt Aptos bold:
 *   "Irwan Allo"        0,920 inci  (11 huruf -> 0,084/huruf)
 *   "Husnia Paraditha"  1,540 inci  (16 huruf -> 0,096/huruf)
 *   "Fitria Nur Jaya"   1,287 inci  (15 huruf -> 0,086/huruf)
 * Rata-rata sekitar 0,089 inci per huruf; dipakai 0,102 supaya ada margin.
 */

/** Perkiraan lebar rata-rata satu huruf (inci) pada 16 pt Aptos bold. */
const LEBAR_HURUF = 0.102;

/**
 * Ruang aman untuk nama sebelum menabrak kotak nilai (inci).
 * Kolom nama mulai di x 2,979 dan kotak nilai di 4,7222 — jeda 1,743;
 * dipakai 1,663 supaya ada sedikit sela.
 */
export const LEBAR_NAMA_MAKS = 1.663;

/** Perkiraan lebar teks satu baris (inci). */
export function perkiraanLebar(teks: string): number {
  return teks.length * LEBAR_HURUF;
}

/** Kata pertama penuh, sisanya inisial: "Fitria Nur Jaya" -> "Fitria N. J." */
function ringkasSemua(nama: string): string {
  const kata = nama.trim().split(/\s+/).filter(Boolean);
  if (kata.length <= 1) return nama.trim();
  const [pertama, ...sisa] = kata;
  return [pertama, ...sisa.map((k) => `${k[0].toUpperCase()}.`)].join(' ');
}

/** Dua kata pertama penuh, sisanya inisial: "A B C" -> "A B C." */
function duaKataPenuh(nama: string): string {
  const kata = nama.trim().split(/\s+/).filter(Boolean);
  if (kata.length <= 2) return nama.trim();
  const [satu, dua, ...sisa] = kata;
  return [satu, dua, ...sisa.map((k) => `${k[0].toUpperCase()}.`)].join(' ');
}

/**
 * Menulis nama petugas sepanjang yang masih muat di kolom nama.
 *
 * Urutan percobaan, dari yang terpanjang:
 *   1. nama lengkap               "Fitria Nur Jaya"
 *   2. dua kata + inisial sisanya "Fitria Nur J."
 *   3. satu kata + inisial semua  "Fitria N. J."
 *
 * Kalau bentuk nomor 3 pun masih terlalu panjang (kata pertamanya sendiri
 * sudah panjang), kata pertamanya dipotong dengan elipsis. Tanpa pengaman ini
 * teksnya bisa menabrak kotak nilai — dan itu justru yang ingin dihindari.
 * Dipotong di TENGAH huruf (bukan per kata) supaya tetap terbaca.
 *
 * @param nama       nama petugas (sebaiknya sudah dirapikan hurufnya)
 * @param lebarMaks  lebar ruang nama yang tersedia (inci)
 */
export function namaSelebarMungkin(
  nama: string,
  lebarMaks: number = LEBAR_NAMA_MAKS
): string {
  const bersih = nama.trim();
  if (!bersih) return '';

  const kandidat = [
    bersih,
    duaKataPenuh(bersih),
    ringkasSemua(bersih),
  ];

  for (const c of kandidat) {
    if (perkiraanLebar(c) <= lebarMaks) return c;
  }

  // tidak ada yang muat: potong kandidat terpendek sampai muat
  return potongSampaiMuat(kandidat[kandidat.length - 1], lebarMaks);
}

/** Memotong teks sampai perkiraan lebarnya muat, dengan elipsis di akhir. */
function potongSampaiMuat(teks: string, lebarMaks: number): string {
  const hurufMaks = Math.floor(lebarMaks / LEBAR_HURUF);
  if (hurufMaks <= 1) return teks.slice(0, 1);
  // sisakan satu huruf untuk elipsis
  return `${teks.slice(0, Math.max(1, hurufMaks - 1))}…`;
}

/**
 * Bentuk lama: SELALU meringkas kata kedua dst menjadi inisial.
 *
 * Masih dipakai di tempat yang tidak punya batas lebar (mis. judul tabel),
 * dan dipertahankan supaya perubahan perilakunya jelas terlihat.
 *
 *   "Irwan Allo"         -> "Irwan A."
 *   "Ahmad Budi Santoso" -> "Ahmad B. S."
 */
export function ringkasNama(nama: string): string {
  return ringkasSemua(nama);
}
