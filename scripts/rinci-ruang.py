import pymupdf

doc = pymupdf.open('/home/ubuntu/projects/btn-sip/laporan-lite.pdf')
hal = doc[0]
blok = sorted(hal.get_text('blocks'), key=lambda b: b[1])

print('=== PEMAKAIAN RUANG HALAMAN 1 (versi lite) ===')
print(f'{"y mulai":>8} {"y akhir":>8} {"tinggi":>7}  isi')
total = 0
for b in blok:
    tinggi = b[3] - b[1]
    teks = b[4].strip().replace('\n', ' ')[:52]
    print(f'{b[1]:8.1f} {b[3]:8.1f} {tinggi:7.1f}  {teks}')
    total += tinggi

print(f'\ntotal tinggi teks: {total:.0f} pt')
print(f'teks mulai y={blok[0][1]:.0f}, berakhir y={blok[-1][3]:.0f}')
print(f'tinggi halaman    : {hal.rect.height:.0f} pt')

# jarak kosong antar blok
print('\n=== JARAK KOSONG ANTAR BLOK (kandidat dirapatkan) ===')
for i in range(1, len(blok)):
    jeda = blok[i][1] - blok[i-1][3]
    if jeda > 3:
        print(f'  {jeda:5.1f} pt  setelah: {blok[i-1][4].strip()[:40]!r}')

# cari blok gambar (foto)
print('\n=== GAMBAR (kotak foto) ===')
gambar = hal.get_images(full=True)
print(f'  jumlah gambar: {len(gambar)}')
