"""Tiga perbaikan kotak foto & pil kriteria.

1. Kotak foto bersentuhan antar baris: tinggi kotak (0,962) sama persis dengan
   jarak antar baris (0,962), jadi tidak ada celah sama sekali. Kotak
   dikecilkan supaya ada jarak, tapi tetap di tengah barisnya.

2. Bayangan pada kotak foto.

3. Bayangan pada pil kriteria di kanan kotak nilai.
"""

from pathlib import Path

p = Path('/home/ubuntu/projects/btn-sip/src/lib/sip/ranking-pptx.ts')
s = p.read_text()
ubah = 0

# ---------- 1. konstanta jarak + ukuran kotak foto ----------
a = """const RADIUS_FOTO = 0.18;"""
b = """const RADIUS_FOTO = 0.18;

/**
 * Jarak antar kotak foto, dalam inci.
 *
 * Jarak antar baris adalah 0,962 inci. Sebelumnya tinggi kotak foto juga
 * 0,962 sehingga kotak dua petugas bersentuhan tepat (tidak ada celah sama
 * sekali). Kotaknya dikecilkan sedikit supaya ada jarak, tapi tetap di tengah
 * barisnya.
 */
const JARAK_ANTAR_FOTO = 0.10;

/**
 * Ukuran kotak foto. Tingginya = jarak antar baris dikurangi jarak pisah,
 * lebarnya mengikuti supaya proporsinya tetap.
 */
const RASIO_FOTO = 1.191 / 0.962;   // rasio asli kotak foto dari referensi

/** Bayangan untuk kotak foto dan pil kriteria. */
const BAYANGAN = {
  type: 'outer' as const,
  color: '000000',
  opacity: 0.45,
  blur: 6,
  offset: 2,
  angle: 90,          // 90 = ke bawah
};"""
if a in s:
    s = s.replace(a, b, 1)
    ubah += 1
    print('1. konstanta jarak foto + bayangan ditambahkan')

p.write_text(s)
print(f'\n{ubah} perubahan')
print()
print('Perhitungan ukuran kotak foto baru:')
jarak = 0.962
jarak_foto = 0.10
h = jarak - jarak_foto
w = h * (1.191 / 0.962)
print(f'  tinggi kotak : {h:.3f} inci (dari {jarak} dikurangi jarak {jarak_foto})')
print(f'  lebar kotak  : {w:.3f} inci')
print(f'  nanti di tengah baris: geser {(jarak_foto/2):.3f} inci')
