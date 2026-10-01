"""Verifikasi: kelompok mana yang berisi huruf "r" pada "Service".

Judul "Service Drill Ranking":
  S e r v i c e   D r i l l   R a n k i n g
Dengan celah antar-huruf bervariasi, pengelompokan otomatis bisa
menggabungkan beberapa huruf. Skrip ini mencetak potongan gambar judul
supaya bisa diperiksa dengan mata, sekaligus mengukur tepi kiri tiap
kelompok.
"""

import pymupdf

PDF = '/home/ubuntu/projects/btn-sip/render-font/ranking-nyata.pdf'
X0, Y0, W, H = 3.576, 0.344, 6.225, 0.841

doc = pymupdf.open(PDF)
klip = pymupdf.Rect(X0 * 72, Y0 * 72, (X0 + W) * 72, (Y0 + H) * 72)
# perbesar 4x hanya bagian "Ser" untuk memastikan hurufnya
kiri = X0 + 0.50
kanan = X0 + 2.10
klip_zoom = pymupdf.Rect(kiri * 72, Y0 * 72, kanan * 72,
                         (Y0 + H) * 72)
p = doc[1].get_pixmap(dpi=900, clip=klip_zoom)
p.save('/home/ubuntu/projects/btn-sip/render-font/ser.png')
print(f'potongan "Ser..." : {p.width}x{p.height} piksel')
print(f'  area inci: x {kiri:.3f} .. {kanan:.3f}')
print(f'  skala: {p.width / (kanan - kiri):.1f} piksel/inci')

# tepi kiri tiap kolom berisi tinta, digabung sesuai jarak antar huruf
lebar, tinggi, n = p.width, p.height, p.n
sampel = p.samples
ada_tinta = []
for cx in range(lebar):
    ada = False
    for cy in range(0, tinggi, 2):
        i = (cy * lebar + cx) * n
        if sampel[i] > 170 and sampel[i + 1] > 170 and sampel[i + 2] > 170:
            ada = True
            break
    ada_tinta.append(ada)

print('\ntepi kiri setiap huruf (celah > 0,01 inci dianggap huruf baru):')
celah_piksel = int(0.01 * lebar / (kanan - kiri))
mulai = None
celah = 0
for i, ada in enumerate(ada_tinta):
    if ada:
        if mulai is None:
            mulai = i
        celah = 0
    else:
        if mulai is not None:
            celah += 1
            if celah > celah_piksel:
                skala = (kanan - kiri) / lebar
                print(f'  huruf mulai di x = {kiri + mulai * skala:.4f} inci')
                mulai = None
                celah = 0
if mulai is not None:
    skala = (kanan - kiri) / lebar
    print(f'  huruf mulai di x = {kiri + mulai * skala:.4f} inci')
