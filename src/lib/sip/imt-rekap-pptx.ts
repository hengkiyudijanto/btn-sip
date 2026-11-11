import { kelompokkanBarisRekapIMT, type SlideRekapIMT } from './imt-rekap';
import PptxGenJS from 'pptxgenjs';

const LEBAR_SLIDE = 13.333;
const TINGGI_SLIDE = 7.5;
const MARGIN = 0.42;
const LEBAR_KONTEN = LEBAR_SLIDE - MARGIN * 2;
const TINGGI_FOOTER = 0.35;
const TINGGI_AWAL_TABEL = 1.32;
const TINGGI_JUDUL_GRUP = 0.25;
const TINGGI_HEADER_TABEL = 0.3;
const TINGGI_BARIS = 0.4;
const TINGGI_JARAK_GRUP = 0.12;
const KOLOM = [0.38, 0.62, 2.25, 2.15, 1.55, 1.0, 1.0, 1.2, 1.35];
const HEADER = ['No', 'Foto', 'Nama', 'Unit kerja', 'Berat awal', 'Berat', 'Naik/turun', 'IMT', 'Kategori'];

type PptxSlideContext = { slide: PptxGenJS.Slide; y: number };

function tambahIdentitas(slide: PptxGenJS.Slide, data: SlideRekapIMT) {
  slide.background = { color: 'FFFFFF' };
  slide.addShape('rect', { x: 0, y: 0, w: LEBAR_SLIDE, h: 0.1, fill: { color: '1226AA' }, line: { color: '1226AA', width: 0 } });
  slide.addText('PT BANK TABUNGAN NEGARA (PERSERO) TBK', { x: MARGIN, y: 0.22, w: LEBAR_KONTEN, h: 0.2, fontSize: 8, bold: true, color: '1B3A8F', fontFace: 'Aptos' });
  slide.addText('REKAPITULASI INDEKS MASSA TUBUH', { x: MARGIN, y: 0.43, w: LEBAR_KONTEN, h: 0.35, fontSize: 20, bold: true, color: '101A3D', fontFace: 'Aptos' });
  slide.addText(`${data.periode} · ${data.unit}`, { x: MARGIN, y: 0.83, w: LEBAR_KONTEN, h: 0.22, fontSize: 10, color: '55607A', fontFace: 'Aptos' });
  slide.addText(`Tanggal pengukuran: ${data.tanggal.toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })}`, { x: MARGIN, y: 1.04, w: LEBAR_KONTEN, h: 0.18, fontSize: 8, color: '55607A', fontFace: 'Aptos' });
}

function tambahFooter(slide: PptxGenJS.Slide) {
  slide.addText('Berat badan terakhir yang tercatat pada tanggal pengukuran · IMT adalah indikator umum, bukan diagnosis medis.', { x: MARGIN, y: TINGGI_SLIDE - TINGGI_FOOTER, w: LEBAR_KONTEN, h: 0.2, fontSize: 7, color: '8892AB', fontFace: 'Aptos' });
}

function tambahHeaderTabel(ctx: PptxSlideContext) {
  let x = MARGIN;
  HEADER.forEach((h, i) => {
    ctx.slide.addShape('rect', { x, y: ctx.y, w: KOLOM[i], h: TINGGI_HEADER_TABEL, fill: { color: '1226AA' }, line: { color: '1226AA', width: 0 } });
    ctx.slide.addText(h, { x, y: ctx.y, w: KOLOM[i], h: TINGGI_HEADER_TABEL, fontSize: 7, bold: true, color: 'FFFFFF', align: i === 2 || i === 3 ? 'left' : 'center', valign: 'middle', margin: 0.02, fit: 'shrink' });
    x += KOLOM[i];
  });
  ctx.y += TINGGI_HEADER_TABEL;
}

