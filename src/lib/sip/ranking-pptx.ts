/**
 * Membangun PPTX "Service Drill Ranking" dengan pptxgenjs.
 *
 * TATA LETAK DISALIN DARI FILE ASLI USER (sip.pptx), bukan ditiru dari
 * gambar. Angka posisi di bawah dibaca dari ppt/slides/slide2.xml lewat
 * scripts/ekstrak-tata-letak.py — kalau perlu disesuaikan, ambil ulang
 * angkanya dari file itu, jangan dikira-kira.
 *
 * Angka penting dari file asli (inci):
 *   Background (Picture 2)   0,000 ; -0,031   13,333 x 7,641
 *   Logo Danantara (Pic 7)   0,542 ;  0,441    1,777 x 0,442
 *   Logo btn (Picture 9)    11,294 ; -0,081    1,498 x 1,486
 *   Judul (TextBox 16)       3,576 ;  0,344    6,225 x 0,841
 *   Kotak unit (Group 20)    5,039 ;  1,259    3,271 x 0,505
 *   Nama posisi (TxtBox 13)  5,219 ;  1,839    2,896 x 0,404
 *   Legenda (Group 5)        3,098 ;  6,477    6,861 x 0,990
 *   Daftar (Group 98)        1,593 ;  1,965    9,454 x 4,604
 *   Kotak foto (Pic 24)      1,608 ;  2,110    1,191 x 0,962
 *
 * Perbedaan yang SENGAJA dari file asli:
 *   - Judul di file asli ditulis "Service Drill" lalu ada kotak putih berisi
 *     "Ranking" bertumpuk di atasnya, sehingga saling menimpa dan terbaca
 *     seperti cacat cetak. Di sini ditulis rapi satu kesatuan.
 */

import PptxGenJS from 'pptxgenjs';
import type { DataRanking } from './ranking';
import { BACKGROUND, LOGO_DANANTARA, LOGO_BTN } from './ranking-gambar';

// ---- warna ----
const BIRU_TUA = '1226AA';
const BIRU_KOTAK_NAMA = '2E4FD6';
const PUTIH = 'FFFFFF';

const WARNA_KATEGORI: Record<string, string> = {
  Istimewa: '00B050',
  'Sangat Baik': '66BB6A',
  Baik: 'F57C00',
  Cukup: 'FFC107',
  Kurang: 'E51B2B',
};

// ---- ukuran slide (dari file asli: 12192000 x 6858000 EMU) ----
const LEBAR = 13.3333;
const TINGGI = 7.5;

/**
 * Font isi slide.
 *
 * Aptos adalah font bawaan Microsoft 365 / Office 2023+. PPTX hanya menyimpan
 * NAMA font, bukan gambar hurufnya — jadi berkas ini akan memakai Aptos asli
 * saat dibuka di komputer yang punya font itu.
 *
 * Catatan: font ini TIDAK ada di server Linux tempat uji coba, sehingga
 * pratinjau render memakai font pengganti. Hasil di komputer user tetap
 * Aptos selama Microsoft Office-nya versi terbaru.
 */
const FONT = 'Aptos';

// ---- ukuran huruf (pt) — DIAMBIL DARI FILE ASLI via ekstrak-font-pptx.py ----
//
//   Judul "Service Drill Ranking"   44 pt  tebal
//   Nama unit (kotak)               20 pt  Poppins   <-- font berbeda
//   Nama posisi                     +mj-lt (ikut tema)
//   Legenda: rentang angka          10 pt  tebal
//   Legenda: nama kategori           8,5 pt biasa
//   Pil kategori (Istimewa/Kurang)  12 pt  tebal
//
// Kelima baris terakhir adalah hasil pengukuran dari file asli, bukan
// perkiraan. Kalau file aslinya berubah, jalankan ulang
// scripts/ekstrak-font-pptx.py lalu sesuaikan angka di bawah.
const F_JUDUL = 44;
const F_POSISI = 24;
const F_NAMA = 20;
const F_NILAI = 20;
const F_KATEGORI = 12;
const F_LEGENDA_ANGKA = 10;
const F_LEGENDA_NAMA = 8.5;

/** Nama unit memakai Poppins (berbeda dari isi slide yang memakai Aptos). */
const FONT_UNIT = 'Poppins';
const F_UNIT = 20;

/** Nilai dengan koma desimal (format Indonesia). */
function angkaID(n: number): string {
  return n.toFixed(2).replace('.', ',');
}

