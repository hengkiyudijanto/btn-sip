/**
 * Menyisipkan potongan gambar (crop) ke berkas PPTX.
 *
 * pptxgenjs tidak punya fitur crop asli: opsi `sizing: cover` hanya
 * menghasilkan gambar yang direntangkan memenuhi kotak (proporsinya berubah /
 * gepeng). Yang benar adalah atribut `<a:srcRect>` di dalam `<a:blipFill>` —
 * itulah cara PowerPoint menyimpan potongan gambar: gambar asli tetap utuh,
 * tapi bagian yang dipakai dinyatakan dalam persen.
 *
 * Modul ini membuka PPTX (yang sebetulnya berkas ZIP), menyunting XML tiap
 * slide, lalu menulisnya kembali.
 */

import JSZip from 'jszip';

export type Potongan = {
  /** sisi kiri yang dibuang, 0..1 */
  kiri?: number;
  /** sisi kanan yang dibuang, 0..1 */
  kanan?: number;
  /** sisi atas yang dibuang, 0..1 */
  atas?: number;
  /** sisi bawah yang dibuang, 0..1 */
  bawah?: number;
};

/** Ubah 0,125 -> "12500" (srcRect memakai 1/1000 persen). */
function keSeribuan(nilai: number | undefined): number {
  if (!nilai || nilai <= 0) return 0;
  return Math.round(Math.min(nilai, 0.9999) * 100000);
}

/**
 * Ganti seluruh `<a:srcRect .../>` di dalam berkas PPTX dengan nilai baru.
 *
 * Catatan: fungsi ini mengganti SEMUA srcRect di tiap slide dengan nilai yang
 * sama. Karena pada slide ranking hanya ada satu gambar yang perlu dipotong
 * (foto petugas) per slide, dan slide ringkasan tidak punya, penerapan per
 * slide dilakukan dengan memanggil fungsi ini pada slide tertentu saja
 * (lihat potongGambarPerSlide).
 */
export function selipkanSrcRect(xmlSlide: string, potongan: Potongan): string {
  const l = keSeribuan(potongan.kiri);
  const r = keSeribuan(potongan.kanan);
  const t = keSeribuan(potongan.atas);
  const b = keSeribuan(potongan.bawah);
  const rect = `<a:srcRect l="${l}" r="${r}" t="${t}" b="${b}"/>`;

  // Kalau sudah ada srcRect (mis. dari penyuntingan lain), cukup ganti nilainya.
  if (/<a:srcRect[^>]*\/>/.test(xmlSlide)) {
    return xmlSlide.replace(/<a:srcRect[^>]*\/>/, rect);
  }

  // pptxgenjs menulis blipFill seperti ini:
  //   <p:blipFill><a:blip r:embed="rId1"></a:blip>  <a:stretch>...
  // (tag <a:blip> berpasangan, BUKAN self-closing). srcRect harus berada
  // TEPAT SETELAH <a:blip>...</a:blip> dan SEBELUM <a:stretch>, karena
  // urutan itu yang diwajibkan skema OOXML.
  const pola = /(<a:blip\b[^>]*(?:\/>|>[\s\S]*?<\/a:blip>))/;
  if (pola.test(xmlSlide)) {
    return xmlSlide.replace(pola, `$1${rect}`);
  }

  return xmlSlide;
}

/**
 * Terapkan potongan ke slide tertentu saja (1 = slide pertama).
 *
 * @param berkasPptx isi berkas PPTX
 * @param perSlide    pemetaan nomor slide -> potongan; slide yang tidak
 *                    disebut tidak diubah
 */
export async function potongGambarPerSlide(
  berkasPptx: Buffer,
  perSlide: Map<number, Potongan>
): Promise<Buffer> {
  const zip = await JSZip.loadAsync(berkasPptx);

  for (const [nomor, potongan] of perSlide) {
    const nama = `ppt/slides/slide${nomor}.xml`;
    const berkas = zip.file(nama);
    if (!berkas) continue;
    const xml = await berkas.async('string');
    zip.file(nama, selipkanSrcRect(xml, potongan));
  }

  return zip.generateAsync({ type: 'nodebuffer' });
}
