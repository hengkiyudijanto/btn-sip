"""Foto dijadikan latar bentuk kotak (blipFill), bukan gambar di atasnya.

Masalah sebelumnya: foto digambar sebagai <p:pic> bersudut tajam, lalu ditimpa
bingkai membulat. Sudut gambar kotak vs sudut bingkai bulat tidak sama, jadi
keempat sudut kotak terlihat bolong.

Solusi: kotak foto dibuat sebagai BENTUK (roundRect) yang diisi gambar, jadi
PowerPoint memotong fotonya mengikuti bentuk membulat itu. Bentuknya diberi
nama penanda (FOTO_1, FOTO_2, ...) supaya bisa ditukar jadi blipFill setelah
berkas PPTX jadi.
"""

from pathlib import Path

p = Path('/home/ubuntu/projects/btn-sip/src/lib/sip/ranking-pptx.ts')
s = p.read_text()
ubah = 0

# ---------- 1. import ----------
a = "import { potongGambarPerSlide, type Potongan } from './potong-gambar-pptx';"
b = """import { potongGambarPerSlide, type Potongan } from './potong-gambar-pptx';
import { isikanFotoKeBentukPptx, type BentukBerfoto } from './foto-ke-bentuk';"""
if a in s:
    s = s.replace(a, b, 1)
    ubah += 1
    print('1. import isikanFotoKeBentukPptx')
else:
    print('1. POLA import tidak ketemu')

# ---------- 2. ganti seluruh blok foto ----------
a2 = """    // foto: bingkai + gambar (foto penilaian periode ini)
    // Bingkai foto: latar transparan (kalau foto belum ada, kotaknya tetap
    // terlihat dari garis putihnya saja)
    slide.addShape('roundRect', {
      x: xFoto, y, w: wFoto, h: hFoto,
      fill: { type: 'none' } as never, line: { color: PUTIH, width: 1.25 },
      rectRadius: 0.18,
    });"""

b2 = """    // Kotak foto dibuat sebagai BENTUK membulat, bukan gambar biasa.
    //
    // Bentuknya diberi nama FOTO_n sebagai penanda. Setelah berkas PPTX jadi,
    // bentuk ini diisi fotonya lewat blipFill (lihat foto-ke-bentuk.ts),
    // sehingga fotonya MENGIKUTI bentuk membulat kotaknya — tidak ada lagi
    // sudut bolong seperti waktu fotonya digambar sebagai gambar kotak.
    //
    // Kalau petugas belum punya foto, bentuknya tetap terlihat dari garis
    // putihnya saja (latar transparan).
    slide.addShape('roundRect', {
      x: xFoto, y, w: wFoto, h: hFoto,
      fill: { type: 'none' } as never,
      line: { color: PUTIH, width: 1.25 },
      rectRadius: RADIUS_FOTO,
      objectName: `FOTO_${nomorSlide}_${i}`,
    });"""
if a2 in s:
    s = s.replace(a2, b2, 1)
    ubah += 1
    print('2. kotak foto jadi bentuk bernama')
else:
    print('2. POLA kotak foto tidak ketemu')

p.write_text(s)
print(f'\n{ubah} dari 2 perubahan diterapkan')
