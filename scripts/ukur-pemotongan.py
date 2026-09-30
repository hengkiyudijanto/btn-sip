import pymupdf

doc = pymupdf.open('/home/ubuntu/projects/btn-sip/laporan-lite.pdf')
print(f'=== LITE: {len(doc)} halaman ===\n')

for i, hal in enumerate(doc):
    t = hal.get_text().strip()
    print(f'--- HALAMAN {i+1}: {len(t)} karakter ---')
    print(f'  kepala: {t[:120]!r}')
    print(f'  ekor  : {t[-160:]!r}')
    blok = hal.get_text('blocks')
    if blok:
        bawah = max(b[3] for b in blok)
        print(f'  y terakhir: {bawah:.1f} pt, tinggi halaman {hal.rect.height:.1f} pt')
        print(f'  sisa bawah: {hal.rect.height - bawah:.1f} pt')
    print()

# sebaris ringkas: berapa pt yang perlu dihemat
print('=== KESIMPULAN ===')
print('Jika halaman 2 hanya berisi sedikit isi, yang perlu dihemat')
print('adalah tinggi isi halaman 2 dikurangi sisa ruang halaman 1.')
