"""Render setiap halaman PDF hasil konversi PPTX menjadi PNG."""

import sys
from pathlib import Path

import pymupdf

pdf = Path(sys.argv[1] if len(sys.argv) > 1 else 'render-ranking/contoh-ranking.pdf')
keluar = Path(pdf.parent)
doc = pymupdf.open(pdf)
print(f'{pdf.name}: {len(doc)} halaman')
for i, hal in enumerate(doc):
    tujuan = keluar / f'slide-{i + 1}.png'
    hal.get_pixmap(dpi=100).save(tujuan)
    print(f'  {tujuan}')
