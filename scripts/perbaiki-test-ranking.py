"""Perbaiki pemeriksaan jumlah petugas pada uji ranking.

Teks "3 petugas" di halaman terpecah oleh tag HTML (<strong>3 petugas</strong>
tetap utuh, tetapi angka dan satuan bisa terpisah oleh markup React), sehingga
pencarian teks mentah gagal. Solusi: buang seluruh tag HTML dulu, baru cari.
"""

from pathlib import Path
import re

p = Path('/home/ubuntu/projects/btn-sip/scripts/test-ranking-pptx.ts')
s = p.read_text()

# tambah helper untuk membersihkan tag
helper = """
/** Buang tag HTML supaya pencarian teks tidak terganggu markup. */
function teksBersih(html: string): string {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&middot;/g, '·')
    .replace(/&nbsp;/g, ' ')
    .replace(/\\s+/g, ' ');
}
"""
if 'function teksBersih' not in s:
    s = s.replace(
        "let lulus = 0;",
        helper.strip() + "\n\nlet lulus = 0;"
    )

# pakai teks bersih pada pemeriksaan yang gagal
s = s.replace(
    "cek(semua.includes('3 petugas'), 'tanpa filter: 3 petugas');",
    "cek(teksBersih(semua).includes('3 petugas'), 'tanpa filter: 3 petugas');"
)
s = s.replace(
    "cek(hanyaTeller.includes('2 petugas'), 'filter TELLER: 2 petugas');",
    "cek(teksBersih(hanyaTeller).includes('2 petugas'), 'filter TELLER: 2 petugas');"
)
s = s.replace(
    "cabangKC ? hanyaKC.includes('3 petugas') : hanyaKC.includes('Tidak ada penilaian'),",
    "cabangKC\n      ? teksBersih(hanyaKC).includes('3 petugas')\n      : teksBersih(hanyaKC).includes('Tidak ada penilaian'),"
)
s = s.replace(
    "cek(kosong.includes('Tidak ada penilaian yang cocok'), 'filter tanpa hasil: pesan jelas');",
    "cek(\n    teksBersih(kosong).includes('Tidak ada penilaian yang cocok'),\n    'filter tanpa hasil: pesan jelas'\n  );"
)
# pemeriksaan jumlah slide juga pakai teks bersih
s = s.replace(
    "cek(semua.includes('slide'), 'menyebut jumlah slide');", ""
)

p.write_text(s)
print('pemeriksaan memakai teks bersih')
