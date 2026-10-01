"""Kecilkan kolom nama supaya kotak nilai yang digeser tidak bertumpuk.

Kotak nilai digeser ke x 4,7222 (sejajar huruf "r" pada "Service"), sedangkan
kolom nama tadinya 2,979 .. 5,029 -> bertumpuk 0,307 inci.

Kolom nama dikecilkan jadi 1,62 inci (berakhir di 4,599), lalu diberi jarak
0,12 sebelum kotak nilai. Nama yang sudah diringkas ("Irwan A." sekitar 1,0
inci, "Ahmad B. S." sekitar 1,4 inci) masih muat.
"""

from pathlib import Path

p = Path('/home/ubuntu/projects/btn-sip/src/lib/sip/ranking-pptx.ts')
s = p.read_text()

lama = """  const xNama = xFoto + wFoto + 0.18;   // langsung di kanan foto
  const wNama = 2.05;                   // ruang untuk nama panjang"""

baru = """  const xNama = xFoto + wFoto + 0.18;   // langsung di kanan foto
  // Kolom nama dikecilkan dari 2,05 jadi 1,62 inci supaya tidak bertumpuk
  // dengan kotak nilai yang digeser ke kiri (x 4,7222). Nama sudah diringkas
  // (kata pertama penuh + inisial), jadi 1,62 inci masih longgar: "Irwan A."
  // sekitar 1,0 inci, "Ahmad B. S." sekitar 1,4 inci.
  const wNama = 1.62;"""

if lama in s:
    s = s.replace(lama, baru)
    p.write_text(s)
    print('wNama: 2,05 -> 1,62')
else:
    print('POLA wNama tidak ketemu')

print()
print('Hasil:')
print(f'  kolom nama  : 2.979 .. {2.979 + 1.62:.3f}  (lebar 1,62)')
print(f'  kotak nilai : 4.7222 .. {4.7222 + 4.35:.3f}')
print(f'  jarak       : {4.7222 - (2.979 + 1.62):.3f} inci  -> tidak bertumpuk')
