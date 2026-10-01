"""Ukur seberapa banyak penyimpanan & pengiriman foto bisa dihemat.

Tiga hal yang diukur:
  1. Pemborosan base64: data URL vs ukuran biner aslinya (base64 +33%)
  2. Hubungan dimensi foto dengan ukuran JPEG (kualitas tetap 0,85)
  3. Dimensi yang dibutuhkan untuk cetak pada kotak 96x128 pt

Jalankan: ~/venvs/dev/bin/python scripts/analisa-foto.py
"""

from pathlib import Path
import base64
import glob

print('=== 1. PEMBOROSAN BASE64 ===')
ada = False
for f in sorted(glob.glob('/home/ubuntu/projects/btn-sip/*.jpg'))[:5]:
    data = Path(f).read_bytes()
    b64 = base64.b64encode(data)
    dataurl = len(b64) + len('data:image/jpeg;base64,')
    print(f'  {Path(f).name:22} biner {len(data):>8} B  ->  data URL {dataurl:>8} B '
          f'(+{dataurl / len(data) * 100 - 100:.0f}%)')
    ada = True
if not ada:
    print('  (tidak ada berkas .jpg di akar proyek)')

print('\n=== 2. UKURAN JPEG MENURUT DIMENSI (kualitas 0,85) ===')
print('  dimensi       rasio   3:4?    ukuran JPEG')
print('  ' + '-' * 50)

import pymupdf


def buat_foto(lebar: int, tinggi: int) -> bytes:
    """Foto uji dengan pola detail supaya JPEG berukuran realistis."""
    pix = pymupdf.Pixmap(pymupdf.csRGB, pymupdf.IRect(0, 0, lebar, tinggi))
    pix.clear_with(200)
    for y in range(0, tinggi, 2):
        for x in range(0, lebar, 2):
            r = (x * 255) // max(lebar, 1)
            g = (y * 255) // max(tinggi, 1)
            b = ((x + y) * 255) // max(lebar + tinggi, 1)
            pix.set_pixel(x, y, (r, g, b))
    return pix.tobytes('jpeg', jpg_quality=85)


ukuran = {}
for (l, t) in [(300, 400), (450, 600), (600, 800), (750, 1000), (900, 1200)]:
    data = buat_foto(l, t)
    ukuran[(l, t)] = len(data)
    rasio = l / t
    tanda = 'ya' if abs(rasio - 0.75) < 0.001 else 'TIDAK'
    print(f'  {l:>4}x{t:<5}   {rasio:.3f}   {tanda:<5}   {len(data):>8} B')

print('\n=== 3. KEBUTUHAN CETAK DI LAPORAN ===')
print('  Kotak foto di laporan = 96 x 128 pt (rasio 3:4)')
for dpi in (150, 200, 300, 600):
    px = round(96 / 72 * dpi)
    py = round(128 / 72 * dpi)
    print(f'  cetak {dpi:>3} dpi -> butuh {px:>4} x {py:<4} px')

print('\n=== 4. KESIMPULAN ===')
k300 = ukuran[(300, 400)]
k450 = ukuran[(450, 600)]
print(f'  dimensi sekarang 300x400 : {k300:>7} B  '
      f'(di database jadi {k300 * 4 // 3:>7} B karena base64)')
print(f'  bila dinaikkan 450x600   : {k450:>7} B  '
      f'(di database jadi {k450 * 4 // 3:>7} B)')
print()
print('  Untuk kotak 96x128 pt, 300x400 px setara 225 dpi — sudah tajam untuk cetak.')
print('  Jadi dimensi foto SUDAH tepat; penghematan harus datang dari cara')
print('  menyimpan & mengirim, bukan dari memperkecil gambar.')
