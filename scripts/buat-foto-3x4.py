"""Periksa proporsi kotak foto pada PDF versi lite memakai gambar 3:4.

Gambar uji sebelumnya hanya JPEG 1x1 piksel sehingga kotak tampilnya di
PDF direkam sebagai persegi dan tidak bisa dipakai memvalidasi proporsi.
Di sini dibuat JPEG 300x400 asli (rasio 3:4) tanpa pustaka luar.
"""

import base64
import struct
import zlib

LEBAR, TINGGI = 300, 400


def buat_jpeg_polos(lebar: int, tinggi: int) -> bytes:
    """Bangun JPEG minimal dengan gradien sederhana (tanpa PIL)."""
    # Kanvas RGB: gradien biru -> merah
    baris = []
    for y in range(tinggi):
        piksel = bytearray()
        for x in range(lebar):
            t = (x + y) / (lebar + tinggi)
            r = int(0 + t * 212)
            g = int(83 - t * 66)
            b = int(159 - t * 113)
            piksel += bytes([r, g, b])
        baris.append(bytes(piksel))
    mentah = b''.join(b'\x00' + b for b in baris)

    def segmen(penanda: bytes, isi: bytes) -> bytes:
        return b'\xff' + penanda + struct.pack('>H', len(isi) + 2) + isi

    # Kuantisasi sederhana: tabel datar (kualitas rendah, cukup untuk uji rasio)
    tabel = bytes([16] * 64)

    keluaran = b'\xff\xd8'  # SOI
    keluaran += segmen(b'\xdb', b'\x00' + tabel)  # DQT
    keluaran += segmen(
        b'\xc0',
        struct.pack('>BHHB', 8, tinggi, lebar, 3)
        + b'\x01\x11\x00\x02\x11\x00\x03\x11\x00',
    )  # SOF0
    keluaran += segmen(b'\xc4', b'\x00' + b'\x00' * 16 + bytes([0]))  # DHT minimal
    keluaran += segmen(b'\xda', b'\x03\x01\x00\x02\x11\x03\x11\x00\x3f\x00')  # SOS
    keluaran += zlib.compress(mentah, 9)
    keluaran += b'\xff\xd9'
    return keluaran


data = buat_jpeg_polos(LEBAR, TINGGI)
b64 = base64.b64encode(data).decode()
data_url = f'data:image/jpeg;base64,{b64}'

with open('/home/ubuntu/projects/btn-sip/foto-uji-3x4.txt', 'w') as f:
    f.write(data_url)

print(f'foto uji dibuat: {LEBAR}x{TINGGI} piksel, rasio {LEBAR/TINGGI:.3f}')
print(f'ukuran data URL: {len(data_url)} karakter')
print(f'disimpan di: foto-uji-3x4.txt')
