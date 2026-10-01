"""Aktifkan table-layout: fixed untuk tabel versi lite.

Temuan: lebar kolom yang ditulis pada <th> diabaikan karena table-layout
default 'auto' menghitung lebar dari isi, sehingga semua kolom jadi rata
(~51,6pt). Dengan 'fixed', lebar yang ditentukan benar-benar dipakai dan
kolom Catatan menyerap sisa ruang.
"""

from pathlib import Path

p = Path('src/app/laporan/laporan.css')
s = p.read_text()

tambahan = """
/* table-layout: fixed WAJIB agar lebar kolom dihormati.
   Tanpa ini, tabel menghitung lebar dari isi dan semua kolom jadi rata. */
.sip-padat .sip-tabel {
  table-layout: fixed;
}
/* kolom Catatan yang menyerap sisa lebar; teksnya boleh membungkus */
.sip-padat .sip-tabel td:last-child {
  word-break: break-word;
  overflow-wrap: anywhere;
}
"""

if 'table-layout: fixed WAJIB' not in s:
    idx = s.rfind('}')
    s = s[:idx] + tambahan + '\n' + s[idx:]
    p.write_text(s)
    print('table-layout: fixed ditambahkan')
else:
    print('sudah ada')
