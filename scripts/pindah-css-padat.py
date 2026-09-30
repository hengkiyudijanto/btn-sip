"""Pindahkan seluruh blok .sip-padat ke DALAM @media print.

Sebelumnya blok .sip-padat berada di luar @media print, sedangkan aturan
page-break-inside: avoid ada di dalamnya. Saat mencetak keduanya berlaku,
sehingga tabel tetap dipaksa utuh dan versi lite tidak muat satu halaman.
"""

from pathlib import Path

p = Path('src/app/laporan/laporan.css')
s = p.read_text()

penanda = '/* ==========================================================================\n   Versi LITE'
idx = s.find(penanda)
if idx < 0:
    raise SystemExit('blok sip-padat tidak ditemukan')

sebelum = s[:idx]
blok_padat = s[idx:]

if '.sip-padat' in sebelum:
    print('blok sip-padat sudah berada di bagian utama — melewati')
else:
    # '@media print {' dibuka di baris ~201 dan ditutup '}' sebelum blok padat
    akhir_media = sebelum.rfind('}')
    baru = (
        sebelum[:akhir_media]
        + '\n'
        + blok_padat.rstrip()
        + '\n'
        + sebelum[akhir_media:]
    )
    p.write_text(baru)
    print('blok sip-padat dipindah ke dalam @media print')
