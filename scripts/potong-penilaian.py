"""Potong bagian atas tangkapan halaman penilaian supaya dropdown terbaca."""

import pymupdf

doc = pymupdf.open('/home/ubuntu/projects/btn-sip/cek-penilaian.png')
print('ukuran tangkapan:', doc[0].rect)
clip = pymupdf.Rect(0, 0, doc[0].rect.width, min(700, doc[0].rect.height))
pix = doc[0].get_pixmap(clip=clip, dpi=120)
pix.save('/home/ubuntu/projects/btn-sip/cek-penilaian-atas.png')
print('potongan atas disimpan')
