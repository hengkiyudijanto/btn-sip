"""Bandingkan lebar tabel & kolom antara versi lengkap dan lite.

Versi lengkap benar, versi lite rata. Cari aturan CSS yang hanya berlaku
pada versi padat dan menyentuh lebar tabel.
"""

import re
from pathlib import Path

s = Path('/home/ubuntu/projects/btn-sip/src/app/laporan/laporan.css').read_text()

print('=== SEMUA aturan .sip-padat yang menyentuh width/max-width/table ===')
for m in re.finditer(r'([^{}]*sip-padat[^{}]*)\{([^}]*)\}', s):
    isi = m.group(2)
    if any(k in isi for k in ['width', 'table', 'padding', 'font-size', 'display']):
        sel = m.group(1).strip()
        if 'width' in isi or 'table-layout' in isi:
            print(f'  {sel}')
            print(f'      {isi.strip()[:130]}')

print('\n=== Aturan .sip-tabel (semua) ===')
for m in re.finditer(r'([^{}]*sip-tabel[^{}]*)\{([^}]*)\}', s):
    print(f'  {m.group(1).strip()}')
    print(f'      {m.group(2).strip()[:130]}')
