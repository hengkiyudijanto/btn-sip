/**
 * Menyeragamkan huruf data yang datang dari database.
 *
 * Aturan (permintaan user):
 *   1. Umum: huruf PERTAMA setiap kata jadi kapital, sisanya huruf kecil.
 *        "IRWAN ALLO"   -> "Irwan Allo"
 *        "KC MAMUJU"    -> "Kc Mamuju"
 *   2. Khusus NAMA CABANG: kalau kata pertamanya KC atau KCP, kata itu
 *      ditulis KAPITAL SEMUA, dan kata sisanya pakai aturan umum.
 *        "KC MAMUJU"         -> "KC Mamuju"
 *        "KCP POLEWALI MANDAR" -> "KCP Polewali Mandar"
 *        "KANWIL SULAMPUA"   -> "Kanwil Sulampua"
 *
 * Data di database TIDAK diubah oleh fungsi ini — ini hanya untuk tampilan.
 */

/**
 * Satu kata: huruf pertama kapital, sisanya kecil. Tanda kurung di tepi
 * tetap dipertahankan dan huruf pertama DI DALAMNYA yang dikapitalkan:
 *   "(teks)" -> "(Teks)"
 */
function kapitalkanKata(kata: string): string {
  if (!kata) return kata;
  const m = kata.match(/^([([{]*)(.*?)([)\]}]*(?:[.,;:!?]*))$/);
  if (m && m[2]) {
    const depan = m[1];
    const isi = m[2];
    const belakang = m[3];
    return depan + isi[0].toUpperCase() + isi.slice(1).toLowerCase() + belakang;
  }
  return kata[0].toUpperCase() + kata.slice(1).toLowerCase();
}

/**
 * Menjaga singkatan di dalam tanda kurung supaya tetap kapital semua.
 *
 * Diproses SEBELUM pemisahan kata, karena isi kurung bisa terdiri dari
 * beberapa kata ("(PB CS)") sehingga tidak bisa ditangani per kata.
 *
 * Hanya isi yang seluruhnya kapital DAN pendek (dianggap singkatan) yang
 * dilindungi. "(TELLER)" tidak dilindungi karena itu kata biasa yang
 * kebetulan ditulis kapital.
 */
const PENANDA = '\u0000';
// 4 huruf sudah cukup untuk singkatan yang dipakai di aplikasi ini:
// PB, CS, KC, KCP, PB CS (5 tanpa spasi), TELLER (6, ini kata biasa).
const PANJANG_SINGKATAN_MAKS = 4;

function lindungiSingkatan(nilai: string): { teks: string; singkatan: string[] } {
  const singkatan: string[] = [];
  const teks = nilai.replace(/\(([^()]+)\)/g, (utuh, isi: string) => {
    const bersih = isi.replace(/[^A-Za-z0-9]/g, '');
    const kapitalSemua = bersih && bersih === bersih.toUpperCase() && /[A-Z]/.test(bersih);
    if (kapitalSemua && bersih.length <= PANJANG_SINGKATAN_MAKS) {
      singkatan.push(utuh);
      return `${PENANDA}${singkatan.length - 1}${PENANDA}`;
    }
    return utuh;
  });
  return { teks, singkatan };
}

function kembalikanSingkatan(nilai: string, singkatan: string[]): string {
  return nilai.replace(
    new RegExp(`${PENANDA}(\\d+)${PENANDA}`, 'g'),
    (_, i: string) => singkatan[Number(i)]
  );
}

/**
 * Aturan umum: huruf pertama tiap kata kapital, sisanya kecil.
 *
 * Tanda hubung dipertahankan dan tiap bagiannya ikut dikapitalkan, karena
 * nama tempat sering memakainya ("BAJO-BARAT" -> "Bajo-Barat").
 * Singkatan di dalam kurung dibiarkan kapital ("(PB CS)" tetap "(PB CS)").
 */
export function kapitalkan(nilai: string | null | undefined): string {
  if (!nilai) return '';
  const { teks, singkatan } = lindungiSingkatan(nilai.trim());

  const hasil = teks
    .split(/\s+/)
    .map((kata) =>
      kata
        .split('-')
        .map(kapitalkanKata)
        .join('-')
    )
    .join(' ');

  return kembalikanSingkatan(hasil, singkatan);
}

/** Kata yang harus ditulis KAPITAL SEMUA kalau jadi kata pertama cabang. */
const SINGKATAN_CABANG = new Set(['KC', 'KCP']);

/**
 * Nama cabang: sama seperti kapitalkan(), tapi kalau kata pertamanya KC atau
 * KCP maka kata itu ditulis kapital semua.
 */
export function kapitalkanCabang(nama: string | null | undefined): string {
  if (!nama) return '';
  const kata = nama.trim().split(/\s+/);
  if (kata.length === 0) return '';

  return kata
    .map((k, i) => {
      const polos = k.replace(/[^A-Za-z]/g, '').toUpperCase();
      if (i === 0 && SINGKATAN_CABANG.has(polos)) return polos;
      return kapitalkanKata(k);
    })
    .join(' ');
}
