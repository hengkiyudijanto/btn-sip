"""Verifikasi hasil slide: nama ringkas, panjang batang nilai, posisi pil."""

import xml.etree.ElementTree as ET

A = '{http://schemas.openxmlformats.org/drawingml/2006/main}'
P = '{http://schemas.openxmlformats.org/presentationml/2006/main}'
EMU = 914400
BERKAS = '/tmp/cekprd3/ppt/slides/slide2.xml'

akar = ET.parse(BERKAS).getroot()

nama = ''
batang = []
kolom = None
pil = None

for sp in list(akar.find(f'{P}cSld/{P}spTree')):
    xf = sp.find(f'.//{A}xfrm')
    if xf is None:
        continue
    off, ext = xf.find(f'{A}off'), xf.find(f'{A}ext')
    x = int(off.get('x')) / EMU
    y = int(off.get('y')) / EMU
    w = int(ext.get('cx')) / EMU

    teks = ''.join(v.text or '' for v in sp.iter(f'{A}t')).strip()
    if teks.startswith('IRWAN'):
        nama = teks

    # hanya baris pertama (y sekitar 2,39)
    if not (2.35 < y < 2.45):
        continue

    if abs(w - 4.35) < 0.01:
        kolom = (x, w)
    elif abs(w - 1.30) < 0.01:
        pil = (x, w)
    elif 0.5 < w < 4.3:
        # batang nilai: banyak lapis bertumpuk, ambil yang terlebar
        batang.append(w)

print(f'  nama petugas   : "{nama}"   (asli "IRWAN ALLO")')
if kolom:
    print(f'  kolom penuh    : x={kolom[0]:.3f} w={kolom[1]:.3f}')
if batang:
    terlebar = max(batang)
    print(f'  batang nilai   : w={terlebar:.3f}  ({len(batang)} lapis)')
    if kolom:
        print(f'  porsi          : {terlebar / kolom[1] * 100:.1f}%'
              f'   (nilai 3,51 dari 5 = {3.51 / 5 * 100:.1f}%)')
if pil and kolom:
    print(f'  kriteria (pil) : x={pil[0]:.3f}'
          f'   (kotak berakhir di {kolom[0] + kolom[1]:.3f}) -> '
          f'{"di KANAN kotak" if pil[0] > kolom[0] + kolom[1] else "bukan di kanan"}')
