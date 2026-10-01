"""Hapus table-layout: fixed — itu sumber masalahnya.

Riwayat percobaan:
  1. width pada <th>          -> dibagi rata (109,1pt)
  2. table-layout: fixed      -> dibagi rata (109,1pt)
  3. colgroup + className     -> tidak ter-render, jadi 16px semua
  4. colgroup style + fixed   -> tetap 16px rata

Kesimpulan: 'table-layout: fixed' pada tabel dengan <colgroup> yang
lebarnya persen membuat browser memakai lebar minimum sel. Solusi paling
sederhana dan andal: kembalikan ke table-layout auto, dan atur lebar
lewat <th> seperti semula (yang sudah terbukti bekerja di versi lengkap).
"""

from pathlib import Path
import re

# ---- 1. CSS: buang table-layout fixed dan aturan colgroup ----
p = Path('src/app/laporan/laporan.css')
s = p.read_text()

s = s.replace("""/* table-layout: fixed WAJIB agar lebar kolom dihormati.
   Tanpa ini, tabel menghitung lebar dari isi dan semua kolom jadi rata. */
.sip-padat .sip-tabel {
  table-layout: fixed;
}
""", "")

s = s.replace(""".sip-tabel {
  table-layout: fixed;
  width: 100%;
}
""", "")

s = s.replace("""/* <col> di dalam <colgroup> adalah cara yang dihormati table-layout: fixed.
   Lebar pada <th> diabaikan browser saat lebar tabel dihitung dari baris
   pertama (akibatnya semua kolom dibagi rata). */
.sip-tabel col.sip-k-no    { width: 28px; }
.sip-tabel col.sip-k-aspek { width: 30%; }
.sip-tabel col.sip-k-angka { width: 42px; }
.sip-tabel col.sip-k-skor  { width: 48px; }
.sip-tabel col.sip-k-bobot { width: 42px; }
.sip-tabel col.sip-k-nilai { width: 42px; }

.sip-padat .sip-tabel col.sip-k-no    { width: 16px; }
.sip-padat .sip-tabel col.sip-k-aspek { width: 21%; }
.sip-padat .sip-tabel col.sip-k-angka { width: 28px; }
.sip-padat .sip-tabel col.sip-k-skor  { width: 38px; }
.sip-padat .sip-tabel col.sip-k-bobot { width: 30px; }
.sip-padat .sip-tabel col.sip-k-nilai { width: 30px; }
""", "")

p.write_text(s)
print('table-layout fixed & aturan colgroup dibuang')

# ---- 2. Komponen: buang colgroup, kembalikan lebar ke <th> ----
c = Path('src/components/lembar-laporan.tsx')
t = c.read_text()

t = re.sub(
    r'          <colgroup>[\s\S]*?</colgroup>\n',
    '',
    t,
)

lama = """              <th className="sip-k-no">No</th>
              <th className="sip-k-aspek">Aspek</th>
              <th className="sip-k-angka">Angka</th>
              <th className="sip-k-skor">Skor 1&ndash;5</th>
              <th className="sip-k-bobot">Bobot</th>
              <th className="sip-k-nilai">Nilai</th>
              <th className="sip-k-catatan">Catatan</th>"""

baru = """              <th style={{ width: kolomLebar.no }}>No</th>
              <th style={{ width: kolomLebar.aspek }}>Aspek</th>
              <th style={{ width: kolomLebar.angka }}>Angka</th>
              <th style={{ width: kolomLebar.skor, whiteSpace: 'nowrap' }}>Skor 1&ndash;5</th>
              <th style={{ width: kolomLebar.bobot }}>Bobot</th>
              <th style={{ width: kolomLebar.nilai }}>Nilai</th>
              {/* Catatan tanpa lebar -> menyerap sisa ruang tabel */}
              <th>Catatan</th>"""

if lama in t:
    t = t.replace(lama, baru)
    print('lebar kolom dikembalikan ke <th>')
else:
    print('POLA th tidak ditemukan')

c.write_text(t)
print('selesai')
