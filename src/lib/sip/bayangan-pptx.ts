/**
 * Memperbaiki nilai efek bayangan pada PPTX hasil pptxgenjs.
 *
 * Bug yang ditemukan: opsi `shadow` milik pptxgenjs mengalikan satuan
 * pt -> EMU DUA KALI. Untuk blur 6 pt, yang seharusnya 76.200 EMU, tertulis
 * 12.290.298.000.000 EMU — sekitar 161 juta kali terlalu besar (12700^2).
 * Akibatnya bayangannya tidak terlihat sama sekali (atau menyebar tak
 * terhingga) di penampil.
 *
 * Perbaikannya: setelah berkas PPTX jadi, buka XML tiap slide dan hitung
 * ulang `blurRad` serta `dist` dari angka yang benar. Nilai yang dipakai
 * disimpan di tabel tetap supaya bisa diaudit — bukan ditebak dari nilai
 * yang rusak (nilai rusak sudah tidak bisa dibalik dengan pasti karena
 * pembulatannya hilang).
 */

import JSZip from 'jszip';

/** Nilai bayangan yang benar, dalam pt. */
export const BAYANGAN_PT = {
  /** Radius pengaburan. */
  blur: 5,
  /** Jarak geser bayangan. */
  jarak: 2,
  /** Arah: 5400000 = 90 derajat (ke bawah), satuan 1/60000 derajat. */
  arah: 5400000,
  /** Kepekatan 0..1. */
  alfa: 0.45,
} as const;

const EMU_PER_PT = 12700;

/**
 * Membetulkan seluruh `<a:outerShdw>` di satu XML slide.
 *
 * Hanya menyentuh `blurRad` dan `dist` — atribut lain (arah, warna, alfa)
 * dibiarkan seperti yang ditulis pptxgenjs karena sudah benar.
 */
export function perbaikiEfekBayangan(xmlSlide: string): string {
  const blurRad = Math.round(BAYANGAN_PT.blur * EMU_PER_PT);
  const dist = Math.round(BAYANGAN_PT.jarak * EMU_PER_PT);
  const dir = BAYANGAN_PT.arah;
  const alfa = Math.round(BAYANGAN_PT.alfa * 100000);

  return xmlSlide.replace(
    /<a:outerShdw\b([^>]*)>([\s\S]*?)<\/a:outerShdw>/g,
    (_utuh, atribut: string, isi: string) => {
      let baru = atribut;
      // ganti blurRad
      baru = /\bblurRad="[^"]*"/.test(baru)
        ? baru.replace(/\bblurRad="[^"]*"/, `blurRad="${blurRad}"`)
        : `${baru} blurRad="${blurRad}"`;
      // ganti dist
      baru = /\bdist="[^"]*"/.test(baru)
        ? baru.replace(/\bdist="[^"]*"/, `dist="${dist}"`)
        : `${baru} dist="${dist}"`;
      // ganti arah (juga dikalikan dua kali oleh pptxgenjs)
      baru = /\bdir="[^"]*"/.test(baru)
        ? baru.replace(/\bdir="[^"]*"/, `dir="${dir}"`)
        : `${baru} dir="${dir}"`;

      // ganti kepekatan warna bayangan: <a:alpha val="..."/>
      const isiBaru = isi.replace(
        /<a:alpha\b[^>]*\/>/,
        `<a:alpha val="${alfa}"/>`
      );

      return `<a:outerShdw${baru}>${isiBaru}</a:outerShdw>`;
    }
  );
}

/**
 * Menerapkan perbaikan ke seluruh slide di dalam berkas PPTX.
 * Kalau tidak ada bayangan sama sekali, berkas dikembalikan apa adanya.
 */
export async function perbaikiEfekBayanganPptx(
  berkasPptx: Buffer
): Promise<Buffer> {
  const zip = await JSZip.loadAsync(berkasPptx);
  let adaPerubahan = false;

  const namaSlide = Object.keys(zip.files).filter((f) =>
    /^ppt\/slides\/slide\d+\.xml$/.test(f)
  );

  for (const nama of namaSlide) {
    const berkas = zip.file(nama);
    if (!berkas) continue;
    const xml = await berkas.async('string');
    if (!xml.includes('<a:outerShdw')) continue;
    const baru = perbaikiEfekBayangan(xml);
    if (baru !== xml) {
      zip.file(nama, baru);
      adaPerubahan = true;
    }
  }

  if (!adaPerubahan) return berkasPptx;
  return zip.generateAsync({ type: 'nodebuffer' });
}
