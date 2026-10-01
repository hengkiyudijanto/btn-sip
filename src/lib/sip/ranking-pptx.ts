/**
 * Membangun PPTX "Service Drill Ranking" dengan pptxgenjs.
 *
 * Dipakai di route unduh (/laporan/ranking/pptx) supaya berjalan di Vercel.
 * Tata letaknya sengaja dibuat identik dengan scripts/buat-pptx-ranking.py
 * (versi Python untuk pemakaian lokal) — kalau salah satu diubah, ubah
 * keduanya supaya hasilnya tetap sama.
 *
 * Ukuran slide 16:9 (13,333 x 7,5 inci). Semua ukuran dalam inci.
 */

import PptxGenJS from 'pptxgenjs';
import type { DataRanking } from './ranking';

// ---- warna (sesuai lampiran Service Drill Ranking) ----
const BIRU_TUA = '0B2A8C';
const BIRU_MUDA = '2E5CD6';
const BIRU_BATANG = '1E4FC8';
const PUTIH = 'FFFFFF';
const MERAH = 'D4112E';

const WARNA_KATEGORI: Record<string, string> = {
  Istimewa: '00B050',
  'Sangat Baik': '66BB6A',
  Baik: 'F57C00',
  Cukup: 'FFC107',
  Kurang: 'E51B2B',
};

const LEBAR = 13.333;
const TINGGI = 7.5;

/** Nilai dengan koma desimal (format Indonesia). */
function angkaID(n: number): string {
  return n.toFixed(2).replace('.', ',');
}

function latar(slide: PptxGenJS.Slide) {
  slide.background = { color: BIRU_TUA };
  // pita merah melengkung di bawah
  slide.addShape('rect', {
    x: 0, y: TINGGI - 0.75, w: LEBAR, h: 0.75,
    fill: { color: MERAH }, line: { color: MERAH, width: 0 },
  });
  slide.addShape('ellipse', {
    x: -1.2, y: TINGGI - 1.15, w: LEBAR + 2.4, h: 0.9,
    fill: { color: MERAH }, line: { color: MERAH, width: 0 },
  });
}

function kopDanJudul(slide: PptxGenJS.Slide) {
  slide.addText('Danantara', {
    x: 0.35, y: 0.16, w: 2.0, h: 0.3,
    fontSize: 13, bold: true, color: PUTIH, fontFace: 'Arial',
  });
  slide.addText('Indonesia', {
    x: 0.35, y: 0.42, w: 2.0, h: 0.3,
    fontSize: 13, bold: true, color: PUTIH, fontFace: 'Arial',
  });
  slide.addText('btn', {
    x: LEBAR - 1.5, y: 0.22, w: 1.15, h: 0.55,
    fontSize: 34, bold: true, color: PUTIH, align: 'right', fontFace: 'Arial',
  });
  slide.addText('Service Drill Ranking', {
    x: 0, y: 0.26, w: LEBAR, h: 0.75,
    fontSize: 34, bold: true, color: PUTIH, align: 'center', fontFace: 'Arial',
  });
}

