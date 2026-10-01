"""Membandingkan kotak foto (dan pembungkusnya) antara referensi & aplikasi."""

import sys
import xml.etree.ElementTree as ET

A = '{http://schemas.openxmlformats.org/drawingml/2006/main}'
P = '{http://schemas.openxmlformats.org/presentationml/2006/main}'
EMU = 914400


def periksa(path, label):
    akar = ET.parse(path).getroot()
    print(f'\n  {label}:')
    baris = []

    for sp in akar.iter():
        tag = sp.tag.split('}')[-1]
        nv = (sp.find(f'{P}nvPicPr/{P}cNvPr')
              or sp.find(f'{P}nvSpPr/{P}cNvPr')
              or sp.find(f'{P}nvGrpSpPr/{P}cNvPr'))
        if nv is None:
            continue
        xf = sp.find(f'.//{A}xfrm')
        if xf is None:
            continue
        off, ext = xf.find(f'{A}off'), xf.find(f'{A}ext')
        if off is None or ext is None:
            continue
        x = int(off.get('x')) / EMU
        y = int(off.get('y')) / EMU
        w = int(ext.get('cx')) / EMU
        h = int(ext.get('cy')) / EMU

        # area foto pada slide ini berkisar w/h 0,9 .. 1,3 inci
        if not (0.9 < w < 1.3 and 0.9 < h < 1.3):
            continue

        geo = sp.find(f'.//{A}prstGeom')
        bentuk = geo.get('prst') if geo is not None else tag
        # pembulatan sudut, kalau ada
        sudut = ''
        if geo is not None:
            gd = geo.find(f'{A}avLst/{A}gd')
            if gd is not None:
                sudut = f"  sudut={gd.get('fmla')}"

        baris.append((y, f'    {nv.get("name", "")[:24]:26} {bentuk:10} '
                         f'x={x:6.3f} y={y:6.3f} w={w:6.3f} h={h:6.3f} '
                         f'rasio={w / h:.3f}{sudut}'))

    for _, b in sorted(baris):
        print(b)
    return baris


REF = sys.argv[1] if len(sys.argv) > 1 else \
    '/home/ubuntu/projects/btn-sip/analisa-pptx/ppt/slides/slide2.xml'
APP = sys.argv[2] if len(sys.argv) > 2 else '/tmp/cekfix2/ppt/slides/slide2.xml'

periksa(REF, 'REFERENSI')
periksa(APP, 'APLIKASI')
