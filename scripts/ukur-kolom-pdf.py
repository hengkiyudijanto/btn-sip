"""Ukur posisi kolom tabel dan ukuran foto pada PDF versi lite."""

import pymupdf

doc = pymupdf.open('/home/ubuntu/projects/btn-sip/laporan-lite.pdf')
hal = doc[0]

# simpan gambar untuk pemeriksaan visual
hal.get_pixmap(dpi=125).save('/home/ubuntu/projects/btn-sip/laporan-lite.png')

print(f'=== LEBAR HALAMAN: {hal.rect.width:.0f} pt ===\n')

# posisi x tiap header kolom
kata = hal.get_text('words')
header = ['NO', 'ASPEK', 'ANGKA', 'SKOR', 'BOBOT', 'NILAI', 'CATATAN']
print('=== POSISI X KOLOM (baris header pertama) ===')
for w in kata:
    if w[4] in header:
        print(f'  {w[4]:<9} x={w[0]:6.1f}  (kolom ke-{header.index(w[4])+1 if w[4] in header else "?"})')

# ukuran gambar (foto)
print('\n=== GAMBAR ===')
for i, img in enumerate(hal.get_images(full=True)):
    xref = img[0]
    kotak = hal.get_image_rects(xref)
    for r in kotak:
        print(f'  gambar {i+1}: lebar={r.width:.1f}pt tinggi={r.height:.1f}pt '
              f'rasio={r.width/r.height:.3f}')
