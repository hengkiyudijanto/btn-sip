/**
 * Menguji penyiapan foto (potong + sudut membulat) untuk berbagai rasio.
 *
 * Tujuannya membuktikan:
 *   1. semua foto bisa diproses
 *   2. sudutnya benar-benar tembus pandang (alpha 0 di pojok)
 *   3. bagian tengahnya penuh (alpha 255)
 *   4. proporsi tidak gepeng
 */

import { readFileSync, writeFileSync } from 'node:fs';
import sharp from 'sharp';
import { siapkanFotoUntukKotak, KOTAK_FOTO } from '@/lib/sip/foto-bulat';

const KASUS = [
  'potret-sempit', 'potret-3-4', 'persegi',
  'sedikit-lebar', 'lebar', 'sangat-lebar',
];

async function main() {
  console.log(`kotak foto: ${KOTAK_FOTO.w} x ${KOTAK_FOTO.h} inci`);
  console.log('');

  let lulus = 0;
  let gagal = 0;

  for (const nama of KASUS) {
    const src = `/home/ubuntu/projects/btn-sip/foto-uji-rasio/${nama}.jpg`;
    const asli = readFileSync(src);
    const meta = await sharp(asli).metadata();

    const hasil = await siapkanFotoUntukKotak(asli);
    if (!hasil) {
      console.log(`  ${nama}: GAGAL diproses`);
      gagal += 1;
      continue;
    }

    const out = await sharp(hasil).metadata();
    const px = sharp(hasil);
    const { data, info } = await px.ensureAlpha().raw().toBuffer({ resolveWithObject: true });

    const alpha = (x: number, y: number) =>
      data[(y * info.width + x) * info.channels + 3];

    const pojokKiriAtas = alpha(0, 0);
    const pojokKananAtas = alpha(info.width - 1, 0);
    const pojokKiriBawah = alpha(0, info.height - 1);
    const pojokKananBawah = alpha(info.width - 1, info.height - 1);
    const tengah = alpha(Math.floor(info.width / 2), Math.floor(info.height / 2));

    const sudutTransparan =
      pojokKiriAtas === 0 && pojokKananAtas === 0 &&
      pojokKiriBawah === 0 && pojokKananBawah === 0;
    const tengahPenuh = tengah === 255;
    const rasioBenar = Math.abs(out.width / out.height - KOTAK_FOTO.w / KOTAK_FOTO.h) < 0.01;

    const ok = sudutTransparan && tengahPenuh && rasioBenar;
    if (ok) lulus += 1; else gagal += 1;

    console.log(
      `  ${nama.padEnd(15)} ${meta.width}x${meta.height} -> ${out.width}x${out.height}  ` +
      `sudut=${sudutTransparan ? 'transparan' : `PENUH(${pojokKiriAtas})`}  ` +
      `tengah=${tengahPenuh ? 'penuh' : `alpha ${tengah}`}  ` +
      `rasio=${rasioBenar ? 'benar' : 'SALAH'}  ${ok ? 'OK' : 'GAGAL'}`
    );

    writeFileSync(`/home/ubuntu/projects/btn-sip/foto-uji-rasio/bulat-${nama}.png`, hasil);
  }

  console.log('');
  console.log(`=== HASIL: ${lulus} OK, ${gagal} gagal ===`);

  // bandingkan dengan hasil Python (kalau ada)
  try {
    const py = readFileSync('/home/ubuntu/projects/btn-sip/foto-uji-rasio/hasil-bulat.png');
    const pyMeta = await sharp(py).metadata();
    const ts = readFileSync('/home/ubuntu/projects/btn-sip/foto-uji-rasio/bulat-potret-sempit.png');
    const tsMeta = await sharp(ts).metadata();
    console.log('');
    console.log('perbandingan dengan hasil Python (potret-sempit):');
    console.log(`  python : ${pyMeta.width}x${pyMeta.height}`);
    console.log(`  node   : ${tsMeta.width}x${tsMeta.height}`);
  } catch {
    // abaikan
  }
}

main();
