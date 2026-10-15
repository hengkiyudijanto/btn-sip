/**
 * Membangun PPTX ranking SATU SLIDE (semua peserta dalam satu halaman).
 *
 * Berbeda dari ranking-pptx.ts yang memakai tata letak "Service Drill Ranking"
 * (satu slide per unit+posisi, lengkap dengan legenda dan kotak foto besar),
 * berkas ini membuat satu tabel ringkas berisi seluruh peringkat sehingga bisa
 * dilihat dan dicetak sebagai satu halaman.
 *
 * Tata letak, warna, dan ukuran huruf SENGAJA diambil dari lembar A4 halaman
 * /laporan/ranking/satu supaya hasil unduhan dan tampilan di layar sama.
 *
 * Ukuran slide mengikuti file referensi (13,333 x 7,5 inci = 16:9) supaya
 * konsisten dengan PPTX ranking yang sudah ada.
 */

import PptxGenJS from 'pptxgenjs';
import type { DataRankingGabungan } from './ranking-gabungan';
import { kapitalkan } from './teks';
import { namaSelebarMungkin } from './nama-petugas';

const LEBAR = 12192000 / 914400;   // 13,3333... inci
const TINGGI = 6858000 / 914400;   // 7,5 inci

const FONT = 'Aptos';

const BIRU_TUA = '1226AA';
const BIRU_KEPALA = 'EEF2FB';
const BIRU_GARIS = 'B9C6E8';
const ABU_GARIS = 'E3E8F2';
const TEKS_UTAMA = '101A3D';
const TEKS_KECIL = '55607A';

const WARNA_KATEGORI: Record<string, string> = {
  Istimewa: '00B050',
  'Sangat Baik': '66BB6A',
  Baik: 'F57C00',
  Cukup: 'FFC107',
  Kurang: 'E51B2B',
};

/** Warna teks pil Cukup perlu gelap karena latarnya kuning terang. */
const TEKS_PIL_CUKUP = '4A3A00';

