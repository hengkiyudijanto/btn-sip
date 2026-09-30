"""Rapatkan versi lite agar muat 1 halaman.

Berdasarkan pengukuran PDF: halaman 1 memakai 750 pt dari 784 pt yang
tersedia (sisa 58 pt), sedangkan lembar komitmen butuh ~176 pt. Jadi
perlu dihemat ~118 pt.

Penghematan diambil dari jarak kosong antar blok (15-18 pt jadi 5-7 pt),
tinggi baris identitas, dan ukuran kotak foto — TANPA mengurangi isi.
"""

from pathlib import Path

p = Path('src/app/laporan/laporan.css')
s = p.read_text()

# cari blok versi lite, tambahkan aturan penghematan di akhirnya
tambahan = """
/* --- penghematan ruang lanjutan: jarak antar blok --- */
/* Jarak antar tabel dan baris identitas menyumbang ~118 pt yang perlu
   dihemat supaya lembar komitmen ikut di halaman pertama. */
.sip-padat .sip-identitas {
  padding: 4px 6px;
  margin-bottom: 4px;
}
.sip-padat .sip-identitas table {
  font-size: 8px;
  line-height: 1.2;
}
.sip-padat .sip-identitas td,
.sip-padat .sip-identitas th {
  padding: 0.5px 0 !important;
}
.sip-padat .sip-foto {
  width: 54px;
  height: 72px;
}
.sip-padat .sip-foto-keterangan {
  width: 54px;
  font-size: 5.5px;
  margin-top: 1px;
}
.sip-padat .sip-tabel {
  font-size: 7.5px;
  margin-bottom: 3px;
}
.sip-padat .sip-tabel caption {
  font-size: 8px;
  padding: 2px 4px;
}
.sip-padat .sip-tabel th,
.sip-padat .sip-tabel td {
  padding: 1.5px 3px;
  line-height: 1.18;
}
.sip-padat .sip-total {
  padding: 4px 6px;
  margin-bottom: 3px;
}
.sip-padat .sip-total-nilai {
  font-size: 14px;
}
.sip-padat .sip-rating {
  padding: 4px 6px;
  margin-bottom: 3px;
  font-size: 8.5px;
  line-height: 1.3;
}
.sip-padat .sip-catatan {
  padding: 4px 6px;
  margin-bottom: 3px;
  font-size: 7.5px;
  line-height: 1.35;
}
.sip-padat .sip-komitmen {
  padding: 5px;
  margin-bottom: 2px;
}
.sip-padat .sip-komitmen-judul {
  font-size: 8.5px;
  margin-bottom: 2px;
}
.sip-padat .sip-komitmen p {
  font-size: 7.5px !important;
  line-height: 1.35 !important;
}
.sip-padat .sip-ttd-grid {
  margin-top: 4px;
  gap: 10px;
}
.sip-padat .sip-ttd-ruang {
  height: 32px;
  margin-bottom: 2px;
}
.sip-padat .sip-ttd-box {
  font-size: 7.5px;
}
.sip-padat .sip-footer {
  font-size: 6px;
  margin-top: 3px;
  padding-top: 2px;
}
"""

if 'penghematan ruang lanjutan' in s:
    print('aturan lanjutan sudah ada — melewati')
else:
    # sisipkan sebelum penutup terakhir @media print
    idx = s.rfind('}')
    s = s[:idx] + tambahan + '\n' + s[idx:]
    p.write_text(s)
    print('aturan penghematan lanjutan ditambahkan')
