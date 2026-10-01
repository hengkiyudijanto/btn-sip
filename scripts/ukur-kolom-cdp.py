"""Membuktikan lebar kolom tabel ranking seragam antar tabel.

Mengukur posisi x tiap kolom di dua tabel dengan jumlah baris berbeda
(1 baris vs 2 baris) memakai Chrome DevTools Protocol.

Kalau `table-layout: fixed` + colgroup bekerja, posisi x kolom di kedua tabel
harus SAMA PERSIS.
"""

import json
import subprocess
import tempfile
import time
import urllib.request
from pathlib import Path

import websocket  # dari paket `websocket-client`

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

folder = Path(tempfile.mkdtemp())
berkas = folder / 'uji.html'
berkas.write_text(HTML)

chrome = subprocess.Popen([
    '/usr/bin/google-chrome', '--headless=new', '--disable-gpu',
    '--no-sandbox', '--remote-debugging-port=9333',
    '--remote-allow-origins=*',
    '--window-size=1280,900', 'about:blank',
], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

try:
    ws_url = None
    for _ in range(40):
        try:
            with urllib.request.urlopen('http://127.0.0.1:9333/json/version') as r:
                info = json.load(r)
                ws_url = info['webSocketDebuggerUrl']
                break
        except Exception:
            time.sleep(0.25)
    if not ws_url:
        raise SystemExit('chrome tidak siap')

    ws = websocket.create_connection(ws_url, timeout=30)
    id_pesan = 0
    tab = None

    def kirim(method, params=None, session=None):
        global id_pesan
        id_pesan += 1
        pesan = {'id': id_pesan, 'method': method}
        if params:
            pesan['params'] = params
        if session:
            pesan['sessionId'] = session
        ws.send(json.dumps(pesan))
        while True:
            jawab = json.loads(ws.recv())
            if jawab.get('id') == id_pesan:
                return jawab

    # buka tab baru
    tab = kirim('Target.createTarget', {'url': 'about:blank'})['result']['targetId']
    sesi = kirim('Target.attachToTarget', {'targetId': tab, 'flatten': True})['result']['sessionId']
    kirim('Page.enable', session=sesi)
    kirim('Page.navigate', {'url': f'file://{berkas}'}, session=sesi)
    time.sleep(2)

    skrip = """
    (() => {
      const hasil = {};
      for (const id of ['t1', 't2']) {
        const t = document.getElementById(id);
        const th = Array.from(t.querySelectorAll('thead th'));
        const td = Array.from(t.querySelectorAll('tbody tr')[0].children);
        hasil[id] = {
          header: th.map(e => Math.round(e.getBoundingClientRect().left)),
          sel: td.map(e => Math.round(e.getBoundingClientRect().left)),
          lebar: th.map(e => Math.round(e.getBoundingClientRect().width)),
        };
      }
      return JSON.stringify(hasil);
    })()
    """
    hasil = kirim('Runtime.evaluate', {
        'expression': skrip, 'returnByValue': True,
    }, session=sesi)

    data = json.loads(hasil['result']['result']['value'])

    nama_kolom = ['Peringkat', 'Petugas', 'NIP', 'Nilai akhir', 'Kategori']
    print('=== posisi x tiap kolom (piksel) ===\n')
    print(f'  {"kolom":13} {"tabel CS (1 baris)":>20} {"tabel Teller (2 baris)":>23} {"selisih":>9}')
    print('  ' + '-' * 68)

    beda_maks = 0
    for i, nama in enumerate(nama_kolom):
        a, b = data['t1']['header'][i], data['t2']['header'][i]
        d = abs(a - b)
        beda_maks = max(beda_maks, d)
        print(f'  {nama:13} {a:>20} {b:>23} {d:>9}')

    print()
    print('=== apakah header sejajar dengan datanya (tabel yang sama)? ===\n')
    for tid, label in [('t1', 'Customer Service'), ('t2', 'Teller Service')]:
        print(f'  {label}:')
        for i, nama in enumerate(nama_kolom):
            a, b = data[tid]['header'][i], data[tid]['sel'][i]
            tanda = 'OK' if abs(a - b) <= 1 else f'SELISIH {abs(a-b)} px'
            print(f'    {nama:13} header={a:5} data={b:5}  {tanda}')

    print()
    if beda_maks <= 1:
        print(f'=> BERHASIL: posisi kolom kedua tabel SAMA (selisih maks {beda_maks} px)')
    else:
        print(f'=> GAGAL: masih ada selisih sampai {beda_maks} px')

finally:
    chrome.terminate()
