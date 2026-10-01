"""Tambahkan <colgroup> ke tabel laporan.

Temuan: dengan table-layout: fixed, lebar kolom yang ditulis pada <th>
DIABAIKAN bila lebar tabel dihitung dari baris pertama. Browser membagi
rata (765 / 7 = 109,1px). Solusi standar: tentukan lebar lewat <colgroup>,
yang memang dirancang untuk itu dan dihormati oleh table-layout: fixed.
"""

from pathlib import Path

c = Path('src/components/lembar-laporan.tsx')
t = c.read_text()

# colgroup untuk tabel A/B/C, diletakkan tepat setelah <table ...>
lama = "          <thead>\n            <tr>\n              <th className=\"sip-k-no\">No</th>"
baru = """          <colgroup>
            <col className="sip-k-no" />
            <col className="sip-k-aspek" />
            <col className="sip-k-angka" />
            <col className="sip-k-skor" />
            <col className="sip-k-bobot" />
            <col className="sip-k-nilai" />
            <col className="sip-k-catatan" />
          </colgroup>
          <thead>
            <tr>
              <th className="sip-k-no">No</th>"""

if lama in t:
    t = t.replace(lama, baru)
    print('colgroup ditambahkan ke tabel A/B/C')
else:
    print('POLA thead tidak ditemukan')
    # tampilkan konteks untuk diagnosis
    i = t.find('<thead>')
    print(t[max(0, i - 300):i + 300])

c.write_text(t)
