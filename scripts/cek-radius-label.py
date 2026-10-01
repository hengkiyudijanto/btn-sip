"""Baca radius sudut kotak label SKALA PENILAIAN dari PPTX.

pptxgenjs menulis radius roundRect sebagai `val` dengan satuan 1/100000 dari
sisi terpendek, jadi dibagi 100000 untuk mendapat nilai relatif, lalu
dikalikan tinggi kotak untuk mendapat inci.
"""

import re
import sys

BERKAS = sys.argv[1] if len(sys.argv) > 1 else \
    '/tmp/cekprodlabel2/ppt/slides/slide2.xml'
WARNA = sys.argv[2] if len(sys.argv) > 2 else '0F44BE'
TINGGI_KOTAK = 0.270   # inci, tinggi kotak label

s = open(BERKAS).read()
pola = re.compile(r'<a:prstGeom prst="roundRect">\s*<a:avLst>(.*?)</a:avLst>', re.S)

ditemukan = False
for m in pola.finditer(s):
    awal = max(0, m.start() - 3000)
    if WARNA not in s[awal:m.start()]:
        continue
    isi = m.group(1).strip()
    r = re.search(r'fmla="val (\d+)"', isi)
    if r:
        relatif = int(r.group(1)) / 100000
        print(f'  radius relatif : {relatif:.4f}')
        print(f'  radius         : {relatif * TINGGI_KOTAK:.4f} inci'
              f'  ({relatif * TINGGI_KOTAK * 72:.2f} pt)')
        print(f'  tinggi kotak   : {TINGGI_KOTAK} inci')
        print(f'  rasio radius/tinggi: {relatif:.1%}')
    else:
        print('  radius: (tidak diset / default)')
    ditemukan = True

if not ditemukan:
    print('  kotak label tidak ketemu')
