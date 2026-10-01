"""Perbesar foto penilaian ~2x dan atur ulang lebar kolom pada versi lite.

Permintaan pemilik aplikasi:
  - foto diperbesar sekitar 2x, tetap proporsional (rasio 3:4)
  - kolom Aspek dikecilkan (masih banyak ruang kosong)
  - kolom Catatan diperbesar untuk mengantisipasi catatan atasan yang panjang

Catatan: sebelumnya ada DUA aturan .sip-padat .sip-foto (72x96 lalu 54x72);
yang kedua menang sehingga foto justru mengecil. Blok duplikat dibersihkan.
"""

from pathlib import Path
import re

p = Path('src/app/laporan/laporan.css')
s = p.read_text()

# ---- 1. buang aturan .sip-padat .sip-foto yang DUPLIKAT ----
# aturan pertama (72x96) dihapus supaya hanya ada satu definisi
pola_dup = """.sip-padat .sip-foto {
  width: 72px;
  height: 96px;
  font-size: 7.5px;
}
.sip-padat .sip-foto-keterangan {
  width: 72px;
  font-size: 6.5px;
  margin-top: 2px;
}
"""
if pola_dup in s:
    s = s.replace(pola_dup, '')
    print('aturan .sip-foto duplikat (72x96) dibuang')

# ---- 2. perbesar foto jadi ~2x dengan rasio 3:4 tetap ----
# dari 54x72 -> 96x128 (rasio 3:4, luas ~2,4x). Dipakai 96x128 agar
# tetap proporsional dan tidak mendorong isi ke halaman kedua.
pola_kecil = """.sip-padat .sip-foto {
  width: 54px;
  height: 72px;
}"""
pola_besar = """.sip-padat .sip-foto {
  width: 96px;
  height: 128px;
  font-size: 8px;
}"""
if pola_kecil in s:
    s = s.replace(pola_kecil, pola_besar)
    print('foto diperbesar: 54x72 -> 96x128 (rasio 3:4)')

pola_kat = """.sip-padat .sip-foto-keterangan {
  width: 54px;
  font-size: 5.5px;
  margin-top: 1px;
}"""
pola_kat_besar = """.sip-padat .sip-foto-keterangan {
  width: 96px;
  font-size: 6.5px;
  margin-top: 2px;
}"""
if pola_kat in s:
    s = s.replace(pola_kat, pola_kat_besar)
    print('keterangan foto disesuaikan')

# ---- 3. atur lebar kolom tabel versi lite ----
# Kolom Aspek dikecilkan, Catatan diperbesar. Nilai ini menimpa
# width inline di komponen karena selektor kelas lebih spesifik saat cetak.
tambahan = """
/* --- lebar kolom versi lite --- */
/* Aspek dikecilkan karena masih banyak ruang kosong; ruang itu
   dipindahkan ke kolom Catatan supaya catatan panjang tetap muat. */
.sip-padat .sip-tabel th:nth-child(1),
.sip-padat .sip-tabel td:nth-child(1) { width: 20px; }   /* No */
.sip-padat .sip-tabel th:nth-child(2),
.sip-padat .sip-tabel td:nth-child(2) { width: 30%; }    /* Aspek */
.sip-padat .sip-tabel th:nth-child(3),
.sip-padat .sip-tabel td:nth-child(3) { width: 34px; }   /* Angka */
.sip-padat .sip-tabel th:nth-child(4),
.sip-padat .sip-tabel td:nth-child(4) { width: 38px; }   /* Skor 1-5 */
.sip-padat .sip-tabel th:nth-child(5),
.sip-padat .sip-tabel td:nth-child(5) { width: 34px; }   /* Bobot */
.sip-padat .sip-tabel th:nth-child(6),
.sip-padat .sip-tabel td:nth-child(6) { width: 36px; }   /* Nilai */
.sip-padat .sip-tabel th:nth-child(7),
.sip-padat .sip-tabel td:nth-child(7) { width: auto; }   /* Catatan */
"""

if 'lebar kolom versi lite' not in s:
    idx = s.rfind('}')
    s = s[:idx] + tambahan + '\n' + s[idx:]
    print('lebar kolom versi lite diatur')
else:
    print('lebar kolom sudah diatur')

p.write_text(s)
print('\nselesai')
