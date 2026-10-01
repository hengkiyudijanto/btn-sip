"""Mengukur lebar teks nama pada font & ukuran yang dipakai slide.

Dipilih mengukur langsung dari hasil render, bukan menghitung dari tabel
lebar huruf: font Aptos tidak tersedia di sistem ini sehingga lebar tiap
huruf tidak bisa dipastikan dari daftar metrik. Yang diukur di sini adalah
LEBAR AKTUAL setelah dirender, jadi angkanya bisa dipercaya.

Hasilnya dipakai untuk memutuskan: nama ringkas ("Irwan A.") atau nama dua
kata penuh ("Irwan Allo") yang masih muat di kolom nama.
"""

import subprocess
from pathlib import Path

import pymupdf

# kotak teks nama di slide (inci)
X, Y, W, H = 2.979, 2.110, 1.663, 0.962

CONTOH = [
    'Irwan A.',
    'Irwan Allo',
    'Husnia P.',
    'Husnia Paraditha',
    'Marina K.',
    'Marina Kadir',
    'Muh I.',
    'Muh Ilham',
    'Fitria N. J.',
    'Fitria Nur Jaya',
    'Andi A.',
    'Andi Aswar',
    'Ardiansah',
    'Rahmat',
    'Afria H.',
    'Afria Hidayana',
]


def ukur(nama: str) -> float:
    """Kembalikan lebar teks (inci) pada ukuran font yang sama dengan slide."""
    # Bangun HTML sederhana meniru slide: latar biru, teks putih 16 pt Aptos
    html = f"""<!doctype html>
<html><head><meta charset="utf-8">
<style>
  @page {{ size: 13.33333in 7.5in; margin: 0; }}
  body {{ margin: 0; background: #1226AA; }}
  .kotak {{
    position: absolute;
    left: {X}in; top: {Y}in;
    width: {W}in; height: {H}in;
    font-family: Aptos, Calibri, sans-serif;
    font-size: 16pt; font-weight: bold; color: #FFFFFF;
    display: flex; align-items: center;
  }}
  span {{ white-space: nowrap; }}
</style></head><body>
  <div class="kotak"><span id="t">{nama}</span></div>
</body></html>"""

    f = Path('/tmp/ukur-nama.html')
    f.write_text(html)

    subprocess.run([
        '/usr/bin/google-chrome', '--headless=new', '--disable-gpu',
        '--no-sandbox', '--print-to-pdf=/tmp/ukur-nama.pdf',
        '--no-pdf-header-footer', f'file://{f}',
    ], capture_output=True, timeout=120)

    doc = pymupdf.open('/tmp/ukur-nama.pdf')
    halaman = doc[0]
    # cari batas teks putih
    piksel = halaman.get_pixmap(dpi=300)
    s, n = piksel.samples, piksel.n
    lebar_px, tinggi_px = piksel.width, piksel.height
    kiri, kanan = lebar_px, 0
    for cy in range(tinggi_px):
        baris = cy * lebar_px * n
        for cx in range(lebar_px):
            i = baris + cx * n
            r, g, b = s[i], s[i + 1], s[i + 2]
            if r > 200 and g > 200 and b > 200:
                if cx < kiri:
                    kiri = cx
                if cx > kanan:
                    kanan = cx
    doc.close()
    if kanan <= kiri:
        return 0.0
    return (kanan - kiri + 1) / 300.0


print(f'kotak nama: x={X} lebar={W} inci (mulai di 2,979; batas kotak nilai 4,7222)')
print()
print(f'  {"teks":20} {"lebar (inci)":>14}  {"muat?":>8}')
print('  ' + '-' * 46)
for nama in CONTOH:
    w = ukur(nama)
    muat = 'MUAT' if w <= W else 'TIDAK'
    print(f'  {nama:20} {w:>14.3f}  {muat:>8}')

Path('/tmp/ukur-nama.html').unlink(missing_ok=True)
Path('/tmp/ukur-nama.pdf').unlink(missing_ok=True)