function latar(slide: PptxGenJS.Slide) {
  slide.background = { color: BIRU_TUA };
  // background menonjol 0,031 inci ke atas supaya pita merahnya tepat
  // menyentuh tepi bawah slide (persis seperti file asli)
  slide.addImage({
    data: `data:image/png;base64,${BACKGROUND}`,
    x: 0, y: -0.031, w: LEBAR, h: 7.641,
  });
}

/** Kop slide: dua logo, judul, kotak unit, nama posisi. */
function kop(slide: PptxGenJS.Slide, unit: string, posisi: string) {
  slide.addImage({
    data: `data:image/png;base64,${LOGO_DANANTARA}`,
    x: 0.542, y: 0.441, w: 1.777, h: 0.442,
  });

  slide.addImage({
    data: `data:image/png;base64,${LOGO_BTN}`,
    x: 11.294, y: -0.081, w: 1.498, h: 1.486,
  });

  slide.addText('Service Drill Ranking', {
    x: 3.576, y: 0.344, w: 6.225, h: 0.841,
    fontSize: F_JUDUL, bold: true, color: PUTIH, align: 'center',
    valign: 'middle', fontFace: FONT, shrinkText: true,
  });

  // Kotak nama unit: latar TRANSPARAN (background di baliknya terlihat),
  // hanya bergaris putih. Font Poppins sesuai file asli.
  slide.addShape('roundRect', {
    x: 5.039, y: 1.259, w: 3.271, h: 0.505,
    fill: { type: 'none' } as never,
    line: { color: PUTIH, width: 1.25 }, rectRadius: 0.10,
  });
  slide.addText(unit, {
    x: 5.039, y: 1.259, w: 3.271, h: 0.505,
    fontSize: F_UNIT, bold: true, color: PUTIH, align: 'center',
    valign: 'middle', fontFace: FONT_UNIT, shrinkText: true,
  });

  slide.addText(posisi, {
    x: 5.219, y: 1.839, w: 2.896, h: 0.404,
    fontSize: F_POSISI, color: PUTIH, align: 'center', valign: 'middle',
    fontFace: FONT, shrinkText: true,
  });
}

/** Legenda SKALA PENILAIAN (posisi dari file asli). */
function legenda(slide: PptxGenJS.Slide) {
  const x0 = 3.098;
  const y0 = 6.477;
  const wPanel = 6.861;
  const hPanel = 0.99;

  // URUTAN PENTING: panel putih digambar LEBIH DULU, label biru
  // "SKALA PENILAIAN" digambar SETELAHNYA supaya tidak tertutup panel.
  slide.addShape('roundRect', {
    x: x0, y: y0, w: wPanel, h: hPanel,
    fill: { color: PUTIH }, line: { color: PUTIH, width: 0 },
    rectRadius: 0.06,
  });

  slide.addShape('roundRect', {
    x: x0 + wPanel / 2 - 0.95, y: y0 - 0.19, w: 1.9, h: 0.30,
    fill: { color: BIRU_KOTAK_NAMA },
    line: { color: BIRU_KOTAK_NAMA, width: 0 }, rectRadius: 0.10,
  });
  slide.addText('SKALA PENILAIAN', {
    x: x0 + wPanel / 2 - 0.95, y: y0 - 0.19, w: 1.9, h: 0.30,
    fontSize: 10, bold: true, color: PUTIH, align: 'center',
    valign: 'middle', fontFace: FONT,
  });

  const item: Array<[string, string]> = [
    ['4,80-5,00', 'Istimewa'],
    ['4,60-4,79', 'Sangat Baik'],
    ['4,00-4,59', 'Baik'],
    ['3,60-3,99', 'Cukup'],
    ['<3,59', 'Kurang'],
  ];

  const lebarItem = wPanel / item.length;
  item.forEach(([rentang, nama], i) => {
    const x = x0 + i * lebarItem + 0.10;
    slide.addShape('ellipse', {
      x, y: y0 + 0.30, w: 0.13, h: 0.13,
      fill: { color: WARNA_KATEGORI[nama] },
      line: { color: WARNA_KATEGORI[nama], width: 0 },
    });
    slide.addText(rentang, {
      x: x + 0.16, y: y0 + 0.20, w: lebarItem - 0.22, h: 0.24,
      fontSize: F_LEGENDA_ANGKA, bold: true, color: '142D64',
      valign: 'middle', fontFace: FONT, shrinkText: true,
    });
    slide.addText(nama, {
      x: x + 0.16, y: y0 + 0.44, w: lebarItem - 0.22, h: 0.26,
      fontSize: F_LEGENDA_NAMA, color: '142D64',
      valign: 'middle', fontFace: FONT, shrinkText: true,
    });
  });
}

