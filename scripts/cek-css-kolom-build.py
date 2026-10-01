"""Periksa apakah aturan .sip-padat .sip-k-* benar-benar ada di CSS build."""

import glob
import re
from pathlib import Path

for f in glob.glob('/home/ubuntu/projects/btn-sip/.next/static/chunks/*.css'):
    teks = Path(f).read_text()
    if 'sip-k-aspek' not in teks:
        continue
    print(f'=== {Path(f).name} ===')
    # tampilkan semua aturan sip-k-*
    for m in re.finditer(r'([^{}]*sip-k-[a-z]+[^{}]*)\{([^}]*)\}', teks):
        print(f'  {m.group(1).strip():<58} {{ {m.group(2).strip()} }}')
    print(f'\n  ada .sip-padat: {"sip-padat" in teks}')
    # apakah .sip-padat .sip-k-aspek ada?
    print(f'  ada .sip-padat .sip-k-aspek: {"sip-padat .sip-k-aspek" in teks}')
