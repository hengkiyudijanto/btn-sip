"""Render PDF ke PNG dan laporkan font yang dipakai."""

import pymupdf

doc = pymupdf.open('/home/ubuntu/projects/btn-sip/render-font/ranking-nyata.pdf')
hal = doc[1]
print('font yang dipakai saat render:')
for f in sorted({x[3] for x in hal.get_fonts()}):
    print('  ', f)
hal.get_pixmap(dpi=110).save('/home/ubuntu/projects/btn-sip/render-font/slide-2.png')
print('PNG dibuat')
