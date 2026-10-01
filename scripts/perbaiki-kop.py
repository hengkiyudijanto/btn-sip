"""Perbaiki tata letak kop: kotak nama cabang digeser naik supaya tidak
menabrak baris data, dan nama posisi diletakkan di dalam kotak bagian bawah."""

from pathlib import Path

p = Path('/home/ubuntu/projects/btn-sip/src/lib/sip/ranking-pptx.ts')
s = p.read_text()
ubah = 0

# 1. kotak nama cabang digeser naik (tinggi tetap 0,713 sesuai referensi)
a = "const NAMA_CABANG = { x: 4.817, y: 1.714, w: 3.699, h: 0.713 };"
b = "const NAMA_CABANG = { x: 4.817, y: 1.380, w: 3.699, h: 0.713 };"
if a in s:
    s = s.replace(a, b)
    ubah += 1
    print('1. kotak nama cabang: y 1,714 -> 1,380 (tinggi tetap 0,713)')
else:
    print('1. POLA kotak nama cabang tidak ketemu')

# 2. teks nama cabang: bagian atas kotak
a2 = """  slide.addText(unit, {
    x: NAMA_CABANG.x, y: NAMA_CABANG.y, w: NAMA_CABANG.w, h: NAMA_CABANG.h,
    fontSize: F_UNIT, bold: false, color: PUTIH, align: 'center',
    valign: 'middle', fontFace: FONT_UNIT,
  });"""
b2 = """  // Nama cabang: teks di bagian ATAS kotak. Di referensi nama cabang dan
  // nama posisi berada di area yang sama (bertumpuk secara angka) karena
  // teksnya bisa mengecil sendiri; di sini shrinkText dimatikan supaya
  // ukuran font persis, jadi ruangnya dibagi dua.
  slide.addText(unit, {
    x: NAMA_CABANG.x, y: NAMA_CABANG.y + 0.06,
    w: NAMA_CABANG.w, h: NAMA_CABANG.h / 2,
    fontSize: F_UNIT, bold: false, color: PUTIH, align: 'center',
    valign: 'middle', fontFace: FONT_UNIT,
  });"""
if a2 in s:
    s = s.replace(a2, b2)
    ubah += 1
    print('2. teks nama cabang -> bagian atas kotak')
else:
    print('2. POLA teks nama cabang tidak ketemu')

# 3. nama posisi: di dalam kotak, bagian bawah
a3 = """  slide.addText(posisi, {
    x: 5.219, y: NAMA_CABANG.y + NAMA_CABANG.h + 0.008, w: 2.896, h: 0.404,
    fontSize: F_POSISI, color: PUTIH, align: 'center', valign: 'middle',
    fontFace: FONT_POSISI,
  });"""
b3 = """  // Nama posisi: di dalam kotak nama cabang, di bagian BAWAH-nya.
  slide.addText(posisi, {
    x: 5.219, y: NAMA_CABANG.y + NAMA_CABANG.h / 2 - 0.06,
    w: 2.896, h: NAMA_CABANG.h / 2,
    fontSize: F_POSISI, color: PUTIH, align: 'center', valign: 'middle',
    fontFace: FONT_POSISI,
  });"""
if a3 in s:
    s = s.replace(a3, b3)
    ubah += 1
    print('3. nama posisi -> dalam kotak, bagian bawah')
else:
    print('3. POLA nama posisi tidak ketemu')

p.write_text(s)
print(f'\n{ubah} dari 3 perubahan diterapkan')

# hitung hasil akhirnya
kotak_atas, kotak_tinggi = 1.380, 0.713
print(f'\nHasil:')
print(f'  kotak nama cabang : {kotak_atas:.3f} .. {kotak_atas + kotak_tinggi:.3f}')
print(f'  teks cabang       : {kotak_atas + 0.06:.3f} .. {kotak_atas + 0.06 + kotak_tinggi/2:.3f}')
print(f'  teks posisi       : {kotak_atas + kotak_tinggi/2 - 0.06:.3f} .. {kotak_atas + kotak_tinggi - 0.06:.3f}')
print(f'  baris data mulai  : 2.110  -> {"AMAN" if kotak_atas + kotak_tinggi < 2.110 else "NABRAK"}')
