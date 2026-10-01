"""Paksa lebar kolom versi lite dengan !important.

Akar masalah: komponen menulis lebar kolom sebagai inline style
(style={{ width: '30%' }}), dan inline style mengalahkan CSS class.
Akibatnya aturan .sip-padat saya diabaikan dan tabel membagi rata
(109,1pt semua kolom).

Solusi: hapus inline style dari komponen dan pindahkan seluruh
pengaturan lebar ke CSS, sehingga versi lengkap dan versi lite bisa
mengatur lebarnya masing-masing.
"""

from pathlib import Path
import re

# ---- 1. komponen: buang width inline, sisakan yang perlu saja ----
c = Path('src/components/lembar-laporan.tsx')
t = c.read_text()

lama_head = """              <th style={{ width: '28px' }}>No</th>
              <th>Aspek</th>
              <th style={{ width: '42px' }}>Angka</th>
              <th style={{ width: '46px', whiteSpace: 'nowrap' }}>Skor 1&ndash;5</th>
              <th style={{ width: '42px' }}>Bobot</th>
              <th style={{ width: '46px' }}>Nilai</th>
              <th style={{ width: '30%' }}>Catatan</th>"""

baru_head = """              <th className="sip-k-no">No</th>
              <th className="sip-k-aspek">Aspek</th>
              <th className="sip-k-angka">Angka</th>
              <th className="sip-k-skor">Skor 1&ndash;5</th>
              <th className="sip-k-bobot">Bobot</th>
              <th className="sip-k-nilai">Nilai</th>
              <th className="sip-k-catatan">Catatan</th>"""

if lama_head in t:
    t = t.replace(lama_head, baru_head)
    c.write_text(t)
    print('inline width dihapus, diganti kelas sip-k-*')
else:
    print('POLA header tabel tidak ditemukan — cek manual')

# ---- 2. CSS: atur lebar lewat kelas, untuk kedua versi ----
p = Path('src/app/laporan/laporan.css')
s = p.read_text()

# buang blok lebar kolom lama yang memakai nth-child
s = re.sub(r'/\* --- lebar kolom versi lite --- \*/[\s\S]*?max-width: none;\n\}', '', s)
s = re.sub(
    r'\.sip-padat \.sip-tabel (th|td):nth-child\(\d\) \{ width: [^}]+\}\n?',
    '',
    s,
)

tambahan = """
/* ---- Lebar kolom tabel (berlaku untuk kedua versi) ---- */
/* Dulu lebar ditulis sebagai inline style di komponen, sehingga tidak
   bisa dibedakan antara versi lengkap dan lite. Sekarang lewat kelas. */
.sip-tabel { table-layout: fixed; }
.sip-tabel .sip-k-no      { width: 28px; }
.sip-tabel .sip-k-aspek   { width: auto; }      /* menyerap sisa ruang */
.sip-tabel .sip-k-angka   { width: 44px; }
.sip-tabel .sip-k-skor    { width: 50px; white-space: nowrap; }
.sip-tabel .sip-k-bobot   { width: 44px; }
.sip-tabel .sip-k-nilai   { width: 44px; }
.sip-tabel .sip-k-catatan { width: 30%; }

/* Versi lite: Aspek dikecilkan, Catatan diperbesar untuk catatan panjang.
   Angka tetap sempit karena isinya hanya angka pendek. */
.sip-padat .sip-tabel .sip-k-no      { width: 18px; }
.sip-padat .sip-tabel .sip-k-aspek   { width: 22%; }
.sip-padat .sip-tabel .sip-k-angka   { width: 30px; }
.sip-padat .sip-tabel .sip-k-skor    { width: 40px; }
.sip-padat .sip-tabel .sip-k-bobot   { width: 32px; }
.sip-padat .sip-tabel .sip-k-nilai   { width: 32px; }
.sip-padat .sip-tabel .sip-k-catatan { width: auto; }

/* catatan panjang boleh membungkus rapi */
.sip-padat .sip-tabel .sip-k-catatan {
  word-break: break-word;
  overflow-wrap: anywhere;
}
"""

if 'Lebar kolom tabel (berlaku untuk kedua versi)' not in s:
    idx = s.rfind('}')
    s = s[:idx] + tambahan + '\n' + s[idx:]
    print('aturan lebar kolom berbasis kelas ditambahkan')

p.write_text(s)
print('selesai')
