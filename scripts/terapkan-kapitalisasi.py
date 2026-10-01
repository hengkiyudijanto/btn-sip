"""Menerapkan aturan kapitalisasi ke semua tampilan data dari database.

Aturan (permintaan user):
  1. Umum: huruf pertama tiap kata kapital, sisanya kecil.
  2. Nama cabang: kalau kata pertamanya KC/KCP, kata itu kapital semua.

Fungsi tampilannya ada di src/lib/sip/teks.ts (kapitalkan / kapitalkanCabang).

Skrip ini menyisipkan import dan membungkus pemakaian nama pegawai, nama
cabang, dan nama jabatan. Hasilnya DIPERIKSA satu per satu sebelum di-commit —
tidak diterapkan membuta.
"""

import re
from pathlib import Path

AKAR = Path('/home/ubuntu/projects/btn-sip/src')

# Pola yang menampilkan data dari DB. Dikelompokkan supaya bisa diperiksa
# per jenis — nama cabang pakai aturan khusus.
POLA_CABANG = [
    r'\{?pegawai\.cabang\.nama\}?',
    r'\{?p\.cabang\.nama\}?',
    r'\{?c\.nama\}?',
    r'\{?b\.nama\}?',
    r'\{?cabang\.nama\}?',
]

print('=== daftar kemunculan yang akan diperiksa ===')
for p in POLA_CABANG:
    total = 0
    for berkas in AKAR.rglob('*.tsx'):
        isi = berkas.read_text()
        n = len(re.findall(p, isi))
        if n:
            total += n
            print(f'  {p:34} {n:3}x  {berkas.relative_to(AKAR)}')
    if total == 0:
        print(f'  {p:34} (tidak ada)')
