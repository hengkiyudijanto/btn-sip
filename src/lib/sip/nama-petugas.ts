/**
 * Meringkas nama petugas untuk slide.
 *
 * Aturan (permintaan user): kata PERTAMA ditulis penuh, kata KEDUA dan
 * seterusnya diambil huruf depannya saja lalu diberi titik.
 *
 *   "Irwan Allo"            -> "Irwan A."
 *   "Ahmad Budi Santoso"    -> "Ahmad B. S."
 *   "Deborah C"             -> "Deborah C."
 *   "Benny"                 -> "Benny"
 *
 * Nama kosong / hanya spasi dikembalikan apa adanya.
 */
export function ringkasNama(nama: string): string {
  const kata = nama.trim().split(/\s+/).filter(Boolean);
  if (kata.length <= 1) return nama.trim();

  const [pertama, ...sisanya] = kata;
  const inisial = sisanya.map((k) => `${k[0].toUpperCase()}.`);
  return [pertama, ...inisial].join(' ');
}
