"""Perbaiki colgroup: pakai style inline, bukan className.

React tidak meneruskan className ke <col> sebagai atribut class, sehingga
lebar kolom tidak terbaca (semua kolom jatuh ke 16px dari aturan pertama).
Untuk <col>, width harus diberikan lewat style inline atau atribut width.
Di sini dipakai style inline karena nilainya berasal dari prop versi.
"""

from pathlib import Path

c = Path('src/components/lembar-laporan.tsx')
t = c.read_text()

lama = """          <colgroup>
            <col className="sip-k-no" />
            <col className="sip-k-aspek" />
            <col className="sip-k-angka" />
            <col className="sip-k-skor" />
            <col className="sip-k-bobot" />
            <col className="sip-k-nilai" />
            <col className="sip-k-catatan" />
          </colgroup>"""

baru = """          <colgroup>
            <col style={{ width: kolomLebar.no }} />
            <col style={{ width: kolomLebar.aspek }} />
            <col style={{ width: kolomLebar.angka }} />
            <col style={{ width: kolomLebar.skor }} />
            <col style={{ width: kolomLebar.bobot }} />
            <col style={{ width: kolomLebar.nilai }} />
            {/* kolom Catatan tanpa width -> menyerap sisa ruang tabel */}
          </colgroup>"""

if lama in t:
    t = t.replace(lama, baru)
    print('colgroup memakai style inline')
else:
    print('POLA colgroup tidak ditemukan')

# tambahkan perhitungan kolomLebar di dalam komponen
if 'kolomLebar' in t and 'const kolomLebar' not in t:
    anchor = 'export function LembarLaporan({ data }: { data: DataLaporan }) {\n'
    tambah = anchor + """  /**
   * Lebar kolom tabel A/B/C.
   *
   * Diberikan lewat <colgroup> karena dengan table-layout: fixed, lebar
   * pada <th> diabaikan browser (akibatnya semua kolom dibagi rata).
   * Versi lite memakai lebar angka yang lebih kecil supaya kolom Catatan
   * mendapat ruang paling luas untuk catatan atasan yang panjang.
   */
  const padat = data.versi === 'lite';
  const kolomLebar = padat
    ? { no: '16px', aspek: '21%', angka: '28px', skor: '38px', bobot: '30px', nilai: '30px' }
    : { no: '28px', aspek: '30%', angka: '42px', skor: '48px', bobot: '42px', nilai: '42px' };
"""
    t = t.replace(anchor, tambah)
    print('perhitungan kolomLebar ditambahkan')

c.write_text(t)
print('selesai')
