"""Mengukur jarak AKTUAL antara ujung kanan nama dan tepi kotak nilai.

Dilakukan pada hasil render, bukan dihitung dari perkiraan. Area pengukuran
dimulai SETELAH garis tegak pemisah supaya garisnya tidak ikut terukur
(kesalahan ini sempat terjadi dan membuat hasilnya tampak menempel).
"""

import subprocess
from pathlib import Path

import pymupdf

PPTX = '/home/ubuntu/projects/btn-sip/uji-jarak.pptx'
PDF = '/tmp/ukur-nama/uji-jarak.pdf'
Path('/tmp/ukur-nama').mkdir(exist_ok=True)

subprocess.run(
    ['soffice', '--headless', '--convert-to', 'pdf', '--outdir', '/tmp/ukur-nama', PPTX],
    capture_output=True, timeout=300,
)

doc = pymupdf.open(PDF)
halaman = doc[2]

# Garis tegak pemisah ada di sekitar x 4,6 (xGaris). Untuk baris pertama,
# ukur area nama saja: mulai setelah foto (2,74) sampai sebelum garis (4,55).
X0, X1 = 2.75, 4.60
Y0, Y1 = 2.05, 2.45          # baris pertama (Husnia)

klip = pymupdf.Rect(X0 * 72, Y0 * 72, X1 * 72, Y1 * 72)
piksel = halaman.get_pixmap(dpi=600, clip=klip)
s, n = piksel.samples, piksel.n
W, H = piksel.width, piksel.height

kiri, kanan = W, 0
for cy in range(H):
    baris = cy * W * n
    for cx in range(W):
        i = baris + cx * n
        r, g, b = s[i], s[i + 1], s[i + 2]
        # teks nama berwarna PUTIH di atas latar biru
        if r > 200 and g > 200 and b > 200:
            if cx < kiri:
                kiri = cx
            if cx > kanan:
                kanan = cx

skala = 600.0
mulai = X0 + kiri / skala
akhir = X0 + kanan / skala

# posisi garis pemisah & kotak nilai yang sebenarnya dari PPTX
import xml.etree.ElementTree as ET
import zipfile

z = zipfile.ZipFile(PPTX)
akar = ET.fromstring(z.read('ppt/slides/slide3.xml'))
A = '{http://schemas.openxmlformats.org/drawingml/2006/main}'
P = '{http://schemas.openxmlformats.org/presentationml/2006/main}'
EMU = 914400

xGaris = None
xKotak = None
for sp in akar.iter(f'{P}sp'):
    xf = sp.find(f'.//{A}xfrm')
    if xf is None:
        continue
    off, ext = xf.find(f'{A}off'), xf.find(f'{A}ext')
    w = int(ext.get('cx')) / EMU
    x = int(off.get('x')) / EMU
    if abs(w - 0.01) < 0.001:
        xGaris = x
    if abs(w - 4.35) < 0.01:
        xKotak = x

print(f'  teks nama mulai      : {mulai:.3f} inci')
print(f'  teks nama berakhir   : {akhir:.3f} inci')
if xGaris:
    print(f'  garis pemisah        : {xGaris:.3f} inci')
    print(f'  jarak ke garis       : {xGaris - akhir:.3f} inci '
          f'({(xGaris - akhir) / 0.102:.1f} karakter)')
if xKotak:
    print(f'  kotak nilai mulai    : {xKotak:.3f} inci')
    print(f'  jarak ke kotak nilai : {xKotak - akhir:.3f} inci '
          f'({(xKotak - akhir) / 0.102:.1f} karakter)')
