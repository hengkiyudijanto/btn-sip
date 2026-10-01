"""Perbaiki proporsi foto versi lite.

Masalah: .sip-identitas memakai grid-template-columns '1fr 96px', jadi
kolom foto lebarnya tetap 96px walau kotak foto dinaikkan. Akibatnya foto
terukur 88,5 x 88,5 pt (rasio 1:1) — gepeng, bukan 3:4.

Perbaikan: kolom grid disesuaikan dengan lebar foto, dan kotak foto
dipastikan memakai rasio 3:4 (96 x 128 pt).
"""

from pathlib import Path

p = Path('src/app/laporan/laporan.css')
s = p.read_text()

# 1. samakan lebar kolom grid identitas dengan lebar foto pada versi lite
pola = """.sip-padat .sip-identitas {
  padding: 4px 6px;
  margin-bottom: 4px;
}"""
ganti = """.sip-padat .sip-identitas {
  padding: 4px 6px;
  margin-bottom: 4px;
  /* lebar kolom foto HARUS sama dengan .sip-padat .sip-foto (96px),
     kalau tidak foto dipaksa mengecil dan rasionya rusak */
  grid-template-columns: 1fr 96px;
  gap: 8px;
}"""
if pola in s:
    s = s.replace(pola, ganti)
    print('grid kolom identitas disesuaikan (96px)')
else:
    print('POLA grid identitas tidak ditemukan')

# 2. pastikan kotak foto memakai rasio 3:4 dan tidak melar
pola_foto = """.sip-padat .sip-foto {
  width: 96px;
  height: 128px;
  font-size: 8px;
}"""
ganti_foto = """.sip-padat .sip-foto {
  width: 96px;
  height: 128px; /* rasio 3:4 — jangan diubah tanpa menyesuaikan lebar */
  min-width: 96px;
  min-height: 128px;
  font-size: 8px;
  box-sizing: border-box;
}"""
if pola_foto in s:
    s = s.replace(pola_foto, ganti_foto)
    print('kotak foto dikunci pada 96x128 dengan box-sizing')
else:
    print('POLA kotak foto tidak ditemukan')

# 3. gambar di dalam kotak harus mengisi penuh tanpa merusak rasio
tambahan = """
/* gambar di dalam kotak foto wajib mengisi penuh tanpa melar */
.sip-padat .sip-foto img {
  width: 100% !important;
  height: 100% !important;
  object-fit: cover;
  display: block;
}
"""
if 'kotak foto wajib mengisi penuh' not in s:
    idx = s.rfind('}')
    s = s[:idx] + tambahan + '\n' + s[idx:]
    print('aturan gambar foto ditambahkan')

p.write_text(s)
print('\nselesai')
