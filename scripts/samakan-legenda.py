"""Samakan legenda SKALA PENILAIAN dengan file referensi.

Angka dari ppt/slides/slide2.xml (Group 5), sudah dikonversi ke inci:

  Panel putih (Rounded Rect 83) : x 2,850  y 6,130  w 6,861  h 0,720
  Label SKALA PENILAIAN (Rect 84): x 5,200  y 5,860  w 2,000  h 0,340
  Teks label (TextBox 10)       : x 5,200  y 5,890  w 2,000  h 0,250
  Titik warna (Oval 11,15,21,25,28): y 6,350  ukuran 0,120
  Rentang angka (Tb 12,18,23,26,34): y 6,288  tinggi 0,269
  Nama kategori (Tb 14,19,24,27,35): y 6,490  tinggi 0,180
  Posisi x titik               : 3,030  4,460  5,946  7,399  8,868

Sebelumnya saya memakai panel 0,990 inci (terlalu tinggi 37%) dan label
menimpa tepi panel.
"""

from pathlib import Path

p = Path('/home/ubuntu/projects/btn-sip/src/lib/sip/ranking-pptx.ts')
s = p.read_text()

# cari blok fungsi legenda dari awal sampai sebelum "slideRingkasan"
awal = s.find('/** Legenda SKALA PENILAIAN (posisi dari file asli). */')
akhir = s.find('/** Satu slide ranking untuk satu kelompok (unit + posisi). */')
if awal < 0 or akhir < 0:
    raise SystemExit('POLA fungsi legenda tidak ketemu')

baru = '''/**
 * Legenda SKALA PENILAIAN — SEMUA UKURAN DIAMBIL DARI FILE REFERENSI
 * (ppt/slides/slide2.xml, Group 5). Jalankan scripts/ekstrak-tata-letak.py
 * kalau perlu memeriksa ulang angkanya.
 *
 *   panel putih    x 2,850  y 6,130  6,861 x 0,720
 *   label          x 5,200  y 5,860  2,000 x 0,340
 *   titik & teks   x 3,030 / 4,460 / 5,946 / 7,399 / 8,868
 */
const LEG_X = 3.098;
const LEG_PANEL = { x: 2.850, y: 6.130, w: 6.861, h: 0.720 };
const LEG_LABEL = { x: 5.200, y: 5.860, w: 2.000, h: 0.340 };
const LEG_X_TITIK = [3.030, 4.460, 5.946, 7.399, 8.868];
const LEG_Y_TITIK = 6.350;
const LEG_UKURAN_TITIK = 0.120;
const LEG_Y_RENTANG = 6.288;
const LEG_Y_NAMA = 6.490;

function legenda(slide: PptxGenJS.Slide) {
  // panel putih legenda (tinggi 0,720 inci, sesuai file referensi)
  slide.addShape('roundRect', {
    x: LEG_PANEL.x, y: LEG_PANEL.y, w: LEG_PANEL.w, h: LEG_PANEL.h,
    fill: { color: PUTIH }, line: { color: PUTIH, width: 0 },
    rectRadius: 0.06,
  });

  // label "SKALA PENILAIAN" — kotak transparan bergaris putih, di ATAS panel
  slide.addShape('roundRect', {
    x: LEG_LABEL.x, y: LEG_LABEL.y, w: LEG_LABEL.w, h: LEG_LABEL.h,
    fill: { type: 'none' } as never,
    line: { color: PUTIH, width: 1 }, rectRadius: 0.18,
  });
  slide.addText('SKALA PENILAIAN', {
    x: LEG_LABEL.x, y: LEG_LABEL.y + 0.03, w: LEG_LABEL.w, h: 0.250,
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

  item.forEach(([rentang, nama], i) => {
    const x = LEG_X_TITIK[i] ?? LEG_X_TITIK[0] + i * 1.43;

    // titik warna
    slide.addShape('ellipse', {
      x, y: LEG_Y_TITIK, w: LEG_UKURAN_TITIK, h: LEG_UKURAN_TITIK,
      fill: { color: WARNA_KATEGORI[nama] },
      line: { color: WARNA_KATEGORI[nama], width: 0 },
    });

    // rentang angka
    slide.addText(rentang, {
      x: x + 0.163, y: LEG_Y_RENTANG, w: 0.85, h: 0.269,
      fontSize: F_LEGENDA_ANGKA, bold: true, color: '142D64',
      valign: 'middle', fontFace: FONT, shrinkText: true,
    });

    // nama kategori
    slide.addText(nama, {
      x: x + 0.170, y: LEG_Y_NAMA, w: 1.05, h: 0.180,
      fontSize: F_LEGENDA_NAMA, color: '142D64',
      valign: 'middle', fontFace: FONT, shrinkText: true,
    });
  });
}

'''

s = s[:awal] + baru + s[akhir:]
p.write_text(s)
print('legenda disamakan dengan file referensi (panel 0,720 inci)')
