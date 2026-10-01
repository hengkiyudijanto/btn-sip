"""Periksa urutan dan isi aturan sip-foto di CSS hasil build."""

import re
from pathlib import Path
import glob

for f in glob.glob('/home/ubuntu/projects/btn-sip/.next/static/chunks/*.css'):
    teks = Path(f).read_text()
    if 'sip-foto' not in teks:
        continue
    print(f'=== {Path(f).name} ===')
    # cari semua aturan yang menyentuh sip-foto beserta posisinya
    for m in re.finditer(r'([^{}]*sip-foto[^{}]*)\{([^}]*)\}', teks):
        pos = m.start()
        sel = m.group(1).strip()
        isi = m.group(2).strip()
        print(f'  pos={pos:>7}  {sel}')
        print(f'                {isi}')
    print()
