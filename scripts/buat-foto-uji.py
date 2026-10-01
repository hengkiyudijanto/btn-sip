"""Buat foto uji 3:4 dan periksa proporsi kotak fotonya pada PDF.

Gambar uji sebelumnya hanya JPEG 1x1 piksel, sehingga kotak tampilnya di
PDF tidak mencerminkan proporsi sebenarnya. Di sini dibuat foto 300x400
(rasio 3:4) memakai Chrome, lalu dicetak dan diukur.
"""

import base64
import json
import subprocess
import time
import urllib.request

import pymupdf

# ---- 1. buat foto 300x400 (rasio 3:4) dengan Chrome ----
port = 9333
chrome = subprocess.Popen(
    ['google-chrome', '--headless=new', '--disable-gpu', '--no-sandbox',
     f'--remote-debugging-port={port}', '--user-data-dir=/tmp/chrome-genfoto',
     'about:blank'],
    stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
)
time.sleep(4)

try:
    tab = json.loads(urllib.request.urlopen(f'http://127.0.0.1:{port}/json/new?about:blank').read())
except Exception:
    # endpoint baru memakai PUT
    req = urllib.request.Request(f'http://127.0.0.1:{port}/json/new?about:blank', method='PUT')
    tab = json.loads(urllib.request.urlopen(req).read())

import websocket  # noqa: E402

ws = websocket.create_connection(tab['webSocketDebuggerUrl'])
msg = {
    'id': 1,
    'method': 'Runtime.evaluate',
    'params': {
        'expression': """(() => {
          const cv = document.createElement('canvas');
          cv.width = 300; cv.height = 400;
          const x = cv.getContext('2d');
          const g = x.createLinearGradient(0, 0, 300, 400);
          g.addColorStop(0, '#00539f'); g.addColorStop(1, '#d4112e');
          x.fillStyle = g; x.fillRect(0, 0, 300, 400);
          x.fillStyle = '#fff'; x.font = 'bold 28px sans-serif';
          x.fillText('FOTO', 96, 190);
          x.font = 'bold 22px sans-serif';
          x.fillText('3x4', 116, 225);
          return cv.toDataURL('image/jpeg', 0.85);
        })()""",
        'returnByValue': True,
    },
}
ws.send(json.dumps(msg))
hasil = json.loads(ws.recv())
data_url = hasil['result']['result']['value']
ws.close()
chrome.terminate()

open('/tmp/foto-uji-3x4.txt', 'w').write(data_url)
print(f'foto uji dibuat: {len(data_url)} karakter')
print(f'  (300x400 piksel, rasio {300/400:.3f} = 3:4)')
