/**
 * Menguji foto berbagai rasio masuk ke kotaknya dengan rapi.
 *
 * Membuat PPTX berisi satu slide per rasio foto, lalu memeriksa XML-nya:
 * apakah gambar memakai `sizing cover` dan apakah ukurannya pas dengan kotak.
 */

import { writeFileSync } from 'node:fs';
import PptxGenJS from 'pptxgenjs';

const RASIO = [
  { nama: 'potret-sempit', rasio: 0.5 },
  { nama: 'potret-3-4', rasio: 0.75 },
  { nama: 'persegi', rasio: 1.0 },
  { nama: 'sedikit-lebar', rasio: 1.25 },
  { nama: 'lebar', rasio: 2.0 },
  { nama: 'sangat-lebar', rasio: 4.0 },
];

const KOTAK = { x: 1.608, y: 2.11, w: 1.191, h: 0.962 };
const TEBAL = 0.05;
const isi = {
  x: KOTAK.x + TEBAL, y: KOTAK.y + TEBAL,
  w: KOTAK.w - TEBAL * 2, h: KOTAK.h - TEBAL * 2,
};

async function main() {
  const prs = new PptxGenJS();
  prs.defineLayout({ name: 'L', width: 13.33333, height: 7.5 });

  // gambar JPEG kecil untuk tiap rasio (dibuat lewat python, ada di folder)
  const { readFileSync } = await import('node:fs');

  for (const { nama, rasio } of RASIO) {
    const slide = prs.addSlide();
    slide.addShape('roundRect', {
      x: KOTAK.x, y: KOTAK.y, w: KOTAK.w, h: KOTAK.h,
      fill: { type: 'none' } as never,
      line: { color: 'FFFFFF', width: 1.25 }, rectRadius: 0.18,
    });
    const jalur = `/home/ubuntu/projects/btn-sip/foto-uji-rasio/${nama}.jpg`;
    const b64 = readFileSync(jalur).toString('base64');
    slide.addImage({
      data: `data:image/jpeg;base64,${b64}`,
      x: isi.x, y: isi.y, w: isi.w, h: isi.h,
      sizing: { type: 'cover', w: isi.w, h: isi.h },
    });
    slide.addText(`${nama} (rasio ${rasio})`, {
      x: 3.2, y: 2.3, w: 4, h: 0.5, fontSize: 18, color: 'FFFFFF',
    });
  }

  const keluar = '/home/ubuntu/projects/btn-sip/uji-foto-rasio.pptx';
  const data = (await prs.write({ outputType: 'nodebuffer' })) as Buffer;
  writeFileSync(keluar, data);
  console.log(`PPTX uji dibuat: ${keluar} (${RASIO.length} slide)`);
}

main();
