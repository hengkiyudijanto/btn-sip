"""Perbaiki lebar kolom versi lite.

Temuan dari pengukuran di mode cetak:
  - Kolom Nilai membengkak jadi 201,1 pt padahal hanya berisi angka
    seperti "0,74". Ini karena width:auto pada kolom Catatan tidak
    menyerap sisa ruang, sehingga kolom Nilai yang menyerap.
  - Kolom Catatan jadi 204,7 pt, padahal pemilik aplikasi minta
    DIPERBESAR untuk menampung catatan atasan yang panjang.

Perbaikan: kolom angka diberi lebar tetap dan Catatan menyerap seluruh
sisa ruang (width: auto pada kolom terakhir, dengan lebar lain tetap).
"""

from pathlib import Path
import re

p = Path('src/app/laporan/laporan.css')
s = p.read_text()

# buang blok lebar kolom lama
s = re.sub(
    r'\n/\* --- lebar kolom versi lite --- \*/[\s\S]*?(?=\n/\* |\n\.sip-padat \.sip-tabel th:nth-child\(4\),|\Z)',
    '\n',
    s,
)
# buang sisa aturan lebah kolom yang mungkin tertinggal
s = re.sub(
    r'\.sip-padat \.sip-tabel (th|td):nth-child\(\d\) \{ width: [^}]+\}\n?',
    '',
    s,
)

tambahan = """
/* --- lebar kolom versi lite --- */
/* Kolom angka dibuat tetap (isinya hanya angka pendek), sehingga sisa
   ruang otomatis jatuh ke kolom Catatan yang perlu paling lebar.
   Tanpa ini, kolom Nilai ikut menyerap ruang dan membengkak jadi ~200pt. */
.sip-padat .sip-tabel th:nth-child(1),
.sip-padat .sip-tabel td:nth-child(1) { width: 18px; }    /* No */
.sip-padat .sip-tabel th:nth-child(2),
.sip-padat .sip-tabel td:nth-child(2) { width: 26%; }     /* Aspek */
.sip-padat .sip-tabel th:nth-child(3),
.sip-padat .sip-tabel td:nth-child(3) { width: 30px; }    /* Angka */
.sip-padat .sip-tabel th:nth-child(4),
.sip-padat .sip-tabel td:nth-child(4) { width: 42px; }    /* Skor 1-5 */
.sip-padat .sip-tabel th:nth-child(5),
.sip-padat .sip-tabel td:nth-child(5) { width: 34px; }    /* Bobot */
.sip-padat .sip-tabel th:nth-child(6),
.sip-padat .sip-tabel td:nth-child(6) { width: 34px; }    /* Nilai */
/* Catatan menyerap seluruh sisa lebar tabel */
.sip-padat .sip-tabel th:last-child,
.sip-padat .sip-tabel td:last-child {
  width: auto;
  max-width: none;
}
"""

if 'lebar kolom versi lite' not in s:
    idx = s.rfind('}')
    s = s[:idx] + tambahan + '\n' + s[idx:]
    print('lebar kolom versi lite ditulis ulang')
else:
    print('PERINGATAN: penanda masih ada, periksa manual')

p.write_text(s)
print('selesai')
