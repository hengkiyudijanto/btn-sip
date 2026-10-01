"""Membuktikan lebar kolom tabel ranking kini seragam antar tabel.

Tujuan: kolom Peringkat, Petugas, NIP, Nilai akhir, dan Kategori harus mulai di
posisi x yang SAMA di semua tabel (Customer Service dan Teller Service),
walaupun jumlah barisnya berbeda.

Cara: bangun HTML dari struktur tabel yang sama seperti di halaman, render
dengan Chrome headless, lalu ukur posisi x tiap kolom di kedua tabel.
"""

import json
import subprocess
import tempfile
from pathlib import Path

HTML = """<!doctype html>
<html><head><meta charset="utf-8">
<style>
  body { font-family: sans-serif; margin: 0; padding: 20px; }
  .kartu { border: 1px solid #ddd; border-radius: 8px; overflow: hidden; margin-bottom: 24px; }
  table { width: 100%; border-collapse: separate; border-spacing: 0; font-size: 0.875rem; }
  table.lebar-tetap { table-layout: fixed; }
  thead th {
    background: #f9fafb; padding: 0.625rem 0.875rem; text-align: left;
    font-weight: 600; font-size: 0.75rem; text-transform: uppercase;
    letter-spacing: 0.03em; color: #4b5563; border-bottom: 1px solid #e5e7eb;
  }
  tbody td { padding: 0.75rem 0.875rem; border-bottom: 1px solid #f3f4f6; }
  .kanan { text-align: right; }
</style></head><body>
  <div class="kartu"><table class="lebar-tetap" id="t1">
    <colgroup>
      <col style="width:12%"><col style="width:30%"><col style="width:18%">
      <col style="width:18%"><col style="width:22%">
    </colgroup>
    <thead><tr><th class="kanan">Peringkat</th><th>Petugas</th><th>NIP</th>
    <th class="kanan">Nilai akhir</th><th>Kategori</th></tr></thead>
    <tbody><tr><td class="kanan">1</td><td>MARINA KADIR</td><td>21806</td>
    <td class="kanan">4,31</td><td>Baik</td></tr></tbody>
  </table></div>

  <div class="kartu"><table class="lebar-tetap" id="t2">
    <colgroup>
      <col style="width:12%"><col style="width:30%"><col style="width:18%">
      <col style="width:18%"><col style="width:22%">
    </colgroup>
    <thead><tr><th class="kanan">Peringkat</th><th>Petugas</th><th>NIP</th>
    <th class="kanan">Nilai akhir</th><th>Kategori</th></tr></thead>
    <tbody>
      <tr><td class="kanan">1</td><td>HUSNIA PARADITHA</td><td>22847</td>
      <td class="kanan">3,99</td><td>Cukup</td></tr>
      <tr><td class="kanan">2</td><td>Irwan Allo</td><td>20885</td>
      <td class="kanan">3,51</td><td>Kurang</td></tr>
    </tbody>
  </table></div>
</body></html>"""

p = Path(tempfile.mkdtemp()) / 'uji-kolom.html'
p.write_text(HTML)

# skrip pengukuran
ukur = """
const hasil = {};
for (const id of ['t1', 't2']) {
  const t = document.getElementById(id);
  const th = t.querySelectorAll('thead th');
  const td = t.querySelector('tbody td');
  hasil[id] = {
    header: Array.from(th).map(e => Math.round(e.getBoundingClientRect().left)),
    sel: Array.from(t.querySelectorAll('tbody tr')[0].children)
              .map(e => Math.round(e.getBoundingClientRect().left)),
    lebar: Array.from(th).map(e => Math.round(e.getBoundingClientRect().width)),
  };
}
JSON.stringify(hasil);
"""

keluaran = Path('/tmp/ukur-kolom.json')
subprocess.run([
    '/usr/bin/google-chrome', '--headless=new', '--disable-gpu',
    '--no-sandbox', f'--window-size=1280,900',
    f'--dump-dom', f'file://{p}',
], capture_output=True, timeout=120)

# pakai node untuk mengukur (chrome headless tidak bisa eval langsung di sini)
js = f"""
const {{ chromium }} = require('playwright');
(async () => {{
  const b = await chromium.launch();
  const pg = await b.newPage({{ viewport: {{ width: 1280, height: 900 }} }});
  await pg.goto('file://{p}');
  const r = await pg.evaluate(() => {{
    {ukur}
  }});
  console.log(r);
  await b.close();
}})();
"""
Path('/tmp/ukur.js').write_text(js)
hasil2 = subprocess.run(
    ['node', '/tmp/ukur.js'],
    capture_output=True, text=True, timeout=180,
    cwd='/home/ubuntu/projects/btn-sip',
)
print(hasil2.stdout or hasil2.stderr)
