import pymupdf

doc = pymupdf.open('/home/ubuntu/projects/btn-sip/laporan-lite.pdf')
hal = doc[0]

# tinggi halaman A4 dalam poin
print(f'Ukuran halaman: {hal.rect.width:.1f} x {hal.rect.height:.1f} pt')
print(f'  (A4 = 595 x 842 pt)\n')

# cari posisi vertikal teks terakhir di halaman 1
blok = hal.get_text('blocks')
if blok:
    terakhir = max(b[3] for b in blok)
    print(f'teks terakhir berakhir di y = {terakhir:.1f} pt')
    print(f'sisa ruang bawah       = {hal.rect.height - terakhir:.1f} pt')

print('\n--- blok terakhir halaman 1 ---')
for b in sorted(blok, key=lambda x: -x[3])[:3]:
    print(f'  y={b[1]:.0f}-{b[3]:.0f} : {b[4][:70].strip()!r}')

# berapa banyak ruang yang dipakai tiap bagian
print('\n--- posisi awal tiap bagian ---')
for b in blok:
    teks = b[4].strip().replace('\n', ' ')[:45]
    print(f'  y={b[1]:6.1f}-{b[3]:6.1f}  {teks}')
