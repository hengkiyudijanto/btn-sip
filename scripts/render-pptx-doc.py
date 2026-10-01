"""Render PDF hasil konversi PPTX menjadi PNG per halaman."""

import pymupdf

doc = pymupdf.open('/home/ubuntu/projects/btn-sip/analisa-pptx/render/doc_0e5d25a83007_sip.pdf')
print('halaman:', len(doc))
for i, hal in enumerate(doc):
    hal.get_pixmap(dpi=110).save(f'/home/ubuntu/projects/btn-sip/analisa-pptx/render/slide-{i+1}.png')
print('PNG dibuat')
