"""Memotong foto mengikuti bentuk membulat + mengisi penuh kotaknya.

Ini dikerjakan di sisi server (Python) supaya hasilnya gambar biasa yang
sudutnya SUDAH membulat dan transparan. Dengan begitu foto tampil sama di
semua penampil (PowerPoint, LibreOffice, Google Slides, pratinjau macOS) —
tidak bergantung pada dukungan `blipFill` di autoshape, yang ternyata tidak
dirender oleh LibreOffice.

Langkah:
  1. buka foto
  2. hitung penempatan gaya "cover": skalakan sampai menutupi kotak, potong
     kelebihannya, jaga proporsi (tidak gepeng)
  3. tempel ke kanvas transparan berukuran kotak
  4. beri topeng sudut membulat (alpha)
  5. simpan sebagai PNG (butuh alpha untuk sudut tembus pandang)
"""

from io import BytesIO

from PIL import Image, ImageDraw

# bentuk kotak foto di slide: 1,191 x 0,962 inci
KOTAK_W = 1.191
KOTAK_H = 0.962
# radius sudut (inci) — sama dengan RADIUS_FOTO di generator slide
RADIUS = 0.18


def siapkan_foto(
    data: bytes,
    keluaran_px_per_inch: int = 320,
    radius: float = RADIUS,
) -> bytes:
    """Kembalikan byte PNG: foto sudah mengisi penuh kotak & sudutnya membulat."""
    img = Image.open(BytesIO(data)).convert('RGB')

    lebar = round(KOTAK_W * keluaran_px_per_inch)
    tinggi = round(KOTAK_H * keluaran_px_per_inch)

    # --- gaya "cover": penuhi kotak, jaga proporsi ---
    rasio_kotak = KOTAK_W / KOTAK_H
    rasio_foto = img.width / img.height

    if rasio_foto > rasio_kotak:
        # foto lebih lebar: tinggi pas, sisi kiri-kanan dipotong
        baru_h = tinggi
        baru_w = round(tinggi * rasio_foto)
    else:
        # foto lebih tinggi: lebar pas, sisi atas-bawah dipotong
        baru_w = lebar
        baru_h = round(lebar / rasio_foto)

    img = img.resize((baru_w, baru_h), Image.LANCZOS)

    # potong tengah
    kiri = (baru_w - lebar) // 2
    atas = (baru_h - tinggi) // 2
    img = img.crop((kiri, atas, kiri + lebar, atas + tinggi))

    # --- topeng sudut membulat ---
    skala = keluaran_px_per_inch
    topeng = Image.new('L', (lebar, tinggi), 0)
    g = ImageDraw.Draw(topeng)
    g.rounded_rectangle(
        [0, 0, lebar - 1, tinggi - 1],
        radius=round(radius * skala),
        fill=255,
    )

    hasil = Image.new('RGBA', (lebar, tinggi), (0, 0, 0, 0))
    hasil.paste(img.convert('RGBA'), (0, 0), topeng)

    keluar = BytesIO()
    hasil.save(keluar, 'PNG', optimize=True)
    return keluar.getvalue()


if __name__ == '__main__':
    import base64
    from pathlib import Path

    src = Path('/home/ubuntu/projects/btn-sip/foto-uji-rasio/potret-sempit.jpg')
    hasil = siapkan_foto(src.read_bytes())
    out = Path('/home/ubuntu/projects/btn-sip/foto-uji-rasio/hasil-bulat.png')
    out.write_bytes(hasil)
    im = Image.open(BytesIO(hasil))
    print(f'{src.name} -> {out.name}')
    print(f'  ukuran: {im.width}x{im.height} piksel, mode {im.mode}')
    print(f'  byte  : {len(hasil)}')
    # cek sudut transparan
    print(f'  piksel sudut (0,0) alpha = {im.getpixel((0, 0))[3]}  (0 = tembus pandang)')
    print(f'  piksel tengah alpha      = {im.getpixel((im.width // 2, im.height // 2))[3]}')
