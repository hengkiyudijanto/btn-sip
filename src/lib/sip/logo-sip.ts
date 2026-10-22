import { BENTUK_BUSUR, BENTUK_LURUS, LOGO_SIP_TEBAL, LOGO_SIP_WARNA, busurPath } from '@/components/logo-sip';

/**
 * Logo SIP sebagai teks SVG — untuk berkas yang dirender di server (PDF cetak,
 * PPTX, gambar ranking) yang tidak bisa memakai komponen React.
 *
 * Bentuk hurufnya SAMA dengan komponen `LogoSIP`: sumbernya satu, yaitu
 * BENTUK_LURUS & BENTUK_BUSUR, jadi tidak mungkin kedua tempat berbeda bentuk.
 *
 * @param tinggi tinggi kotak logo (satuan bebas — samakan dengan pemanggil)
 * @param warna  warna huruf; default biru korporat
 * @param aksen  warna aksen miring; default merah
 */
export function svgLogoSIP(
  tinggi: number,
  warna: string = LOGO_SIP_WARNA.huruf,
  aksen: string = LOGO_SIP_WARNA.aksen
): string {
  const lebar = (tinggi * 96) / 40;
  const busur = BENTUK_BUSUR.map(
    ([cx, cy, r]) => `<path d="${busurPath(cx, cy, r)}"/>`
  ).join('');
  const lurus = BENTUK_LURUS.map(
    ([x1, y1, x2, y2]) =>
      `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke-width="${LOGO_SIP_TEBAL}"/>`
  ).join('');

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 40" width="${lebar}" height="${tinggi}">` +
    `<g fill="${warna}" stroke="${warna}">${busur}${lurus}</g>` +
    `<path d="M55.5 15.5 81.5 1.2 85.8 9.5 59.8 23.8z" fill="${aksen}" stroke="none"/>` +
    `</svg>`
  );
}
