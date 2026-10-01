/**
 * Uji nyata: bangun PPTX dengan foto berbagai rasio, lalu periksa srcRect
 * yang dihasilkan. Membuktikan foto tidak gepeng (proporsinya dijaga) dan
 * bagian yang dipotong benar.
 */

import { writeFileSync, readFileSync } from 'node:fs';
import JSZip from 'jszip';
import { potongGambarPerSlide, type Potongan } from '@/lib/sip/potong-gambar-pptx';
import { hitungPenempatanFoto, rasioFotoJpeg } from '@/lib/sip/potong-foto';

const KOTAK = { x: 1.608, y: 2.11, w: 1.191, h: 0.962 };
const TEBAL = 0.05;
const isi = {
  x: KOTAK.x + TEBAL, y: KOTAK.y + TEBAL,
  w: KOTAK.w - TEBAL * 2, h: KOTAK.h - TEBAL * 2,
};

const BERKAS = [
  'potret-sempit', 'potret-3-4', 'persegi',
  'sedikit-lebar', 'lebar', 'sangat-lebar',
];

async function main() {
  // 1. bangun PPTX dasar (foto direntangkan penuh, seperti sebelumnya)
  const PptxGenJS = (await import('pptxgenjs')).default;
  const prs = new PptxGenJS();
  prs.defineLayout({ name: 'L', width: 13.33333, height: 7.5 });
  prs.layout = 'L';

  const potongan = new Map<number, Potongan>();

  const rencana: Array<{ nama: string; rasioBaca: number | null; potong: unknown }> = [];

  for (let i = 0; i < BERKAS.length; i++) {
    const nama = BERKAS[i];
    const slide = prs.addSlide();
    const b64 = readFileSync(`/home/ubuntu/projects/btn-sip/foto-uji-rasio/${nama}.jpg`).toString('base64');

    slide.addShape('roundRect', {
      x: KOTAK.x, y: KOTAK.y, w: KOTAK.w, h: KOTAK.h,
      fill: { color: '0B2A8C' }, line: { color: 'FFFFFF', width: 1.25 },
      rectRadius: 0.18,
    });
    slide.addImage({
      data: `data:image/jpeg;base64,${b64}`,
      x: isi.x, y: isi.y, w: isi.w, h: isi.h,
    });

    const rasio = rasioFotoJpeg(b64);
    const tempat = hitungPenempatanFoto(isi, rasio ?? isi.w / isi.h);
    potongan.set(i + 1, {
      kiri: tempat.potongKiri, kanan: tempat.potongKanan,
      atas: tempat.potongAtas, bawah: tempat.potongBawah,
    });
    rencana.push({ nama, rasioBaca: rasio, potong: tempat });

    slide.addText(`${nama}`, {
      x: 3.4, y: 2.3, w: 5, h: 0.5, fontSize: 18, color: 'FFFFFF',
    });
  }

  const dasar = (await prs.write({ outputType: 'nodebuffer' })) as Buffer;
  const akhir = await potongGambarPerSlide(dasar, potongan);
  writeFileSync('/home/ubuntu/projects/btn-sip/uji-foto-cover2.pptx', akhir);

  // 2. periksa hasilnya
  console.log('=== rencana potongan ===\n');
  for (const r of rencana) {
    const t = r.potong as ReturnType<typeof hitungPenempatanFoto>;
    console.log(`${r.nama.padEnd(16)} rasio baca=${(r.rasioBaca ?? 0).toFixed(3)}`);
    console.log(`   potong kiri/kanan : ${(t.potongKiri * 100).toFixed(1)}% / ${(t.potongKanan * 100).toFixed(1)}%`);
    console.log(`   potong atas/bawah : ${(t.potongAtas * 100).toFixed(1)}% / ${(t.potongBawah * 100).toFixed(1)}%`);
  }

  console.log('\n=== srcRect yang tertulis di PPTX ===\n');
  const zip = await JSZip.loadAsync(akhir);
  for (let i = 1; i <= BERKAS.length; i++) {
    const xml = await zip.file(`ppt/slides/slide${i}.xml`)!.async('string');
    const m = xml.match(/<a:srcRect[^/]*\/>/);
    console.log(`  slide${i} (${BERKAS[i - 1]}): ${m ? m[0] : '(tidak ada)'}`);
  }
}

main();
