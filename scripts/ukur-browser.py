"""Ukur ukuran kotak foto langsung di browser (getBoundingClientRect).

Ini cara yang andal: yang diukur adalah ukuran elemen yang benar-benar
dihitung browser, bukan piksel gambar di PDF.
"""

import json
import subprocess
import time
import urllib.request

import websocket  # type: ignore  # dipakai bila tersedia; heuristik fallback di bawah

PORT = 9444
chrome = subprocess.Popen(
    ['google-chrome', '--headless=new', '--disable-gpu', '--no-sandbox',
     f'--remote-debugging-port={PORT}', '--user-data-dir=/tmp/chrome-ukur',
     'about:blank'],
    stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
)
time.sleep(4)
print(f'chrome jalan di port {PORT}')
