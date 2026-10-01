"""Bersihkan aturan sisa .sip-padat .sip-tabel th:nth-child(*) yang menumpuk.

Riwayat: beberapa kali percobaan meninggalkan blok lama yang saling
bertabrakan. Blok 'nth-child(7) { width: auto }' memaksa tabel membagi
rata, sehingga lebar yang benar (dari inline style kolomLebar) kalah.

Tindakan: buang SEMUA aturan nth-child untuk sip-tabel pada versi padat,
sisakan satu sumber kebenaran yaitu inline style di komponen.
"""

from pathlib import Path
import re

p = Path('/home/ubuntu/projects/btn-sip/src/app/laporan/laporan.css')
s = p.read_text()

# buang seluruh blok aturan nth-child untuk tabel versi padat
pola = re.compile(
    r'\n?/\*[^*]*\*/?\n?\.sip-padat \.sip-tabel (?:th|td):nth-child\(\d\),\n'
    r'\.sip-padat \.sip-tabel (?:th|td):nth-child\(\d\) \{ width: [^}]*\}\n?',
    re.MULTILINE,
)
s2, n = pola.subn('\n', s)
if n:
    print(f'{n} blok nth-child bersih')

# buang juga bentuk satu baris
s2 = re.sub(
    r'\.sip-padat \.sip-tabel (?:th|td):nth-child\(\d\)\s*\{[^}]*\}\n?',
    '',
    s2,
)

# buang komentar blok lebar kolom yang sudah tidak dipakai
s2 = re.sub(
    r'/\* --- lebar kolom versi lite --- \*/[\s\S]*?(?=\n/\*|\n\.sip-padat \.sip-tabel \.sip-k-catatan|\Z)',
    '',
    s2,
)

# rapikan baris kosong berlebih
s2 = re.sub(r'\n{3,}', '\n\n', s2)

# pastikan kurung tetap seimbang
if s2.count('{') != s2.count('}'):
    print(f'PERINGATAN kurung tidak seimbang: {s2.count("{")} vs {s2.count("}")}')
else:
    p.write_text(s2)
    print('CSS dibersihkan, kurung seimbang')

# tampilkan sisa aturan yang menyentuh sip-tabel versi padat
print('\n=== SISA aturan .sip-padat ... sip-tabel ===')
for m in re.finditer(r'([^{}]*sip-padat[^{}]*sip-tabel[^{}]*)\{([^}]*)\}', s2):
    print(f'  {m.group(1).strip()[:70]}  ->  {m.group(2).strip()[:60]}')
