"""Baca radius sudut panel legenda dari file referensi sip.pptx.

File referensi bisa berubah nama/tempat; skrip ini menerima path sebagai
argumen pertama (default: analisa-pptx yang sudah diekstrak).
"""

import re
import sys

BERKAS = sys.argv[1] if len(sys.argv) > 1 else \
    '/home/ubuntu/projects/btn-sip/analisa-pptx/ppt/slides/slide2.xml'
WARNA_PANEL = sys.argv[2] if len(sys.argv) > 2 else 'FFFFFF'

s = open(BERKAS).read()
EMU = 914400

pola = re.compile(
    r'<a:prstGeom prst="roundRect">\s*<a:avLst>(.*?)</a:avLst>.*?'
    r'<a:solidFill><a:srgbClr val="([0-9A-F]{6})"',
    re.S,
)

print(f'File: {BERKAS}\n')
print(f'{"warna":>8} {"radius rel":>10} {"lebar":>8} {"tinggi":>8} {"radius inci":>12} {"radius pt":>10}')
print('-' * 62)

for m in pola.finditer(s):
    isi = m.group(1)
    warna = m.group(2)
    r = re.search(r'fmla="val (\d+)"', isi)
    if not r:
        continue
    # cari <a:ext> terdekat SEBELUM blok geometri ini
    sebelum = s[max(0, m.start() - 1200):m.start()]
    ext = re.findall(r'<a:ext cx="(\d+)" cy="(\d+)"/>', sebelum)
    if not ext:
        continue
    cx, cy = int(ext[-1][0]), int(ext[-1][1])
    pendek = min(cx, cy)
    rel = int(r.group(1)) / 100000
    radius_in = rel * pendek / EMU
    tanda = '  <- PANEL LEGENDA' if warna == WARNA_PANEL else ''
    print(f'{warna:>8} {rel:>10.4f} {cx/EMU:>8.3f} {cy/EMU:>8.3f} '
          f'{radius_in:>12.4f} {radius_in*72:>10.2f}{tanda}')
