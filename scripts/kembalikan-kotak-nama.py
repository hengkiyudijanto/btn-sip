"""Kembalikan kotak nama cabang ke ukuran yang benar-benar dipakai referensi.

Di referensi ada DUA kotak di area nama cabang:
  Group 20       3,271 x 0,505 @ y 1,259   <- berisi teks, INI yang terpakai
  Rectangle 39   3,699 x 0,713 @ y 1,714   <- bingkai kosong

Versi sebelumnya memakai Rectangle 39 (0,713) sehingga kotaknya kebesaran dan
menelan nama posisi. Sekarang kembali ke Group 20.
"""

from pathlib import Path

p = Path('/home/ubuntu/projects/btn-sip/src/lib/sip/ranking-pptx.ts')
s = p.read_text()
ubah = 0

# 1. kotak: kembali ke ukuran Group 20
a = """/**
 * Kotak nama cabang — posisi dari file referensi (Rectangle 39).
 * rectRadius diambil dari bingkai referensi (relatif 16% dari tinggi).
 */
const NAMA_CABANG = { x: 4.817, y: 1.380, w: 3.699, h: 0.713 };
const RADIUS_NAMA_CABANG = 0.114;   // 16% x 0,713
/**
 * Jarak tepi di dalam kotak nama cabang. Kotaknya diisi DUA baris teks
 * (nama cabang di atas, nama posisi di bawah); 0,04 di tepi atas dan bawah
 * memberi napas, sisanya dibagi dua rata.
 */
const PAD_NAMA_CABANG = 0.04;
/** Tinggi tiap baris teks di dalam kotak nama cabang. */
const BARIS_NAMA_CABANG = (NAMA_CABANG.h - PAD_NAMA_CABANG * 2) / 2;"""

b = """/**
 * Kotak nama cabang — posisi PERSIS dari file referensi (Group 20).
 *
 * PENTING: di referensi ada DUA kotak di area ini — Group 20 (3,271 x 0,505
 * di y 1,259) yang BERISI teks nama cabang, dan Rectangle 39 (3,699 x 0,713
 * di y 1,714) yang hanya bingkai kosong. Yang dipakai tampilannya adalah
 * Group 20, jadi inilah yang diikuti. Sempat tertukar dengan Rectangle 39
 * sehingga kotaknya kebesaran dan nama posisi tertelan.
 */
const NAMA_CABANG = { x: 5.039, y: 1.259, w: 3.271, h: 0.505 };
const RADIUS_NAMA_CABANG = 0.08;   // sudut membulat tipis"""

if a in s:
    s = s.replace(a, b)
    ubah += 1
    print('1. kotak kembali ke Group 20: 3,271 x 0,505 @ y 1,259')

# 2. teks nama cabang: satu baris, tengah kotak (seperti semula)
a2 = """  slide.addText(unit, {
    x: NAMA_CABANG.x, y: NAMA_CABANG.y + PAD_NAMA_CABANG,
    w: NAMA_CABANG.w, h: BARIS_NAMA_CABANG,
    fontSize: F_UNIT, bold: false, color: PUTIH, align: 'center',
    valign: 'middle', fontFace: FONT_UNIT,
  });"""
b2 = """  slide.addText(unit, {
    x: NAMA_CABANG.x, y: NAMA_CABANG.y, w: NAMA_CABANG.w, h: NAMA_CABANG.h,
    fontSize: F_UNIT, bold: false, color: PUTIH, align: 'center',
    valign: 'middle', fontFace: FONT_UNIT,
  });"""
if a2 in s:
    s = s.replace(a2, b2)
    ubah += 1
    print('2. teks nama cabang: satu baris, tengah kotak')

# 3. nama posisi: kembali ke posisi referensi (DI LUAR kotak, di bawahnya)
a3 = """  // Nama posisi: di dalam kotak nama cabang, di bagian BAWAH-nya.
  slide.addText(posisi, {
    x: 5.219, y: NAMA_CABANG.y + PAD_NAMA_CABANG + BARIS_NAMA_CABANG,
    w: 2.896, h: BARIS_NAMA_CABANG,
    fontSize: F_POSISI, color: PUTIH, align: 'center', valign: 'middle',
    fontFace: FONT_POSISI,
  });"""
b3 = """  // Nama posisi: PERSIS di posisi referensi (TextBox 13) — terpisah di
  // bawah kotak nama cabang, bukan di dalamnya.
  slide.addText(posisi, {
    x: 5.219, y: 1.839, w: 2.896, h: 0.404,
    fontSize: F_POSISI, color: PUTIH, align: 'center', valign: 'middle',
    fontFace: FONT_POSISI,
  });"""
if a3 in s:
    s = s.replace(a3, b3)
    ubah += 1
    print('3. nama posisi kembali ke y 1,839 (posisi referensi)')

p.write_text(s)
print(f'\n{ubah} dari 3 perubahan diterapkan')

print('\nHasil:')
print('  kotak nama cabang : x 5.039  y 1.259 .. 1.764  (3,271 x 0,505)')
print('  teks nama cabang  : di tengah kotak')
print('  nama posisi       : y 1.839 .. 2.243  (terpisah, di bawah kotak)')
print('  celah             : 1.839 - 1.764 = 0,075 inci  -> TIDAK tumpang tindih')
