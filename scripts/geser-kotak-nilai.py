"""Geser kotak nilai ke kiri supaya sejajar dengan huruf "r" pada "Service".

Posisi huruf "r" diukur dari hasil render (judul ditulis di tengah kotaknya,
jadi tepi kiri kotak judul bukan tempat huruf "S" dimulai). Hasil ukur:
  S mulai 4,1060 inci
  e mulai 4,4002 inci
  r mulai 4,7222 inci   <- dipakai sebagai x kotak nilai

Lebar kolom tetap 4,350 supaya batang nilai (skala 0..5) tidak berubah
ukurannya; hanya titik awalnya yang bergeser.
"""

from pathlib import Path

p = Path('/home/ubuntu/projects/btn-sip/src/lib/sip/ranking-pptx.ts')
s = p.read_text()

lama = """  const xKotak = xNama + wNama + 0.12;
  const wKotak = 4.35;"""

baru = """  // xKotak: tepi kiri kotak nilai dibuat SEJAJAR dengan huruf "r" pada kata
  // "Service" di judul slide (permintaan user). Posisinya diukur dari hasil
  // render (scripts/cari-huruf-r.py) karena judul ditulis di tengah kotaknya
  // sehingga tepi kiri kotak judul bukan tempat huruf "S" dimulai.
  // Lebar kolom tetap supaya skala batang 0..5 tidak berubah.
  const xKotak = 4.7222;
  const wKotak = 4.35;"""

if lama in s:
    s = s.replace(lama, baru)
    p.write_text(s)
    print('xKotak digeser dari (xNama + wNama + 0,12) ke 4,7222')
else:
    print('POLA xKotak tidak ketemu')

# hitung dampaknya
xKotak = 4.7222
wKotak = 4.35
print()
print('Hasil setelah digeser:')
print(f'  xKotak lama (perkiraan) : {2.979 + 2.05 + 0.12:.4f}')
print(f'  xKotak baru             : {xKotak:.4f}')
print(f'  kolom nilai             : {xKotak:.3f} .. {xKotak + wKotak:.3f}')
print(f'  batang untuk 3,51       : {xKotak:.3f} .. {xKotak + wKotak * 3.51 / 5:.3f}')
print(f'  pil kriteria            : {xKotak + wKotak * 3.51 / 5 + 0.14:.3f} .. '
      f'{xKotak + wKotak * 3.51 / 5 + 0.14 + 1.30:.3f}')
print(f'  batas kanan slide       : 13.333')
