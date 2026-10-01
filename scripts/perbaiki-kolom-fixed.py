"""Perbaiki kolom versi lite: hindari width:auto pada table-layout fixed.

Dengan table-layout: fixed, kolom ber-width 'auto' tidak menyerap sisa
ruang — semua kolom 'auto' dibagi rata (109,1pt). Untuk membuat satu
kolom menyerap sisa, kolom LAIN harus punya lebar pasti dan kolom
penyerap dibiarkan TANPA width sama sekali.

Perbaikan:
  - kolom angka: lebar pasti
  - kolom Catatan: tidak diberi width (menyerap sisa)
  - kolom Aspek: lebar persen pasti
"""

from pathlib import Path
import re

p = Path('src/app/laporan/laporan.css')
s = p.read_text()

# buang blok lebar kolom yang ada
i = s.find('/* ---- Lebar kolom tabel (berlaku untuk kedua versi) ---- */')
if i > 0:
    # potong sampai akhir blok (sebelum penutup terakhir @media print)
    j = s.find('\n}', i)
    akhir = s.find('\n}', i + 100)
    if akhir > 0:
        s = s[:i] + s[akhir + 1:]

tambahan = """
/* ---- Lebar kolom tabel ---- */
/* PENTING: dengan table-layout: fixed, kolom yang diberi width:auto
   justru DIBAGI RATA dengan kolom auto lainnya. Untuk membuat kolom
   Catatan menyerap sisa ruang, kolom lain diberi lebar pasti dan kolom
   Catatan TIDAK diberi width sama sekali. */
.sip-tabel {
  table-layout: fixed;
  width: 100%;
}

/* Versi lengkap */
.sip-tabel .sip-k-no      { width: 28px; }
.sip-tabel .sip-k-aspek   { width: 30%; }
.sip-tabel .sip-k-angka   { width: 42px; }
.sip-tabel .sip-k-skor    { width: 48px; white-space: nowrap; }
.sip-tabel .sip-k-bobot   { width: 42px; }
.sip-tabel .sip-k-nilai   { width: 42px; }
/* .sip-k-catatan tanpa width -> menyerap sisa */

/* Versi lite: Aspek dikecilkan, kolom angka dipadatkan supaya Catatan
   mendapat ruang paling luas untuk catatan atasan yang panjang. */
.sip-padat .sip-tabel .sip-k-no    { width: 16px; }
.sip-padat .sip-tabel .sip-k-aspek { width: 21%; }
.sip-padat .sip-tabel .sip-k-angka { width: 28px; }
.sip-padat .sip-tabel .sip-k-skor  { width: 38px; }
.sip-padat .sip-tabel .sip-k-bobot { width: 30px; }
.sip-padat .sip-tabel .sip-k-nilai { width: 30px; }
/* .sip-padat .sip-k-catatan tanpa width -> menyerap sisa terbesar */

/* catatan panjang boleh membungkus rapi, tidak meluber keluar sel */
.sip-padat .sip-tabel .sip-k-catatan {
  word-break: break-word;
  overflow-wrap: anywhere;
}
"""

idx = s.rfind('}')
s = s[:idx] + tambahan + '\n' + s[idx:]
p.write_text(s)
print('lebar kolom ditulis ulang tanpa width:auto')
