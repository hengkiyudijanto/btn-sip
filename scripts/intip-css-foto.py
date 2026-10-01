"""Periksa HTML & CSS kotak foto yang benar-benar dipakai browser."""

import subprocess, json, sys

# Ambil CSS aturan .sip-padat .sip-foto dan .sip-identitas
r = subprocess.run(
    ['grep', '-n', '-A', '8', r'\.sip-padat \.sip-foto {', 'src/app/laporan/laporan.css'],
    capture_output=True, text=True, cwd='/home/ubuntu/projects/btn-sip'
)
print('=== ATURAN .sip-padat .sip-foto ===')
print(r.stdout)

r2 = subprocess.run(
    ['grep', '-n', '-A', '10', r'\.sip-padat \.sip-identitas {', 'src/app/laporan/laporan.css'],
    capture_output=True, text=True, cwd='/home/ubuntu/projects/btn-sip'
)
print('=== ATURAN .sip-padat .sip-identitas ===')
print(r2.stdout)

# Cari .sip-foto di dalam .sip-identitas pada komponen
with open('/home/ubuntu/projects/btn-sip/src/components/lembar-laporan.tsx') as f:
    t = f.read()
i = t.find('sip-foto')
print('=== KONTEKS sip-foto DI KOMPONEN ===')
print(t[max(0,i-400):i+300])