function legenda(slide: PptxGenJS.Slide) {
  slide.addShape('roundRect', {
    x: LEBAR / 2 - 0.92, y: TINGGI - 1.02, w: 1.85, h: 0.28,
    fill: { color: BIRU_MUDA }, line: { color: BIRU_MUDA, width: 0 },
    rectRadius: 0.12,
  });
  slide.addText('SKALA PENILAIAN', {
    x: LEBAR / 2 - 0.92, y: TINGGI - 1.02, w: 1.85, h: 0.28,
    fontSize: 9, bold: true, color: PUTIH, align: 'center', valign: 'middle',
    fontFace: 'Arial',
  });

  const panelKiri = LEBAR / 2 - 2.42;
  slide.addShape('roundRect', {
    x: panelKiri, y: TINGGI - 0.72, w: 4.85, h: 0.5,
    fill: { color: PUTIH }, line: { color: PUTIH, width: 0 }, rectRadius: 0.04,
  });

  const item: Array<[string, string]> = [
    ['4,80-5,00', 'Istimewa'],
    ['4,60-4,79', 'Sangat Baik'],
    ['4,00-4,59', 'Baik'],
    ['3,60-3,99', 'Cukup'],
    ['<3,59', 'Kurang'],
  ];

  item.forEach(([rentang, nama], i) => {
    const x = panelKiri + 0.22 + i * 0.95;
    slide.addShape('ellipse', {
      x, y: TINGGI - 0.60, w: 0.10, h: 0.10,
      fill: { color: WARNA_KATEGORI[nama] }, line: { color: WARNA_KATEGORI[nama], width: 0 },
    });
    slide.addText(rentang, {
      x: x + 0.14, y: TINGGI - 0.65, w: 0.78, h: 0.17,
      fontSize: 7, color: '333333', fontFace: 'Arial',
    });
    slide.addText(nama, {
      x: x + 0.14, y: TINGGI - 0.49, w: 0.78, h: 0.17,
      fontSize: 7, color: '333333', fontFace: 'Arial',
    });
  });
}

function slideRingkasan(prs: PptxGenJS, data: DataRanking) {
  const slide = prs.addSlide();
  latar(slide);
  kopDanJudul(slide);

  slide.addText(data.periode, {
    x: 0, y: 1.62, w: LEBAR, h: 0.4,
    fontSize: 18, color: PUTIH, align: 'center', fontFace: 'Arial',
  });

  const baris: Array<[string, string]> = [
    ['Jenis kantor', data.jenisKantor],
    ['Unit / cabang', data.unit],
    ['Posisi dinilai', data.posisi],
    ['Periode', data.periode],
    ['Jumlah peserta', String(data.jumlahPeserta)],
  ];

  baris.forEach(([label, nilai], i) => {
    const y = 2.6 + i * 0.52;
    slide.addText(label, {
      x: 3.9, y, w: 2.2, h: 0.4,
      fontSize: 14, color: PUTIH, align: 'right', fontFace: 'Arial',
    });
    slide.addText(': ' + nilai, {
      x: 6.2, y, w: 4.0, h: 0.4,
      fontSize: 14, bold: true, color: PUTIH, fontFace: 'Arial',
    });
  });
}

