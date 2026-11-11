import { kelompokkanBarisRekapIMT, type SlideRekapIMT } from './imt-rekap';
import PptxGenJS from 'pptxgenjs';

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
    slide.addText(`Tanggal pengukuran: ${data.tanggal.toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })}`, { x: margin, y: 1.04, w: width, h: 0.18, fontSize: 8, color: '55607A', fontFace: 'Aptos' });
    const groups = kelompokkanBarisRekapIMT(data.baris);
    const cols = [0.38, 0.62, 2.05, 2.0, 1.55, 1.0, 1.0, 1.2, 1.35, 1.75];
    const heads = ['No', 'Foto', 'Nama', 'Unit kerja', 'Berat awal', 'Berat', 'Naik/turun', 'IMT', 'Kategori', 'Tanggal ukur'];
    let y = 1.32;
    const addHeader = () => { let x = margin; heads.forEach((h, i) => { slide.addShape('rect', { x, y, w: cols[i], h: 0.3, fill: { color: '1226AA' }, line: { color: '1226AA', width: 0 } }); slide.addText(h, { x, y, w: cols[i], h: 0.3, fontSize: 7, bold: true, color: 'FFFFFF', align: i === 2 || i === 3 ? 'left' : 'center', valign: 'middle', margin: 0.02, fit: 'shrink' }); x += cols[i]; }); y += 0.3; };
    for (const group of groups) {
      if (y > 6.35) { slide.addText('Berat badan terakhir yang tercatat pada periode ini · IMT adalah indikator umum, bukan diagnosis medis.', { x: margin, y: 6.85, w: width, h: 0.2, fontSize: 7, color: '8892AB', fontFace: 'Aptos' }); y = 0.35; }
      slide.addText(`${group.kantor} · ${group.unitKerja}`, { x: margin, y, w: width, h: 0.25, fontSize: 9, bold: true, color: '101A3D', fill: { color: 'EEF2FB' }, margin: 0.05 });
      y += 0.25;
      addHeader();
      const rowH = Math.min(0.42, 3.7 / Math.max(1, group.baris.length));
      group.baris.forEach((b, i) => {
        let x = margin;
        if (i % 2) slide.addShape('rect', { x: margin, y, w: width, h: rowH, fill: { color: 'FAFBFE' }, line: { color: 'FAFBFE', width: 0 } });
        const vals = [String(i + 1), '', b.nama, b.unitKerja, b.beratAwal == null ? '—' : b.beratAwal.toFixed(1).replace('.', ','), b.berat == null ? '—' : b.berat.toFixed(1).replace('.', ','), b.perubahan == null ? '—' : `${b.perubahan > 0 ? '+' : ''}${b.perubahan.toFixed(1).replace('.', ',')}`, b.imt == null ? '—' : b.imt.toFixed(1).replace('.', ','), b.kategori ?? 'Belum diukur', data.tanggal.toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' })];
        vals.forEach((v, j) => { if (j === 1 && b.foto) slide.addImage({ data: b.foto, x: x + 0.14, y: y + 0.03, w: Math.min(cols[j] - 0.28, 0.28), h: rowH - 0.06 }); else slide.addText(v, { x, y, w: cols[j], h: rowH, fontSize: rowH < 0.24 ? 6 : 7, bold: j === 2, color: '101A3D', align: j === 2 || j === 3 ? 'left' : 'center', valign: 'middle', margin: 0.02, fit: 'shrink' }); x += cols[j]; });
        y += rowH;
      });
      y += 0.12;
    }
    slide.addText('Berat badan terakhir yang tercatat pada periode ini · IMT adalah indikator umum, bukan diagnosis medis.', { x: margin, y: 6.85, w: width, h: 0.2, fontSize: 7, color: '8892AB', fontFace: 'Aptos' });
  }
  return (await pptx.write({ outputType: 'nodebuffer' })) as Buffer;
}
