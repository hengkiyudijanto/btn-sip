/**
 * Menyiapkan foto supaya pas di kotaknya: mengisi penuh + sudut membulat.
 *
 * Dikerjakan di sisi server karena dua alasan:
 *   1. Foto yang digambar sebagai gambar kotak lalu ditimpa bingkai membulat
 *      meninggalkan keempat sudut bolong (sudut gambar kotak ≠ sudut bingkai).
 *   2. Mengisi bentuk autoshape dengan gambar lewat blipFill tidak dirender
 *      LibreOffice, jadi tidak bisa diandalkan.
 *
 * Hasilnya: PNG dengan sudut tembus pandang, sehingga menempel rapi di atas
 * bentuk membulat apa pun dan tampil sama di semua penampil.
 *
 * Ukuran kotak foto di slide: 1,191 × 0,962 inci (rasio 1,238).
 */

import sharp from 'sharp';

import { BAGIAN_POTONG_ATAS } from './potong-foto';

/**
 * Ukuran kotak foto di slide (inci).
 *
 * HARUS sama dengan yang dipakai generator slide: tinggi = jarak antar baris
 * (0,962) dikurangi JARAK_ANTAR_FOTO (0,10), lebarnya dari rasio asli kotak
 * foto di berkas acuan (1,191 / 0,962). Kalau salah satu berubah, ubah
 * keduanya — kalau tidak, fotonya akan gepeng atau tidak pas.
 */
export const KOTAK_FOTO = {
  w: (0.962 - 0.10) * (1.191 / 0.962),
  h: 0.962 - 0.10,
};

/** Radius sudut kotak foto (inci) — sama dengan RADIUS_FOTO di generator. */
export const RADIUS_FOTO = 0.18;

/**
 * Resolusi keluaran. Kotak fotonya hanya 1,191 × 0,962 inci, jadi 320 px/inci
 * sudah lebih dari cukup untuk cetak (± 305 dpi) tanpa membuat berkas besar.
 */
const PX_PER_INCI = 320;

/** Membuat SVG topeng: kotak dengan sudut membulat, putih = tampak. */
function topengSvg(lebar: number, tinggi: number, radius: number): Buffer {
  const svg =
    `<svg width="${lebar}" height="${tinggi}" xmlns="http://www.w3.org/2000/svg">` +
    `<rect x="0" y="0" width="${lebar}" height="${tinggi}" ` +
    `rx="${radius}" ry="${radius}" fill="#fff"/></svg>`;
  return Buffer.from(svg);
}

export type PilihanFoto = {
  /** Lebar & tinggi kotak tujuan (inci). */
  kotak?: { w: number; h: number };
  /** Radius sudut (inci). */
  radius?: number;
  /** Resolusi keluaran (piksel per inci). */
  pxPerInci?: number;
};

/**
 * Mengubah foto menjadi PNG siap-tempel: memenuhi kotak tanpa gepeng, dengan
 * sudut membulat yang tembus pandang.
 *
 * Mengembalikan null kalau gambarnya tidak bisa dibaca, supaya pemanggil bisa
 * memakai foto aslinya sebagai cadangan (lebih baik tampil apa adanya
 * daripada tidak tampil sama sekali).
 */
export async function siapkanFotoUntukKotak(
  data: Buffer,
  pilihan: PilihanFoto = {}
): Promise<Buffer | null> {
  const kotak = pilihan.kotak ?? KOTAK_FOTO;
  const radius = pilihan.radius ?? RADIUS_FOTO;
  const ppi = pilihan.pxPerInci ?? PX_PER_INCI;

  const lebar = Math.max(1, Math.round(kotak.w * ppi));
  const tinggi = Math.max(1, Math.round(kotak.h * ppi));
  const radiusPx = Math.round(radius * ppi);

  try {
    // resize + position 'attention' gagal kalau foto tanpa deteksi subjek?
    // Tidak: 'attention' selalu menghasilkan sesuatu. Tapi kita pakai
    // perhitungan sendiri supaya hasilnya dapat diprediksi (potong tengah),
    // sama seperti hitungPenempatanFoto di generator slide.
    const meta = await sharp(data).metadata();
    const lebarAsli = meta.width ?? 0;
    const tinggiAsli = meta.height ?? 0;
    if (!lebarAsli || !tinggiAsli) return null;

    const rasioFoto = lebarAsli / tinggiAsli;
    const rasioKotak = kotak.w / kotak.h;

    const skala =
      rasioFoto > rasioKotak
        ? tinggi / tinggiAsli          // foto lebih lebar: tinggi yang pas
        : lebar / lebarAsli;           // foto lebih tinggi: lebar yang pas

    const lebarSkala = Math.round(lebarAsli * skala);
    const tinggiSkala = Math.round(tinggiAsli * skala);

    const kiri = Math.max(0, Math.round((lebarSkala - lebar) / 2));
    // Sumbu tegak TIDAK dipotong rata: kelebihan dibuang ke bawah saja supaya
    // kepala/kepala bagian atas tidak hilang (aturan yang sama dengan
    // BAGIAN_POTONG_ATAS di potong-foto.ts). Potong-tengah pernah membuat
    // ubun-ubun petugas terpotong di slide ranking.
    const atas = Math.max(
      0,
      Math.round((tinggiSkala - tinggi) * BAGIAN_POTONG_ATAS)
    );

    const dasar = await sharp(data)
      .resize(lebarSkala, tinggiSkala, { fit: 'fill' })
      .extract({
        left: kiri,
        top: atas,
        width: Math.min(lebar, lebarSkala - kiri),
        height: Math.min(tinggi, tinggiSkala - atas),
      })
      .ensureAlpha()
      .toBuffer();

    // topeng sudut membulat
    const topeng = await sharp(topengSvg(lebar, tinggi, radiusPx))
      .ensureAlpha()
      .toBuffer();

    const hasil = await sharp(dasar)
      .composite([
        {
          input: topeng,
          blend: 'dest-in',   // simpan isi dasar hanya di area putih topeng
        },
      ])
      .png({ compressionLevel: 9 })
      .toBuffer();

    return hasil;
  } catch {
    return null;
  }
}
