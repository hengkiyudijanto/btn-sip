import PptxGenJS from 'pptxgenjs';
import type { SlideRekapIMT } from './imt-rekap';

export async function bangunPptxRekapIMT(slideData: SlideRekapIMT[]): Promise<Buffer> {
  const pptx = new PptxGenJS();
  pptx.layout = 'LAYOUT_WIDE';
  pptx.author = 'SIP';
  pptx.subject = 'Rekap Indeks Massa Tubuh';
  for (const data of slideData) {
    const slide = pptx.addSlide();
    slide.background = { color: 'FFFFFF' };
    const margin = 0.42;
    const width = 13.333 - margin * 2;
    slide.addShape('rect', { x: 0, y: 0, w: 13.333, h: 0.1, fill: { color: '1226AA' }, line: { color: '1226AA', width: 0 } });
    slide.addText('PT BANK TABUNGAN NEGARA (PERSERO) TBK', { x: margin, y: 0.22, w: width, h: 0.2, fontSize: 8, bold: true, color: '1B3A8F', fontFace: 'Aptos' });
    slide.addText('REKAPITULASI INDEKS MASSA TUBUH', { x: margin, y: 0.43, w: width, h: 0.35, fontSize: 20, bold: true, color: '101A3D', fontFace: 'Aptos' });
    slide.addText(`${data.periode} · ${data.unit}`, { x: margin, y: 0.83, w: width, h: 0.22, fontSize: 10, color: '55607A', fontFace: 'Aptos' });
    const headY = 1.18;
    const rowH = Math.min(0.36, 4.95 / Math.max(1, data.baris.length));
    const cols = [0.45, 1.05, 3.0, 2.0, 1.35, 1.15, 1.5, 2.0];
    const heads = ['No', 'NIP', 'Nama', 'Jabatan', 'Berat (kg)', 'IMT', 'Kategori', 'Tanggal ukur'];
    let x = margin;
    heads.forEach((h, i) => { slide.addShape('rect', { x, y: headY, w: cols[i], h: 0.32, fill: { color: 'EEF2FB' }, line: { color: 'EEF2FB', width: 0 } }); slide.addText(h, { x, y: headY, w: cols[i], h: 0.32, fontSize: 8, bold: true, color: '17275C', align: i < 2 || i > 3 ? 'center' : 'left', valign: 'middle', fontFace: 'Aptos', margin: 0.03 }); x += cols[i]; });
    data.baris.forEach((b, i) => { const y = headY + 0.32 + i * rowH; let xx = margin; if (i % 2) slide.addShape('rect', { x: margin, y, w: width, h: rowH, fill: { color: 'FAFBFE' }, line: { color: 'FAFBFE', width: 0 } }); const vals = [String(i + 1), b.nip, b.nama, b.unitKerja, b.berat == null ? '—' : b.berat.toFixed(1).replace('.', ','), b.imt == null ? '—' : b.imt.toFixed(1).replace('.', ','), b.kategori ?? 'Belum diukur', b.imt == null ? '—' : data.selesai.toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' })]; vals.forEach((v, j) => { slide.addText(v, { x: xx, y, w: cols[j], h: rowH, fontSize: rowH < 0.24 ? 7 : 8, bold: j === 2, color: '101A3D', align: j < 2 || j > 3 ? 'center' : 'left', valign: 'middle', fontFace: 'Aptos', margin: 0.03, fit: 'shrink' }); xx += cols[j]; }); });
    slide.addText('Berat badan terakhir yang tercatat pada periode ini · IMT adalah indikator umum, bukan diagnosis medis.', { x: margin, y: 6.85, w: width, h: 0.2, fontSize: 7, color: '8892AB', fontFace: 'Aptos' });
  }
  return (await pptx.write({ outputType: 'nodebuffer' })) as Buffer;
}
