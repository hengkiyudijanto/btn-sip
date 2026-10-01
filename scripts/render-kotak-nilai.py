"""Render hanya kotak nilai, diperbesar, untuk memeriksa gradasinya."""

import pymupdf

BERKAS = '/home/ubuntu/projects/btn-sip/render-font/ranking-nyata.pdf'
KELUAR = '/home/ubuntu/projects/btn-sip/render-font/kotak-nilai.png'

doc = pymupdf.open(BERKAS)
hal = doc[1]
print('ukuran halaman (pt):', hal.rect)

# kotak nilai ada di x 5,149-9,499 inci dan y 2,391-2,791 inci
# (1 inci = 72 pt). Beri sedikit ruang di tepi.
klip = pymupdf.Rect(5.10 * 72, 2.34 * 72, 9.55 * 72, 2.85 * 72)
piksel = hal.get_pixmap(dpi=260, clip=klip)
piksel.save(KELUAR)
print(f'kotak nilai: {piksel.width}x{piksel.height} -> {KELUAR}')
