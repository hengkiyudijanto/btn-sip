"""Ukur posisi & lebar elemen pada PPTX hasil, untuk memeriksa tata letak.

Membaca slide yang dihasilkan aplikasi dan melaporkan posisi tiap bentuk
dalam inci — supaya bisa dibandingkan dengan file referensi tanpa menebak
dari gambar.
"""

import xml.etree.ElementTree as ET
from pathlib import Path
import sys

A = '{http://schemas.openxmlformats.org/drawingml/2006/main}'
P = '{http://schemas.openxmlformats.org/presentationml/2006/main}'
EMU = 914400

berkas = Path(sys.argv[1] if len(sys.argv) > 1 else
              '/tmp/cekakhir/ppt/slides/slide2.xml')

akar = ET.parse(berkas).getroot()
spTree = akar.find(f'{P}cSld/{P}spTree')

print('=== BENTUK DI SLIDE 2 (hasil aplikasi) ===\n')

def inci(v):
    return int(v) / EMU if v else 0.0

for sp in list(spTree):
    tag = sp.tag.split('}')[-1]
    nv = sp.find(f'{P}nvSpPr/{P}cNvPr')
    if nv is None:
        nv = sp.find(f'{P}nvPicPr/{P}cNvPr')
    nama = nv.get('name') if nv is not None else '?'

    xfrm = sp.find(f'.//{A}xfrm')
    if xfrm is None:
        continue
    off, ext = xfrm.find(f'{A}off'), xfrm.find(f'{A}ext')
    x, y = inci(off.get('x')), inci(off.get('y'))
    w, h = inci(ext.get('cx')), inci(ext.get('cy'))

    teks = ''.join(t.text or '' for t in sp.iter(f'{A}t')).strip()
    if tag == 'grpSp':
        # tampilkan isi grup
        print(f'GRUP {nama}')
        for anak in sp.iter():
            ta = anak.tag.split('}')[-1]
            if ta != 'sp':
                continue
            n3 = anak.find(f'{P}nvSpPr/{P}cNvPr')
            nm = n3.get('name') if n3 is not None else '?'
            xf = anak.find(f'.//{A}xfrm')
            if xf is None:
                continue
            o2, e2 = xf.find(f'{A}off'), xf.find(f'{A}ext')
            if o2 is None or e2 is None:
                continue
            t2 = ''.join(t.text or '' for t in anak.iter(f'{A}t')).strip()
            print(f'   {nm:22} x={inci(o2.get("x")):6.3f} y={inci(o2.get("y")):6.3f} '
                  f'w={inci(e2.get("cx")):6.3f} h={inci(e2.get("cy")):6.3f}'
                  + (f'  "{t2[:30]}"' if t2 else ''))
        continue

    print(f'{tag:6} {nama:22} x={x:6.3f} y={y:6.3f} w={w:6.3f} h={h:6.3f}'
          + (f'  "{teks[:30]}"' if teks else ''))
