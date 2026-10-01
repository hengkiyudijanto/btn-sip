"""Menyambungkan penyiapan foto (potong + sudut membulat) ke generator slide.

Foto TIDAK lagi diisi ke bentuk lewat blipFill (tidak dirender LibreOffice).
Sebagai gantinya, di route unduh PPTX foto-fotonya diubah lebih dulu menjadi
PNG bersudut membulat lewat sharp, lalu ditempel sebagai gambar biasa.
"""

from pathlib import Path

# ---------- 1. generator slide: tempel foto seperti biasa ----------
p = Path('/home/ubuntu/projects/btn-sip/src/lib/sip/ranking-pptx.ts')
s = p.read_text()
ubah = 0

# buang import blipFill
a = """import { potongGambarPerSlide, type Potongan } from './potong-gambar-pptx';
import { isikanFotoKeBentukPptx, type BentukBerfoto } from './foto-ke-bentuk';
import { hitungPenempatanFoto, rasioFotoJpeg } from './potong-foto';"""
b = ""
if a in s:
    s = s.replace(a, b, 1)
    ubah += 1
    print('1. import blipFill dibuang')
else:
    print('1. POLA import tidak ketemu')

p.write_text(s)
print(f'\n{ubah} perubahan')