/** Satu slide ranking untuk satu kelompok (unit + posisi). */
function slideRanking(
  prs: PptxGenJS,
  kelompok: DataRanking['kelompok'][number],
  petaFoto: Map<string, string>
) {
  const slide = prs.addSlide();
  latar(slide);
  kop(slide, kelompok.unit, kelompok.posisi);

  const baris = kelompok.baris;
  const xGaris = 4.09;
  const xFoto = 1.608;
  const wFoto = 1.191;
  const hFoto = 0.962;
  const xNama = 4.10;
  const yAwal = 2.110;
  const jarakStandar = 0.962;
  // kalau lebih dari 4 orang, baris dirapatkan supaya tetap dalam area daftar
  const tinggiArea = 4.604;
  const jarak = baris.length > 4 ? tinggiArea / baris.length : jarakStandar;

  const xKotak = 4.09;
  const wKotak = 5.06;
  const xKategori = 9.78;
  const wKategori = 1.32;

  // garis tegak pemisah
  const tinggiGaris = baris.length <= 1 ? 0.6 : (baris.length - 1) * jarak + 0.55;
  slide.addShape('rect', {
    x: xGaris, y: yAwal + 0.10, w: 0.01, h: Math.max(0.5, tinggiGaris),
    fill: { color: PUTIH }, line: { color: PUTIH, width: 0 },
  });

  baris.forEach((b, i) => {
    const y = yAwal + i * jarak;

    // foto: bingkai + gambar (foto penilaian periode ini)
    slide.addShape('roundRect', {
      x: xFoto, y, w: wFoto, h: hFoto,
      fill: { color: BIRU_KOTAK_NAMA }, line: { color: PUTIH, width: 1.25 },
      rectRadius: 0.18,
    });
    const foto = petaFoto.get(b.nip);
    if (foto) {
      slide.addImage({
        data: `data:image/jpeg;base64,${foto}`,
        x: xFoto + 0.05, y: y + 0.05, w: wFoto - 0.10, h: hFoto - 0.10,
      });
    }

    // nama
    slide.addText(b.nama, {
      x: xNama, y, w: 2.3, h: hFoto,
      fontSize: F_NAMA, bold: true, color: PUTIH, valign: 'middle',
      fontFace: FONT, wrap: false, shrinkText: true,
    });

    // kotak nilai: latar biru, garis putih
    slide.addShape('rect', {
      x: xKotak, y: y + hFoto / 2 - 0.20, w: wKotak, h: 0.40,
      fill: { color: BIRU_TUA }, line: { color: PUTIH, width: 1 },
    });
    slide.addText(angkaID(b.nilai), {
      x: xKotak, y: y + hFoto / 2 - 0.20, w: wKotak - 0.10, h: 0.40,
      fontSize: F_NILAI, bold: true, color: PUTIH, align: 'right',
      valign: 'middle', fontFace: FONT,
    });

    // pil kategori
    const kat = b.kategori;
    slide.addShape('roundRect', {
      x: xKategori, y: y + hFoto / 2 - 0.26, w: wKategori, h: 0.52,
      fill: { color: WARNA_KATEGORI[kat] ?? WARNA_KATEGORI.Kurang },
      line: { color: PUTIH, width: 1 }, rectRadius: 0.28,
    });
    slide.addText(kat, {
      x: xKategori, y: y + hFoto / 2 - 0.26, w: wKategori, h: 0.52,
      fontSize: F_KATEGORI, bold: true, color: PUTIH, align: 'center',
      valign: 'middle', fontFace: FONT, shrinkText: true,
    });
  });

  legenda(slide);
}

/** Slide pembuka: ringkasan filter. */
function slideRingkasan(prs: PptxGenJS, data: DataRanking) {
  const slide = prs.addSlide();
  latar(slide);
  kop(slide, data.unit, data.posisi);

  slide.addText(data.periode, {
    x: 3.576, y: 2.38, w: 6.225, h: 0.4,
    fontSize: 18, color: PUTIH, align: 'center', fontFace: FONT,
  });

  const baris: Array<[string, string]> = [
    ['Jenis kantor', data.jenisKantor],
    ['Unit / cabang', data.unit],
    ['Posisi dinilai', data.posisi],
    ['Periode', data.periode],
    ['Jumlah peserta', String(data.jumlahPeserta)],
  ];
  baris.forEach(([label, nilai], i) => {
    const y = 2.95 + i * 0.5;
    slide.addText(label, {
      x: 3.9, y, w: 2.2, h: 0.4,
      fontSize: 14, color: PUTIH, align: 'right', fontFace: FONT,
    });
    slide.addText(': ' + nilai, {
      x: 6.2, y, w: 4.0, h: 0.4,
      fontSize: 14, bold: true, color: PUTIH, fontFace: FONT,
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
