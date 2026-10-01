"""Mencari posisi awal huruf "r" pada kata "Service" di judul.

Judul "Service Drill Ranking" ditulis di tengah kotaknya (perataan center),
jadi tepi kiri kotak BUKAN tempat huruf S dimulai. Untuk menyelaraskan kotak
nilai dengan huruf "r" pada "Service", posisinya harus diukur dari hasil
render (lebar tiap huruf tidak seragam dan tidak ada di XML).

Pendekatan: potong area judul dari hasil render pada resolusi tinggi, lalu
cari kolom piksel pertama yang berisi huruf setelah celah spasi kedua kata.
"""

import pymupdf

PDF = '/home/ubuntu/projects/btn-sip/render-font/ranking-nyata.pdf'
HAL = 1
# kotak judul (inci) dari referensi: x 3.576 y 0.344 w 6.225 h 0.841
X0, Y0, W, H = 3.576, 0.344, 6.225, 0.841

doc = pymupdf.open(PDF)
halaman = doc[HAL]
klip = pymupdf.Rect(X0 * 72, Y0 * 72, (X0 + W) * 72, (Y0 + H) * 72)
piksel = halaman.get_pixmap(dpi=600, clip=klip)
piksel.save('/home/ubuntu/projects/btn-sip/render-font/judul.png')

print(f'potongan judul: {piksel.width}x{piksel.height} piksel')
print(f'  (kotak judul {W:.3f} inci -> {piksel.width} piksel, '
      f'{piksel.width / W:.1f} piksel/inci)')

# Cari kolom yang berisi tinta (piksel terang di latar biru tua)
lebar = piksel.width
tinggi = piksel.height
sampel = piksel.samples
n_kanal = piksel.n

kolom_ada_tinta = []
for cx in range(lebar):
    ada = False
    for cy in range(0, tinggi, 2):          # langkah 2 supaya cepat
        idx = (cy * lebar + cx) * n_kanal
        r, g, b = sampel[idx], sampel[idx + 1], sampel[idx + 2]
        if r > 170 and g > 170 and b > 170:  # teks putih
            ada = True
            break
    kolom_ada_tinta.append(ada)

# kelompokkan kolom berisi tinta jadi "kata" (pisahkan kalau ada celah > 0,04 inci)
celah_piksel = int(0.04 * piksel.width / W)
kelompok = []
mulai = None
celah = 0
for i, ada in enumerate(kolom_ada_tinta):
    if ada:
        if mulai is None:
            mulai = i
        celah = 0
    else:
        if mulai is not None:
            celah += 1
            if celah > celah_piksel:
                kelompok.append((mulai, i - celah))
                mulai = None
                celah = 0
if mulai is not None:
    kelompok.append((mulai, len(kolom_ada_tinta) - 1))

print(f'\njumlah kelompok huruf/kata: {len(kelompok)}')
skala = W / piksel.width
for n, (a, b) in enumerate(kelompok):
    print(f'  kelompok {n + 1}: piksel {a}..{b}  -> '
          f'inci {X0 + a * skala:.4f} .. {X0 + b * skala:.4f}'
          f'   (lebar {(b - a) * skala:.3f})')
