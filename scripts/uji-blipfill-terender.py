"""Membuktikan apakah foto hilang karena LibreOffice atau karena berkasnya.

Caranya: dari PPTX hasil aplikasi, ambil bentuk FOTO_ (yang diisi gambar lewat
blipFill) dan bandingkan dengan <p:pic> biasa di slide yang sama. Kalau <p:pic>
tampil tapi bentuknya tidak, penyebabnya renderer; kalau keduanya tidak tampil,
berkasnya yang salah.

Versi ini memakai LibreOffice untuk merender lalu memeriksa apakah ada piksel
yang bukan warna latar di area bentuk foto.
"""

import subprocess
import sys
from pathlib import Path

import pymupdf
from pptx import Presentation

PPTX = '/home/ubuntu/projects/btn-sip/ranking-nyata.pptx'
PDF = '/tmp/uji-render/ranking.pdf'

Path('/tmp/uji-render').mkdir(exist_ok=True)
subprocess.run(
    ['soffice', '--headless', '--convert-to', 'pdf',
     '--outdir', '/tmp/uji-render', PPTX],
    capture_output=True, timeout=300,
)

doc = pymupdf.open(PDF)
halaman = doc[1]

# area kotak foto pada slide 2 (inci)
X, Y, W, H = 1.608, 2.110, 1.191, 0.962
klip = pymupdf.Rect(X * 72, Y * 72, (X + W) * 72, (Y + H) * 72)
piksel = halaman.get_pixmap(dpi=200, clip=klip)

# latar slide berwarna biru tua (~ 0B 2A 8C). Kalau ada foto, akan ada
# piksel yang jauh berbeda dari biru itu.
sampel = piksel.samples
n = piksel.n
total = 0
beda = 0
for i in range(0, len(sampel), n * 7):
    r, g, b = sampel[i], sampel[i + 1], sampel[i + 2]
    total += 1
    # biru latar: b tinggi, r & g rendah
    if not (b > 100 and r < 80 and g < 80):
        beda += 1

print(f'piksel diperiksa : {total}')
print(f'piksel "bukan latar": {beda} ({beda / total * 100:.1f}%)')
print()
if beda / total > 0.3:
    print('=> ADA gambar di dalam kotak foto (blipFill dirender)')
else:
    print('=> KOTAK KOSONG: hanya latar + garis putih')

# cek juga: apakah <p:pic> di slide ini dirender (sebagai pembanding)
print()
print('=== bandingkan dengan <p:pic> di slide 1 (ringkasan) ===')
prs = Presentation(PPTX)
for idx, sl in enumerate(prs.slides):
    n_pic = sum(1 for sh in sl.shapes if sh.shape_type == 13)
    n_sp = sum(1 for sh in sl.shapes if sh.has_text_frame)
    print(f'  slide {idx + 1}: {n_pic} gambar, {n_sp} bentuk teks')
