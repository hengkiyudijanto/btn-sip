"""Periksa posisi label SKALA PENILAIAN terhadap panel putih di PPTX produksi."""

import xml.etree.ElementTree as ET

A = '{http://schemas.openxmlformats.org/drawingml/2006/main}'
P = '{http://schemas.openxmlformats.org/presentationml/2006/main}'
EMU = 914400
BERKAS = '/tmp/cekprodlabel/ppt/slides/slide2.xml'

akar = ET.parse(BERKAS).getroot()
for sp in list(akar.find(f'{P}cSld/{P}spTree')):
    xf = sp.find(f'.//{A}xfrm')
    if xf is None:
        continue
    off, ext = xf.find(f'{A}off'), xf.find(f'{A}ext')
    y = int(off.get('y')) / EMU
    h = int(ext.get('cy')) / EMU
    w = int(ext.get('cx')) / EMU
    isi = ''
    for c in sp.iter(f'{A}srgbClr'):
        isi = c.get('val')
        break
    if isi in ('FFFFFF', '0B1E6B') and 6.3 < y < 7.6:
        ket = 'PANEL PUTIH' if isi == 'FFFFFF' else 'LABEL BIRU DONKER'
        print(f'  {ket:18} y={y:6.3f} h={h:5.3f} w={w:5.3f}  bawah={y + h:6.3f}')