export async function bangunPptxRankingSatu(
  data: DataRankingGabungan,
  petaFoto: Map<string, string>
): Promise<Buffer> {
  const prs = new PptxGenJS();
  prs.defineLayout({ name: 'LAYAR', width: LEBAR, height: TINGGI });
  prs.layout = 'LAYAR';

  const slide = prs.addSlide();
  slide.background = { color: 'FFFFFF' };

  // ---- pita kop biru di tepi atas ----
  slide.addShape('rect', {
    x: 0, y: 0, w: LEBAR, h: 0.10,
    fill: { color: BIRU_TUA }, line: { color: BIRU_TUA, width: 0 },
  });

  // ---- kop ----
  const MARGIN = 0.42;
  const LEBAR_ISI = LEBAR - MARGIN * 2;

  slide.addText('PT BANK TABUNGAN NEGARA (PERSERO) TBK', {
    x: MARGIN, y: 0.22, w: LEBAR_ISI, h: 0.20,
    fontSize: 8, bold: true, color: '1B3A8F', fontFace: FONT,
  });

  slide.addText('LAPORAN RANKING PETUGAS FRONTLINER', {
    x: MARGIN, y: 0.42, w: LEBAR_ISI, h: 0.38,
    fontSize: 20, bold: true, color: TEKS_UTAMA, fontFace: FONT,
  });

  slide.addText(`${data.periode}  ·  ${data.unit}  ·  ${data.posisi}`, {
    x: MARGIN, y: 0.82, w: LEBAR_ISI, h: 0.22,
    fontSize: 10, color: TEKS_KECIL, fontFace: FONT,
  });

  // kotak jumlah peserta di kanan
  const wBadge = 1.30;
  slide.addShape('roundRect', {
    x: LEBAR - MARGIN - wBadge, y: 0.30, w: wBadge, h: 0.72,
    fill: { color: BIRU_TUA }, line: { color: BIRU_TUA, width: 0 },
    rectRadius: 0.06,
  });
  slide.addText(String(data.jumlahPeserta), {
    x: LEBAR - MARGIN - wBadge, y: 0.34, w: wBadge, h: 0.34,
    fontSize: 20, bold: true, color: 'FFFFFF', align: 'center', fontFace: FONT,
  });
  slide.addText('PESERTA', {
    x: LEBAR - MARGIN - wBadge, y: 0.68, w: wBadge, h: 0.20,
    fontSize: 7, color: 'FFFFFF', align: 'center', fontFace: FONT,
    transparency: 20,
  });

  // ---- tabel ----
  // Lebar kolom dalam inci; totalnya = LEBAR_ISI supaya tabel pas.
  // Proporsi sengaja mengikuti halaman web (7/9/27/22/21/7/7 persen).
  const k = LEBAR_ISI / 100;
  const kolom = [
    7 * k,   // peringkat
    9 * k,   // foto
    27 * k,  // nama
    22 * k,  // jabatan
    21 * k,  // unit
    7 * k,   // nilai
    7 * k,   // kategori
  ];

  const ATAS = 1.16;
  const TINGGI_KEPALA = 0.30;

  // Banyak baris menentukan tinggi baris — dipatok supaya tabel habis
  // sebelum area legenda di dasar slide.
  const TINGGI_TABEL = 5.05;
  const tinggiBaris = Math.min(0.30, TINGGI_TABEL / Math.max(1, data.baris.length));
  const ukuranHuruf = tinggiBaris < 0.20 ? 7 : tinggiBaris < 0.24 ? 8 : 9;

  const kepala = ['Peringkat', 'Foto', 'Nama Petugas', 'Jabatan', 'Unit', 'Nilai', 'Kategori'];
  const alignKepala: Array<'left' | 'center'> = [
    'center', 'center', 'left', 'left', 'left', 'center', 'center',
  ];

  kepala.forEach((teks, i) => {
    const x = MARGIN + kolom.slice(0, i).reduce((a, b) => a + b, 0);
    slide.addShape('rect', {
      x, y: ATAS, w: kolom[i], h: TINGGI_KEPALA,
      fill: { color: BIRU_KEPALA }, line: { color: BIRU_KEPALA, width: 0 },
    });
    slide.addText(teks, {
      x, y: ATAS, w: kolom[i], h: TINGGI_KEPALA,
      fontSize: 8, bold: true, color: '17275C',
      align: alignKepala[i], valign: 'middle', fontFace: FONT,
      margin: 0.02,
    });
  });

  // garis bawah kepala
  slide.addShape('rect', {
    x: MARGIN, y: ATAS + TINGGI_KEPALA, w: LEBAR_ISI, h: 0.012,
    fill: { color: BIRU_GARIS }, line: { color: BIRU_GARIS, width: 0 },
  });

  const X_FOTO = MARGIN + kolom[0] + (kolom[1] - 0.34) / 2;
  const UK_FOTO_W = 0.34;
  const UK_FOTO_H = UK_FOTO_W * (10.7 / 8);

  data.baris.forEach((b, i) => {
    const y = ATAS + TINGGI_KEPALA + i * tinggiBaris;
    const tengah = y + tinggiBaris / 2;

    // latar baris: 3 teratas diberi penanda, sisanya belang tipis
    if (i < 3) {
      const latar = ['FFF9E8', 'F7F8FA', 'FDF6F0'][i];
      slide.addShape('rect', {
        x: MARGIN, y, w: LEBAR_ISI, h: tinggiBaris,
        fill: { color: latar }, line: { color: latar, width: 0 },
      });
    } else if (i % 2 === 1) {
      slide.addShape('rect', {
        x: MARGIN, y, w: LEBAR_ISI, h: tinggiBaris,
        fill: { color: 'FAFBFE' }, line: { color: 'FAFBFE', width: 0 },
      });
    }

    const x = (idx: number) => MARGIN + kolom.slice(0, idx).reduce((a, c) => a + c, 0);

    // peringkat
    slide.addText(String(b.peringkat), {
      x: x(0), y, w: kolom[0], h: tinggiBaris,
      fontSize: ukuranHuruf + 1, bold: true,
      color: i === 0 ? 'B8860B' : i === 1 ? '7B8496' : i === 2 ? 'A9713F' : '4A5570',
      align: 'center', valign: 'middle', fontFace: FONT, margin: 0.02,
    });

    // foto petugas
    const foto = petaFoto.get(b.nip);
    if (foto) {
      slide.addImage({
        data: `data:image/jpeg;base64,${foto}`,
        x: X_FOTO, y: tengah - UK_FOTO_H / 2, w: UK_FOTO_W, h: UK_FOTO_H,
        rounding: true,   // sudut membulat seperti di halaman web
      });
    } else {
      // kotak kosong bergaris: foto bisa ditempel manual
      slide.addShape('rect', {
        x: X_FOTO, y: tengah - UK_FOTO_H / 2, w: UK_FOTO_W, h: UK_FOTO_H,
        fill: { color: 'EEF2FB' }, line: { color: 'CDD6E8', width: 0.5 },
      });
    }

    // nama — diringkas kalau tidak muat (dipotong dari GARIS kolom, bukan
    // kotak teks, supaya tidak menabrak kolom jabatan)
    slide.addText(
      namaSelebarMungkin(kapitalkan(b.nama), kolom[2] - 0.06),
      {
        x: x(2), y, w: kolom[2], h: tinggiBaris,
        fontSize: ukuranHuruf, bold: true, color: TEKS_UTAMA,
        valign: 'middle', fontFace: FONT, wrap: false, margin: 0.02,
      }
    );

    slide.addText(b.jabatan, {
      x: x(3), y, w: kolom[3], h: tinggiBaris,
      fontSize: Math.max(6, ukuranHuruf - 1), color: TEKS_KECIL,
      valign: 'middle', fontFace: FONT, wrap: false, margin: 0.02,
    });

    slide.addText(b.unit, {
      x: x(4), y, w: kolom[4], h: tinggiBaris,
      fontSize: Math.max(6, ukuranHuruf - 1), color: TEKS_KECIL,
      valign: 'middle', fontFace: FONT, wrap: false, margin: 0.02,
    });

    slide.addText(b.nilai.toFixed(2).replace('.', ','), {
      x: x(5), y, w: kolom[5], h: tinggiBaris,
      fontSize: ukuranHuruf + 1, bold: true, color: TEKS_UTAMA,
      align: 'center', valign: 'middle', fontFace: FONT, margin: 0.02,
    });

    // pil kategori — lebarnya sedikit lebih kecil dari kolomnya
    const wPil = kolom[6] - 0.10;
    slide.addShape('roundRect', {
      x: x(6) + 0.05, y: tengah - tinggiBaris * 0.30,
      w: wPil, h: tinggiBaris * 0.60,
      fill: { color: WARNA_KATEGORI[b.kategori] ?? WARNA_KATEGORI.Kurang },
      line: { color: WARNA_KATEGORI[b.kategori] ?? WARNA_KATEGORI.Kurang, width: 0 },
      rectRadius: tinggiBaris * 0.30,
    });
    slide.addText(b.kategori, {
      x: x(6) + 0.05, y: tengah - tinggiBaris * 0.30, w: wPil, h: tinggiBaris * 0.60,
      fontSize: Math.max(5.5, ukuranHuruf - 2), bold: true,
      color: b.kategori === 'Cukup' ? TEKS_PIL_CUKUP : 'FFFFFF',
      align: 'center', valign: 'middle', fontFace: FONT, wrap: false, margin: 0,
    });

    // garis pemisah antar baris
    if (i < data.baris.length - 1) {
      slide.addShape('rect', {
        x: MARGIN, y: y + tinggiBaris - 0.006, w: LEBAR_ISI, h: 0.006,
        fill: { color: ABU_GARIS }, line: { color: ABU_GARIS, width: 0 },
      });
    }
  });

  // ---- legenda di dasar slide ----
  const Y_LEGENDA = 6.72;
  slide.addText('KATEGORI', {
    x: MARGIN, y: Y_LEGENDA, w: 0.85, h: 0.22,
    fontSize: 7, bold: true, color: '8892AB', valign: 'middle', fontFace: FONT,
  });

  const legenda: Array<[string, string]> = [
    ['Istimewa', '≥ 4,80'],
    ['Sangat Baik', '4,60–4,79'],
    ['Baik', '4,00–4,59'],
    ['Cukup', '3,60–3,99'],
    ['Kurang', '< 3,60'],
  ];
  let xLeg = MARGIN + 0.90;
  for (const [nama, rentang] of legenda) {
    slide.addShape('ellipse', {
      x: xLeg, y: Y_LEGENDA + 0.075, w: 0.075, h: 0.075,
      fill: { color: WARNA_KATEGORI[nama] }, line: { color: WARNA_KATEGORI[nama], width: 0 },
    });
    slide.addText(`${nama} ${rentang}`, {
      x: xLeg + 0.10, y: Y_LEGENDA, w: 1.45, h: 0.22,
      fontSize: 7, color: TEKS_KECIL, valign: 'middle', fontFace: FONT, wrap: false,
    });
    xLeg += 1.62;
  }

  slide.addText(`Dicetak dari SIP · ${data.periode}`, {
    x: LEBAR - MARGIN - 3.2, y: Y_LEGENDA, w: 3.2, h: 0.22,
    fontSize: 7, color: '8892AB', align: 'right', valign: 'middle', fontFace: FONT,
  });

  const keluaran = (await prs.write({ outputType: 'nodebuffer' })) as Buffer;
  return keluaran;
}
