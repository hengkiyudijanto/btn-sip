"""Membuat foto uji dengan berbagai rasio, untuk menguji 'cover'.

Foto uji diberi pola kotak-kotak dan label supaya kalau gepeng atau terpotong
salah, langsung terlihat di slide hasil render.
"""

from pathlib import Path

from PIL import Image, ImageDraw

KELUAR = Path('/home/ubuntu/projects/btn-sip/foto-uji-rasio')
KELUAR.mkdir(exist_ok=True)

RASIO_KOTAK = 1.191 / 0.962
print(f'rasio kotak slide: {RASIO_KOTAK:.3f}')

kasus = [
    ('potret-sempit', 600, 1200),    # rasio 0,50
    ('potret-3-4', 600, 800),        # rasio 0,75
    ('persegi', 800, 800),           # rasio 1,00
    ('sedikit-lebar', 1000, 800),    # rasio 1,25 (mendekati kotak)
    ('lebar', 1600, 800),            # rasio 2,00
    ('sangat-lebar', 2400, 600),     # rasio 4,00
]

for nama, w, h in kasus:
    img = Image.new('RGB', (w, h), (40, 90, 190))
    d = ImageDraw.Draw(img)

    ukuran = max(20, min(w, h) // 12)
    for iy in range(0, h, ukuran):
        for ix in range(0, w, ukuran):
            if (ix // ukuran + iy // ukuran) % 2 == 0:
                d.rectangle([ix, iy, ix + ukuran - 1, iy + ukuran - 1],
                            fill=(230, 235, 245))

    # lingkaran di tengah: kalau gepeng, lingkarannya jadi lonjong
    r = min(w, h) // 6
    d.ellipse([w // 2 - r, h // 2 - r, w // 2 + r, h // 2 + r],
              fill=(220, 60, 60))

    # penanda orientasi di tepi atas & kiri
    d.rectangle([0, 0, w - 1, max(6, h // 40)], fill=(20, 20, 20))
    d.rectangle([0, 0, max(6, w // 40), h - 1], fill=(20, 20, 20))

    jalur = KELUAR / f'{nama}.jpg'
    img.save(jalur, 'JPEG', quality=86)
    print(f'  {nama:16} {w}x{h}  rasio={w / h:.2f}  -> {jalur.name}')
