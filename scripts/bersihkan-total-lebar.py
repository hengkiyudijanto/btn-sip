"""Bersihkan TOTAL semua aturan lebar kolom versi padat dari CSS.

Pelajaran dari percobaan-percobaan sebelumnya: lebar kolom jadi kacau
karena ada TIGA sumber yang saling bertabrakan:
  1. inline style kolomLebar di komponen  (ini yang benar)
  2. .sip-padat .sip-tabel .sip-k-* di CSS
  3. .sip-padat .sip-tabel th/td:nth-child(*) di CSS

Mulai sekarang satu sumber kebenaran saja: inline style di komponen.
Seluruh aturan lebar kolom di CSS dihapus.
"""

from pathlib import Path
import re

p = Path('/home/ubuntu/projects/btn-sip/src/app/laporan/laporan.css')
s = p.read_text()

sebelum = s

# 1. buang semua aturan .sip-padat ... sip-k-* yang mengatur width
s = re.sub(
    r'\n?\.sip-padat \.sip-tabel \.sip-k-[a-z]+ \{[^}]*\}\n?',
    '\n',
    s,
)
# 2. buang semua aturan .sip-padat ... nth-child(...)
s = re.sub(
    r'\n?\.sip-padat \.sip-tabel (?:th|td):nth-child\(\d\)[^{]*\{[^}]*\}\n?',
    '\n',
    s,
)
s = re.sub(
    r'\n?\.sip-padat \.sip-tabel t[hd]:nth-child\(\d\),\n\s*\.sip-padat \.sip-tabel t[hd]:nth-child\(\d\) \{[^}]*\}\n?',
    '\n',
    s,
)
# 3. buang sisa komentar/blok lebar kolom
s = re.sub(r'/\* -+ lebar kolom[^*]*\*/', '', s)
s = re.sub(r'/\*[^*]*menyerap sisa[^*]*\*/', '', s)
# 4. rapikan
s = re.sub(r'\n{3,}', '\n\n', s)
s = re.sub(r'\n\s*\n(\s*\})', r'\n\1', s)

if s.count('{') != s.count('}'):
    print(f'BATAL — kurung tidak seimbang: {s.count("{")} vs {s.count("}")}')
else:
    p.write_text(s)
    print('CSS dibersihkan total')

# verifikasi
sisa = re.findall(r'\.sip-padat \.sip-tabel [^{]*\{[^}]*\}', s)
print(f'\natau sisa aturan lebar kolom versi padat: {len(sisa)}')
for x in sisa:
    print(f'  {x}')
