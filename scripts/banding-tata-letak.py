"""Membandingkan tata letak & font slide referensi vs slide aplikasi.

Membaca kedua file PPTX dan mencetak setiap elemen (posisi, ukuran, font,
ukuran font, bold) supaya bisa dibandingkan berdampingan — bukan dikira-kira
dari gambar.

Pemakaian:
    python scripts/banding-tata-letak.py <slide-referensi.xml> <slide-aplikasi.xml>
"""

import re
import sys
import xml.etree.ElementTree as ET

A = '{http://schemas.openxmlformats.org/drawingml/2006/main}'
P = '{http://schemas.openxmlformats.org/presentationml/2006/main}'
EMU = 914400

REF = sys.argv[1] if len(sys.argv) > 1 else \
    '/home/ubuntu/projects/btn-sip/analisa-pptx/ppt/slides/slide2.xml'
APP = sys.argv[2] if len(sys.argv) > 2 else '/tmp/cekprodhal/ppt/slides/slide2.xml'


def kumpulkan(path):
    """Ambil semua bentuk dari satu slide, termasuk yang di dalam grup."""
    akar = ET.parse(path).getroot()
    spTree = akar.find(f'{P}cSld/{P}spTree')
    hasil = []

    def proses(sp, grup=''):
        tag = sp.tag.split('}')[-1]
        nv = (sp.find(f'{P}nvSpPr/{P}cNvPr')
              or sp.find(f'{P}nvGrpSpPr/{P}cNvPr')
              or sp.find(f'{P}nvPicPr/{P}cNvPr'))
        nama = nv.get('name') if nv is not None else '?'

        xfrm = sp.find(f'.//{A}xfrm')
        if xfrm is not None:
            off, ext = xfrm.find(f'{A}off'), xfrm.find(f'{A}ext')
            if off is not None and ext is not None:
                x = int(off.get('x')) / EMU
                y = int(off.get('y')) / EMU
                w = int(ext.get('cx')) / EMU
                h = int(ext.get('cy')) / EMU
                teks = ''.join(t.text or '' for t in sp.iter(f'{A}t')).strip()
                rpr = None
                for r in sp.iter(f'{A}rPr'):
                    rpr = r
                    break
                font = None
                sz = None
                bold = None
                if rpr is not None:
                    sz = int(rpr.get('sz')) / 100 if rpr.get('sz') else None
                    bold = rpr.get('b')
                    for latin in rpr.iter(f'{A}latin'):
                        font = latin.get('typeface')
                        break
                hasil.append({
                    'grup': grup, 'tag': tag, 'nama': nama,
                    'x': x, 'y': y, 'w': w, 'h': h,
                    'teks': teks, 'font': font, 'sz': sz, 'bold': bold,
                })

        if tag == 'grpSp':
            for anak in sp:
                if anak.tag.split('}')[-1] in ('sp', 'grpSp', 'pic'):
                    proses(anak, grup or nama)

    for anak in spTree:
        if anak.tag.split('}')[-1] in ('sp', 'grpSp', 'pic'):
            proses(anak)
    return hasil


def cetak(data, judul):
    print(f'\n{"=" * 76}\n{judul}\n{"=" * 76}')
    for d in data:
        s = f"  {d['nama'][:22]:24} x={d['x']:7.3f} y={d['y']:7.3f} w={d['w']:6.3f} h={d['h']:6.3f}"
        if d['sz'] or d['font']:
            s += f"  {d['sz'] or '-':>6}pt {str(d['font'])[:14]:<15} b={d['bold']}"
        if d['teks']:
            s += f'  "{d["teks"][:26]}"'
        print(s)


ref = kumpulkan(REF)
app = kumpulkan(APP)
cetak(ref, 'FILE REFERENSI (sip.pptx)')
cetak(app, 'HASIL APLIKASI')

print(f'\n{"=" * 76}\nRINGKASAN\n{"=" * 76}')
print(f'  jumlah elemen referensi : {len(ref)}')
print(f'  jumlah elemen aplikasi  : {len(app)}')

# font & ukuran yang dipakai
def ringkas(data):
    font = {}
    sz = {}
    for d in data:
        if d['font']:
            font[d['font']] = font.get(d['font'], 0) + 1
        if d['sz']:
            sz[d['sz']] = sz.get(d['sz'], 0) + 1
    return font, sz

fr, sr = ringkas(ref)
fa, sa = ringkas(app)
print(f'\n  font referensi : {dict(sorted(fr.items()))}')
print(f'  font aplikasi  : {dict(sorted(fa.items()))}')
print(f'\n  ukuran referensi : {dict(sorted(sr.items()))}')
print(f'  ukuran aplikasi  : {dict(sorted(sa.items()))}')
