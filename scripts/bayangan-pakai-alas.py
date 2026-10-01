"""Bayangan kotak foto: beri bentuk berisi tipis di bawah foto.

Temuan dari uji: LibreOffice (dan sebagian penampil lain) tidak merender
bayangan pada bentuk yang isinya kosong (`fill: none`), karena bayangan
mengikuti bentuk isinya. Kotak foto kita transparan, jadi bayangannya tidak
muncul walaupun nilainya sudah benar.

Solusinya: gambar bentuk terpisah yang BERISI warna gelap tipis, ditaruh
TEPAT DI BELAKANG foto (digambar sebelum foto, karena pptxgenjs tidak punya
z-index — yang digambar belakangan menutupi yang sebelumnya). Bentuk itu
memberi bayangan; fotonya sendiri menutupinya sehingga yang terlihat hanya
bayangan yang meluber ke luar.

Warnanya dipilih biru tua yang sama dengan latar slide (0B2A8C) supaya kalau
ada bagian yang meluber sedikit, tidak terlihat sebagai garis aneh di
belakang foto transparan (sudut membulat foto tembus pandang).
"""

from pathlib import Path

p = Path('/home/ubuntu/projects/btn-sip/src/lib/sip/ranking-pptx.ts')
s = p.read_text()
ubah = 0

# ---------- 1. konstanta warna alas bayangan ----------
a = "const JARAK_ANTAR_FOTO = 0.10;"
b = """const JARAK_ANTAR_FOTO = 0.10;

/**
 * Warna alas bayangan kotak foto.
 *
 * Bentuk beralas ini diperlukan karena penampil tidak merender bayangan pada
 * bentuk yang isinya kosong — sedangkan kotak foto kita transparan. Warnanya
 * disamakan dengan latar slide supaya kalau ada bagian yang meluber di
 * belakang sudut foto yang tembus pandang, tidak terlihat sebagai garis.
 */
const WARNA_ALAS_BAYANGAN = BIRU_TUA;"""
if a in s:
    s = s.replace(a, b, 1)
    ubah += 1
    print('1. konstanta WARNA_ALAS_BAYANGAN')

# ---------- 2. gambar alas berbayangan sebelum bingkai foto ----------
a2 = """    // Bingkai foto: latar transparan, hanya garis putih, dengan BAYANGAN
    // supaya kotaknya terlihat terpisah dari latar. Kalau petugas belum punya
    // foto, kotaknya tetap terlihat dari garis putihnya saja.
    slide.addShape('roundRect', {
      x: xFoto, y, w: wFoto, h: hFoto,
      fill: { type: 'none' } as never,
      line: { color: PUTIH, width: 1.25 },
      rectRadius: RADIUS_FOTO,
      shadow: BAYANGAN,
    });"""

b2 = """    // Alas bayangan: bentuk berisi warna latar, digambar SEBELUM foto dan
    // bingkai. Bentuk berisi ini yang membawa bayangan; fotonya menutupinya,
    // jadi yang terlihat hanya bayangan yang meluber ke luar. Tanpa alas ini
    // bayangannya tidak muncul, karena bentuk transparan tidak diberi bayangan
    // oleh penampil.
    slide.addShape('roundRect', {
      x: xFoto, y, w: wFoto, h: hFoto,
      fill: { color: WARNA_ALAS_BAYANGAN },
      line: { color: WARNA_ALAS_BAYANGAN, width: 0 },
      rectRadius: RADIUS_FOTO,
      shadow: BAYANGAN,
    });

    // Bingkai foto: latar transparan, hanya garis putih, digambar setelah
    // alas sehingga berada di atasnya. Kalau petugas belum punya foto,
    // yang terlihat adalah alas berbayangan itu.
    slide.addShape('roundRect', {
      x: xFoto, y, w: wFoto, h: hFoto,
      fill: { type: 'none' } as never,
      line: { color: PUTIH, width: 1.25 },
      rectRadius: RADIUS_FOTO,
    });"""

if a2 in s:
    s = s.replace(a2, b2, 1)
    ubah += 1
    print('2. alas bayangan ditambahkan sebelum bingkai foto')
else:
    print('2. POLA bingkai foto tidak ketemu')

p.write_text(s)
print(f'\n{ubah} dari 2 perubahan diterapkan')
