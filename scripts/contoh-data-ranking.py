"""Buat data contoh untuk menguji tampilan PPTX (sesuai lampiran user)."""

import base64
import json
from io import BytesIO
from pathlib import Path

import pymupdf


def foto_contoh(warna_latar, inisial_warna):
    """Buat foto potret sederhana sebagai pengganti foto pegawai."""
    lebar, tinggi = 240, 320
    pix = pymupdf.Pixmap(pymupdf.csRGB, pymupdf.IRect(0, 0, lebar, tinggi))
    pix.clear_with(warna_latar)
    # badan (persegi panjang)
    for y in range(int(tinggi * 0.55), tinggi):
        for x in range(int(lebar * 0.18), int(lebar * 0.82)):
            pix.set_pixel(x, y, inisial_warna)
    # kepala (bulat)
    cx, cy, r = lebar // 2, int(tinggi * 0.36), int(lebar * 0.19)
    for y in range(cy - r, cy + r):
        for x in range(cx - r, cx + r):
            if 0 <= x < lebar and 0 <= y < tinggi and (x - cx) ** 2 + (y - cy) ** 2 <= r * r:
                pix.set_pixel(x, y, inisial_warna)
    return pix.tobytes('jpeg', jpg_quality=88)


data = {
    'unit': 'KC Jakarta Harmoni',
    'posisi': 'Customer Service',
    'periode': 'Minggu ke-4 September 2026',
    'jenisKantor': 'Semua jenis',
    'jumlahPeserta': 4,
    'kelompok': [
        {
            'unit': 'KC Jakarta Harmoni',
            'posisi': 'Customer Service',
            'baris': [
                {'nama': 'Benny S', 'nilai': 4.92, 'kategori': 'Istimewa',
                 'foto': foto_contoh(210, (60, 60, 70))},
                {'nama': 'Gilbert D', 'nilai': 4.61, 'kategori': 'Sangat Baik',
                 'foto': foto_contoh(220, (40, 70, 130))},
                {'nama': 'Michael D', 'nilai': 3.71, 'kategori': 'Baik',
                 'foto': foto_contoh(200, (120, 90, 60))},
                {'nama': 'Deborah C', 'nilai': 3.15, 'kategori': 'Kurang',
                 'foto': foto_contoh(215, (150, 60, 90))},
            ],
        }
    ],
}

# byte foto tidak bisa langsung jadi JSON -> base64
for kelompok in data['kelompok']:
    for baris in kelompok['baris']:
        baris['foto'] = base64.b64encode(baris['foto']).decode('ascii')

Path('/home/ubuntu/projects/btn-sip/contoh-ranking.json').write_text(
    json.dumps(data), encoding='utf-8'
)
print('contoh-ranking.json dibuat')
