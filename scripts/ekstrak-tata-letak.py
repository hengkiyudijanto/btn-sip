"""Ekstrak posisi & ukuran semua elemen slide 2 dari XML PPTX user.

Tujuan: supaya tata letak versi saya bisa disamakan dengan file asli, bukan
ditebak dari gambar. Nilai EMU (1 inci = 914400 EMU) diterjemahkan ke inci.
"""

import re
import xml.etree.ElementTree as ET
from pathlib import Path

EMU = 914400
A = '{http://schemas.openxmlformats.org/drawingml/2006/main}'
P = '{http://schemas.openxmlformats.org/presentationml/2006/main}'

xml_path = Path('/home/ubuntu/projects/btn-sip/analisa-pptx/ppt/slides/slide2.xml')
pohon = ET.parse(xml_path)
akar = pohon.getroot()

print('=== ELEMEN SLIDE 2 (posisi dalam inci) ===\n')


def inci(emu: str | None) -> float:
    return int(emu) / EMU if emu else 0.0


def teks_dari(sp) -> str:
    potongan = [t.text or '' for t in sp.iter(f'{A}t')]
    return ''.join(potongan).strip()


# semua bentuk pada level teratas (spTree)
spTree = akar.find(f'{P}cSld/{P}spTree')
for sp in list(spTree):
    tag = sp.tag.split('}')[-1]
    nama = sp.find(f'.//{P}nvPr/{A}ph') is None and '' or ''
    nv = sp.find(f'{P}nvSpPr/{P}cNvPr')
    if nv is None:
        nv = sp.find(f'{P}nvPicPr/{P}cNvPr')
    if nv is None:
        nv = sp.find(f'{P}nvGrpSpPr/{P}cNvPr')
    nama_el = nv.get('name') if nv is not None else '?'

    xfrm = sp.find(f'.//{A}xfrm')
    if xfrm is None:
        continue
    off = xfrm.find(f'{A}off')
    ext = xfrm.find(f'{A}ext')
    x = inci(off.get('x') if off is not None else None)
    y = inci(off.get('y') if off is not None else None)
    w = inci(ext.get('cx') if ext is not None else None)
    h = inci(ext.get('cy') if ext is not None else None)

    teks = teks_dari(sp)
    label = f'{tag:8} {nama_el:22}'
    print(f'{label} x={x:6.3f} y={y:6.3f} w={w:6.3f} h={h:6.3f}'
          + (f'  teks="{teks[:46]}"' if teks else ''))
