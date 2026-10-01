"""Render versi lite ke PNG dan periksa ukuran kotak foto."""

import pymupdf

doc = pymupdf.open('/home/ubuntu/projects/btn-sip/laporan-lite.pdf')
print(f'lite: {len(doc)} halaman')
hal = doc[0]
for img in hal.get_images(full=True):
    info = doc.extract_image(img[0])
    for r in hal.get_image_rects(img[0]):
        print(f'  gambar {info["width"]}x{info["height"]} px -> kotak '
              f'{r.width:.1f} x {r.height:.1f} pt, rasio {r.width/r.height:.3f}')
hal.get_pixmap(dpi=120).save('/home/ubuntu/projects/btn-sip/laporan-lite.png')
print('PNG diperbarui')
