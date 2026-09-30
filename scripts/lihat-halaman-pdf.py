import pymupdf

doc = pymupdf.open('/home/ubuntu/projects/btn-sip/laporan-lite.pdf')
print(f'=== LITE: {len(doc)} halaman ===')
for i, hal in enumerate(doc):
    teks = hal.get_text().strip()
    print(f'\n--- HALAMAN {i+1} ({len(teks)} karakter) ---')
    print(teks[:700])
