"""Periksa isi PDF yang baru dicetak dari produksi."""

import pymupdf

for nama in ['laporan-lengkap', 'laporan-lite']:
    doc = pymupdf.open(f'/home/ubuntu/projects/btn-sip/{nama}.pdf')
    print(f'=== {nama}: {len(doc)} halaman ===')
    for i, hal in enumerate(doc):
        t = hal.get_text().strip()
        print(f'  hal {i+1}: {len(t)} karakter')
        if t:
            print(f'    {t[:150]!r}')
