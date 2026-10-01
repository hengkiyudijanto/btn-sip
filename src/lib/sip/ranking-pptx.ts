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

/**
 * Logo Danantara Indonesia, ditanam sebagai base64 supaya ikut di dalam
 * berkas PPTX. Kalau hanya merujuk berkas di public/, PPTX yang diunduh
 * pengguna akan kehilangan logonya saat dibuka di komputer lain.
 */
const LOGO_DANANTARA =
  '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5FtY14n3Yz9gSR13I2xUwcXlf318xyBJ0vH3dZ26DWto+0est8H+KfZ1G3bMV6XI27fKy70Hm5g17Qiau7AuTd+lft9A3+etbS3OY6NR3oi1zvsKHrdgHaNXY+f3UeKnRXs98G+ebbVNw891lL1KFqtzOg4bPD8P+xKsw1ouV9H+CSP6sNLTC7GgUZlccwv2pbkb/zyI3epwrOvPgYyVvPLY8Ms/YJ8pzUw49WSxzuhHYX0J52GtwhFjx+0eLAh1apRMFuvisgJ4Tvn/t2OPbb2tg/sVERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERgP8BKWcna2IulQEAAAAASUVORK5CYII=';

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
  // Logo Danantara berlatar putih, sedangkan slide biru tua — karena itu
  // ditempel di atas kotak putih membulat supaya menyatu (seperti lampiran).
  // Logo Danantara rasionya PERSEGI (1:1). Kotak putihnya harus persegi
  // juga — kalau tidak, logonya gepeng.
  slide.addShape('roundRect', {
    x: 0.3, y: 0.22, w: 0.78, h: 0.78,
    fill: { color: PUTIH }, line: { color: PUTIH, width: 0 },
    rectRadius: 0.12,
  });
  slide.addImage({
    data: `data:image/png;base64,${LOGO_DANANTARA}`,
    x: 0.34, y: 0.26, w: 0.70, h: 0.70,
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
