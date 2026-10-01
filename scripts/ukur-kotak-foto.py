"""Ukur KOTAK foto (bukan piksel gambar) pada PDF versi lite.

get_image_rects pada gambar JPEG 1x1 px tidak mencerminkan kotak
tampilannya. Cara yang benar: periksa gambar hasil render PDF dan cari
kotak berisi foto, atau ukur dari koordinat gambar pada halaman.
"""

import pymupdf

doc = pymupdf.open('/home/ubuntu/projects/btn-sip/laporan-lite.pdf')
hal = doc[0]

print('=== SEMUA GAMBAR DENGAN KOTAK TAMPILNYA ===')
for img in hal.get_images(full=True):
    xref = img[0]
    info = doc.extract_image(xref)
    print(f'\ngambar xref={xref}: piksel asli {info["width"]}x{info["height"]} ({info["ext"]})')
    for r in hal.get_image_rects(xref):
        print(f'  kotak tampil: lebar={r.width:.1f}pt tinggi={r.height:.1f}pt rasio={r.width/r.height:.3f}')

# cari "kotak" dari gambar hasil render: cek blok yang mengandung
# keterangan foto untuk memperkirakan posisi
print('\n=== TEKS DI SEKITAR FOTO ===')
kata = hal.get_text('words')
for w in kata:
    if 'seragam' in w[4].lower() or 'name' in w[4].lower() or 'tag' in w[4].lower():
        print(f'  "{w[4]}" pada x={w[0]:.1f} y={w[1]:.1f}')

# gambar terbesar di halaman
print('\n=== GAMBAR TERBESAR ===')
semua = []
for img in hal.get_images(full=True):
    for r in hal.get_image_rects(img[0]):
        semua.append((r.width * r.height, r))
semua.sort(reverse=True, key=lambda x: x[0])
for luas, r in semua[:3]:
    print(f'  luas={luas:.0f} lebar={r.width:.1f} tinggi={r.height:.1f} rasio={r.width/r.height:.3f}')
