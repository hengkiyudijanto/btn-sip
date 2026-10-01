"""Menyambungkan pemotongan foto (srcRect) ke pembuat PPTX.

pptxgenjs tidak bisa menulis srcRect, jadi alurnya:
  1. saat menggambar tiap slide, catat berapa bagian foto yang harus dipotong
  2. setelah PPTX jadi, buka ZIP-nya dan sisipkan srcRect ke XML slide yang
     bersangkutan

Skrip ini menyunting src/lib/sip/ranking-pptx.ts.
"""

from pathlib import Path

p = Path('/home/ubuntu/projects/btn-sip/src/lib/sip/ranking-pptx.ts')
s = p.read_text()
ubah = 0

# ---------- 1. import ----------
a = "import { ringkasNama } from './nama-petugas';"
b = """import { ringkasNama } from './nama-petugas';
import { potongGambarPerSlide, type Potongan } from './potong-gambar-pptx';"""
if a in s:
    s = s.replace(a, b, 1)
    ubah += 1
    print('1. import potongGambarPerSlide ditambahkan')
else:
    print('1. POLA import tidak ketemu')

# ---------- 2. slideRanking menerima peta potongan ----------
a2 = """function slideRanking(
  prs: PptxGenJS,
  kelompok: DataRanking['kelompok'][number],
  petaFoto: Map<string, string>
) {"""
b2 = """function slideRanking(
  prs: PptxGenJS,
  kelompok: DataRanking['kelompok'][number],
  petaFoto: Map<string, string>,
  /** Diisi fungsi ini: nomor slide -> potongan foto yang dipakai. */
  potongan: Map<number, Potongan>
) {"""
if a2 in s:
    s = s.replace(a2, b2, 1)
    ubah += 1
    print('2. slideRanking menerima peta potongan')
else:
    print('2. POLA slideRanking tidak ketemu')

p.write_text(s)
print(f'\n{ubah} perubahan diterapkan')
