/**
 * Menghitung cara menempatkan foto ke dalam kotak supaya:
 *   1. seluruh kotak terisi (tidak ada bagian kosong),
 *   2. proporsi foto TIDAK gepeng (skala x dan y sama),
 *   3. kelebihannya dipotong rata kanan-kiri dan atas-bawah (crop tengah).
 *
 * Cara kerjanya sama seperti CSS `object-fit: cover`: foto diskalakan sampai
 * sisi terpendeknya menutupi kotak, lalu bagian yang lebih dipotong.
 *
 * pptxgenjs tidak punya fitur crop bawaan, jadi fungsi ini menghasilkan
 * koordinat gambar yang LEBIH BESAR dari kotaknya; pemotongannya dilakukan
 * oleh kotak penutup (bingkai foto berlatar yang digambar setelahnya), atau
 * oleh `sizing: 'cover'` bila tersedia.
 */

export type KotakFoto = {
  /** Titik & ukuran kotak tempat foto harus muat (inci). */
  x: number;
  y: number;
  w: number;
  h: number;
};

export type PenempatanFoto = {
  /** Posisi & ukuran gambar yang harus diberikan ke slide.addImage (inci). */
  x: number;
  y: number;
  w: number;
  h: number;
  /** Berapa bagian foto yang terpotong di tiap sisi (0..1). */
  potongKiri: number;
  potongKanan: number;
  potongAtas: number;
  potongBawah: number;
};

/**
 * Bagian kelebihan foto yang dipotong di sisi ATAS saat foto lebih tinggi
 * dari kotaknya. Tidak dipotong rata: potret orang hampir selalu menaruh
 * kepala di bagian atas, dan potong-tengah membuang separuh dahi/kepala.
 * Nilai 0 = tidak dipotong sama sekali di atas (kepala utuh), 0,5 = tengah.
 */
export const BAGIAN_POTONG_ATAS = 0;

/**
 * @param kotak      kotak tujuan di slide
 * @param rasioFoto  lebar/tinggi foto aslinya (mis. 0,75 untuk potret 3:4)
 */
export function hitungPenempatanFoto(
  kotak: KotakFoto,
  rasioFoto: number
): PenempatanFoto {
  const rasioKotak = kotak.w / kotak.h;

  if (!Number.isFinite(rasioFoto) || rasioFoto <= 0) {
    // rasio tidak diketahui: taruh apa adanya memenuhi kotak
    return {
      x: kotak.x, y: kotak.y, w: kotak.w, h: kotak.h,
      potongKiri: 0, potongKanan: 0, potongAtas: 0, potongBawah: 0,
    };
  }

  let gambarW: number;
  let gambarH: number;

  if (rasioFoto > rasioKotak) {
    // foto lebih LEBAR dari kotak -> tinggi yang menentukan, sisi kiri-kanan
    // kelebihan dan dipotong
    gambarH = kotak.h;
    gambarW = kotak.h * rasioFoto;
  } else {
    // foto lebih TINGGI dari kotak -> lebar yang menentukan, sisi atas-bawah
    // kelebihan dan dipotong
    gambarW = kotak.w;
    gambarH = kotak.w / rasioFoto;
  }

  // Sisi kiri-kanan tetap dipotong rata (wajah ada di tengah).
  const x = kotak.x - (gambarW - kotak.w) / 2;

  // Sumbu tegak sengaja TIDAK rata: kelebihan dibuang ke BAWAH saja supaya
  // ubun-ubun dan dahi tidak ikut terpotong (lihat BAGIAN_POTONG_ATAS).
  const y = kotak.y - (gambarH - kotak.h) * BAGIAN_POTONG_ATAS;

  const potongTotalW = gambarW - kotak.w;
  const potongTotalH = gambarH - kotak.h;

  return {
    x, y, w: gambarW, h: gambarH,
    potongKiri: potongTotalW / 2 / gambarW,
    potongKanan: potongTotalW / 2 / gambarW,
    potongAtas: (potongTotalH * BAGIAN_POTONG_ATAS) / gambarH,
    potongBawah: (potongTotalH * (1 - BAGIAN_POTONG_ATAS)) / gambarH,
  };
}

/**
 * Membaca rasio (lebar/tinggi) sebuah foto JPEG dari data base64-nya.
 *
 * Hanya perlu membaca beberapa byte pertama, tapi untuk sederhana dan aman
 * seluruh buffer dipakai. Mengembalikan null kalau ukurannya tidak terbaca,
 * supaya pemanggil bisa memakai jalur cadangan.
 */
export function rasioFotoJpeg(base64: string): number | null {
  let buf: Buffer;
  try {
    buf = Buffer.from(base64, 'base64');
  } catch {
    return null;
  }
  return rasioDariBuffer(buf);
}

/** Bagian yang bisa diuji tanpa Node Buffer (menerima Uint8Array). */
export function rasioDariBuffer(buf: Uint8Array): number | null {
  if (buf.length < 4) return null;
  // penanda JPEG
  if (buf[0] !== 0xff || buf[1] !== 0xd8) return null;

  let i = 2;
  while (i + 9 < buf.length) {
    if (buf[i] !== 0xff) {
      i++;
      continue;
    }
    const penanda = buf[i + 1];

    // penanda yang tidak punya panjang (SOI, EOI, RSTn)
    if (penanda === 0xd8 || penanda === 0xd9 || (penanda >= 0xd0 && penanda <= 0xd7)) {
      i += 2;
      continue;
    }

    const panjang = (buf[i + 2] << 8) | buf[i + 3];
    // SOF0..SOF15 (kecuali DHT=0xc4, JPG=0xc8, DAC=0xcc)
    const sof = penanda >= 0xc0 && penanda <= 0xcf
      && penanda !== 0xc4 && penanda !== 0xc8 && penanda !== 0xcc;
    if (sof) {
      const tinggi = (buf[i + 5] << 8) | buf[i + 6];
      const lebar = (buf[i + 7] << 8) | buf[i + 8];
      if (lebar > 0 && tinggi > 0) return lebar / tinggi;
      return null;
    }

    if (panjang < 2) return null;
    i += 2 + panjang;
  }
  return null;
}