/** Satu slide ranking untuk satu kelompok (unit + posisi). */
function slideRanking(
  prs: PptxGenJS,
  kelompok: { unit: string; posisi: string; baris: DataRanking['kelompok'][number]['baris'] },
  petaFoto: Map<string, string>
) {
  const slide = prs.addSlide();
  latar(slide);
  kopDanJudul(slide);

  // kotak nama unit
  // kotak nama unit: bentuk roundRect terpisah + teks di atasnya, karena
  // teks ber-fill tidak membulatkan sudutnya dengan andal di pptxgenjs
  slide.addShape('roundRect', {
    x: LEBAR / 2 - 1.9, y: 1.15, w: 3.8, h: 0.5,
    fill: { color: BIRU_MUDA }, line: { color: BIRU_MUDA, width: 0 },
    rectRadius: 0.25,
  });
  slide.addText(kelompok.unit, {
    x: LEBAR / 2 - 1.9, y: 1.15, w: 3.8, h: 0.5,
    fontSize: 17, color: PUTIH, align: 'center', valign: 'middle',
    fontFace: 'Arial',
  });

  slide.addText(kelompok.posisi, {
    x: 0, y: 1.68, w: LEBAR, h: 0.35,
    fontSize: 15, color: PUTIH, align: 'center', fontFace: 'Arial',
  });

  const baris = kelompok.baris;
  if (baris.length === 0) {
    slide.addText('Belum ada penilaian pada filter ini.', {
      x: 0, y: 3.0, w: LEBAR, h: 0.5,
      fontSize: 16, color: PUTIH, align: 'center', fontFace: 'Arial',
    });
    legenda(slide);
    return;
  }

  // ---- tata letak grafik ----
  const atasAwal = 2.22;
  const tinggiBaris = 0.95;
  const fotoUkuran = 0.80;
  const xFoto = 0.68;
  const xNama = 1.68;
  const batangX = 3.12;
  const batangLebarMaks = 3.90;
  const tinggiBatang = 0.40;
  const xAngka = batangX + batangLebarMaks + 0.12;
  const xLabel = xAngka + 0.62;
  const nilaiMaks = 5.0;

  // garis tegak pemisah
  slide.addShape('rect', {
    x: batangX - 0.06, y: atasAwal - 0.02,
    w: 0.015, h: tinggiBaris * baris.length - 0.12,
    fill: { color: PUTIH }, line: { color: PUTIH, width: 0 },
  });

  baris.forEach((b, i) => {
    const atas = atasAwal + i * tinggiBaris;
    const tengah = atas + fotoUkuran / 2;

    // foto: bingkai putih + Gambar
    slide.addShape('roundRect', {
      x: xFoto, y: atas, w: fotoUkuran, h: fotoUkuran,
      fill: { color: PUTIH }, line: { color: PUTIH, width: 0 }, rectRadius: 0.05,
    });
    const foto = petaFoto.get(b.nip);
    if (foto) {
      slide.addImage({
        data: `data:image/jpeg;base64,${foto}`,
        x: xFoto + 0.05, y: atas + 0.05,
        w: fotoUkuran - 0.1, h: fotoUkuran - 0.1,
      });
    }

    // nama (satu baris)
    slide.addText(b.nama, {
      x: xNama, y: atas, w: 1.35, h: fotoUkuran,
      fontSize: 14, bold: true, color: PUTIH, fontFace: 'Arial',
      valign: 'middle', wrap: false, shrinkText: true,
    });

    // batang
    const panjang = Math.max(0.06, batangLebarMaks * (b.nilai / nilaiMaks));
    slide.addShape('rect', {
      x: batangX, y: tengah - tinggiBatang / 2,
      w: panjang, h: tinggiBatang,
      fill: { color: BIRU_BATANG }, line: { color: PUTIH, width: 0.75 },
    });

    // angka nilai
    slide.addText(angkaID(b.nilai), {
      x: xAngka, y: atas, w: 0.72, h: fotoUkuran,
      fontSize: 15, bold: true, color: PUTIH, align: 'right',
      valign: 'middle', fontFace: 'Arial',
    });

    // label kategori
    const kat = b.kategori;
    slide.addShape('roundRect', {
      x: xLabel, y: tengah - 0.22, w: 1.42, h: 0.44,
      fill: { color: WARNA_KATEGORI[kat] ?? WARNA_KATEGORI.Kurang },
      line: { color: WARNA_KATEGORI[kat] ?? WARNA_KATEGORI.Kurang, width: 0 },
      rectRadius: 0.22,
    });
    slide.addText(kat, {
      x: xLabel, y: tengah - 0.22, w: 1.42, h: 0.44,
      fontSize: 11, bold: true, color: PUTIH, align: 'center',
      valign: 'middle', fontFace: 'Arial',
    });
  });

  legenda(slide);
}

/** Bangun seluruh berkas PPTX, kembalikan sebagai Buffer. */
export async function bangunPptxRanking(
  data: DataRanking,
  petaFoto: Map<string, string>
): Promise<Buffer> {
  const prs = new PptxGenJS();
  prs.defineLayout({ name: 'LAYAR', width: LEBAR, height: TINGGI });
  prs.layout = 'LAYAR';

  slideRingkasan(prs, data);
  for (const k of data.kelompok) {
    slideRanking(prs, k, petaFoto);
  }

  const keluaran = await prs.write({ outputType: 'nodebuffer' });
  return keluaran as Buffer;
}
