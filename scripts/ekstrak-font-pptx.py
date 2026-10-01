"""Ekstrak nama font & ukuran font setiap teks dari file PPTX user.

Ukuran di OOXML disimpan dalam satuan seperseratus poin (sz="2000" = 20 pt).
Tujuannya supaya ukuran di versi saya disamakan dengan file asli, bukan
ditebak.
"""

import re
import xml.etree.ElementTree as ET
from pathlib import Path

A = '{http://schemas.openxmlformats.org/drawingml/2006/main}'
P = '{http://schemas.openxmlformats.org/presentationml/2006/main}'

xml_path = Path('/home/ubuntu/projects/btn-sip/analisa-pptx/ppt/slides/slide2.xml')
akar = ET.parse(xml_path).getroot()

EMU = 914400


def inci(v):
    return int(v) / EMU if v else 0.0


print('=== FONT & UKURAN TIAP TEKS DI SLIDE 2 (file asli) ===\n')

spTree = akar.find(f'{P}cSld/{P}spTree')
for sp in list(spTree):
    nv = sp.find(f'{P}nvSpPr/{P}cNvPr')
    if nv is None:
        nv = sp.find(f'{P}nvGrpSpPr/{P}cNvPr')
    nama = nv.get('name') if nv is not None else '?'

    # kumpulkan semua paragraf beserta propertinya
    for p in sp.iter(f'{A}p'):
        pPr = p.find(f'{A}pPr')
        if pPr is None:
            continue

        # teks paragraf ini
        teks = ''.join(t.text or '' for t in p.iter(f'{A}t')).strip()
        if not teks:
            continue

        ukuran = None
        tebal = None
        warna = None
        font = None

        # properti level paragraf
        defRPr = pPr.find(f'{A}defRPr')
        target = defRPr
        if target is not None:
            if target.get('sz'):
                ukuran = int(target.get('sz')) / 100
            if target.get('b'):
                tebal = target.get('b') == '1'
            if target.get('spc'):
                pass
            solid = target.find(f'{A}solidFill/{A}srgbClr')
            if solid is not None:
                warna = solid.get('val')
            latin = target.find(f'{A}latin')
            if latin is not None:
                font = latin.get('typeface')

        # properti run (menang atas paragraf)
        for r in p.findall(f'{A}r'):
            rPr = r.find(f'{A}rPr')
            if rPr is None:
                continue
            if rPr.get('sz'):
                ukuran = int(rPr.get('sz')) / 100
            if rPr.get('b'):
                tebal = rPr.get('b') == '1'
            solid = rPr.find(f'{A}solidFill/{A}srgbClr')
            if solid is not None:
                warna = solid.get('val')
            latin = rPr.find(f'{A}latin')
            if latin is not None:
                font = latin.get('typeface')

        print(f'{nama:24}')
        print(f'   teks   : "{teks[:52]}"')
        print(f'   font   : {font or "(tidak disebut)"}')
        print(f'   ukuran : {ukuran if ukuran else "?"} pt   tebal: {tebal}   warna: #{warna or "?"}')
        print()