function tambahBaris(ctx: PptxSlideContext, row: SlideRekapIMT['baris'][number], nomor: number, belang: boolean) {
  const y = ctx.y;
  if (belang) ctx.slide.addShape('rect', { x: MARGIN, y, w: LEBAR_KONTEN, h: TINGGI_BARIS, fill: { color: 'FAFBFE' }, line: { color: 'FAFBFE', width: 0 } });
  let x = MARGIN;
  const teks = [String(nomor), '', row.nama, row.unitKerja, row.beratAwal == null ? '—' : row.beratAwal.toFixed(1).replace('.', ','), row.berat == null ? '—' : row.berat.toFixed(1).replace('.', ','), row.perubahan == null ? '—' : `${row.perubahan > 0 ? '+' : ''}${row.perubahan.toFixed(1).replace('.', ',')}`, row.imt == null ? '—' : row.imt.toFixed(1).replace('.', ','), row.kategori ?? 'Belum diukur'];
  teks.forEach((value, i) => {
    if (i === 1 && row.foto) {
      ctx.slide.addImage({ data: row.foto, x: x + 0.14, y: y + 0.03, w: 0.34, h: TINGGI_BARIS - 0.06 });
    } else {
      ctx.slide.addText(value, { x, y, w: KOLOM[i], h: TINGGI_BARIS, fontSize: 7, bold: i === 2, color: '101A3D', align: i === 2 || i === 3 ? 'left' : 'center', valign: 'middle', margin: 0.02, fit: 'shrink' });
    }
    x += KOLOM[i];
  });
  ctx.y += TINGGI_BARIS;
}

export async function bangunPptxRekapIMT(slideData: SlideRekapIMT[]): Promise<Buffer> {
  const pptx = new PptxGenJS();
  pptx.layout = 'LAYOUT_WIDE';
  pptx.author = 'SIP';
  pptx.subject = 'Rekap Indeks Massa Tubuh';

  for (const data of slideData) {
    const groups = kelompokkanBarisRekapIMT(data.baris);
    let ctx: PptxSlideContext = { slide: pptx.addSlide(), y: TINGGI_AWAL_TABEL };
    tambahIdentitas(ctx.slide, data);

    for (const group of groups) {
      let posisi = 0;
      while (posisi < group.baris.length) {
        const kebutuhanMinimum = TINGGI_JUDUL_GRUP + TINGGI_HEADER_TABEL + TINGGI_BARIS + TINGGI_JARAK_GRUP;
        if (ctx.y + kebutuhanMinimum > TINGGI_SLIDE - TINGGI_FOOTER) {
          tambahFooter(ctx.slide);
          ctx = { slide: pptx.addSlide(), y: TINGGI_AWAL_TABEL };
          tambahIdentitas(ctx.slide, data);
        }

        ctx.slide.addText(`${group.kantor} · ${group.unitKerja}`, { x: MARGIN, y: ctx.y, w: LEBAR_KONTEN, h: TINGGI_JUDUL_GRUP, fontSize: 9, bold: true, color: '101A3D', fill: { color: 'EEF2FB' }, margin: 0.05 });
        ctx.y += TINGGI_JUDUL_GRUP;
        tambahHeaderTabel(ctx);

        const ruangBaris = TINGGI_SLIDE - TINGGI_FOOTER - ctx.y - TINGGI_JARAK_GRUP;
        const jumlahMuat = Math.max(1, Math.floor(ruangBaris / TINGGI_BARIS));
        const akhir = Math.min(group.baris.length, posisi + jumlahMuat);
        for (let i = posisi; i < akhir; i++) tambahBaris(ctx, group.baris[i], i - posisi + 1, (i - posisi) % 2 === 1);
        posisi = akhir;
        ctx.y += TINGGI_JARAK_GRUP;

        if (posisi < group.baris.length) {
          tambahFooter(ctx.slide);
          ctx = { slide: pptx.addSlide(), y: TINGGI_AWAL_TABEL };
          tambahIdentitas(ctx.slide, data);
        }
      }
    }
    tambahFooter(ctx.slide);
  }
  return (await pptx.write({ outputType: 'nodebuffer' })) as Buffer;
}
