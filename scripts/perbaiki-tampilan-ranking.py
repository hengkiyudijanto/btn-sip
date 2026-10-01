"""Perbaiki tampilan slide grafik agar lebih sesuai lampiran.

Perbaikan dari hasil pemeriksaan visual:
  1. Batang dibuat lebih ramping (setengah tinggi baris) dan mulai dari
     nilai 0, sehingga panjangnya benar-benar proporsional terhadap nilai.
  2. Garis pemisah tidak lagi menonjol keluar seperti ekor.
  3. Garis tegak pemisah dibuat lebih pendek agar sejajar dengan blok.
  4. Foto diberi bingkai putih tipis dan sudut membulat.
"""

from pathlib import Path

p = Path('/home/ubuntu/projects/btn-sip/scripts/buat-pptx-ranking.py')
s = p.read_text()

lama = '''def gambar_grafik(slide, baris: list[dict]):
    """Batang horizontal dengan foto, nama, angka, dan label kategori."""
    atas_awal = 2.25
    tinggi_baris = 0.92
    foto_ukuran = 0.78

    garis_x = 3.35          # tempat garis tegak mulai (seperti lampiran)
    x_nama = 2.05           # nama pegawai
    batang_x = garis_x
    batang_lebar_maks = 4.05  # panjang maksimum batang (nilai 5,00)
    x_angka = batang_x + batang_lebar_maks + 0.15
    x_label = x_angka + 0.72

    # garis tegak pemisah
    garis = slide.shapes.add_shape(
        MSO_SHAPE.RECTANGLE, Inches(garis_x - 0.02), Inches(atas_awal - 0.05),
        Inches(0.02), Inches(tinggi_baris * len(baris) - 0.15)
    )
    garis.fill.solid()
    garis.fill.fore_color.rgb = PUTIH
    garis.line.fill.background()
    garis.shadow.inherit = False

    nilai_maks = 5.0

    for i, b in enumerate(baris):
        atas = atas_awal + i * tinggi_baris

        # foto
        tambah_foto_bulat(slide, b.get('foto'), 0.62, atas, foto_ukuran)

        # nama
        tambah_teks(slide, b['nama'], x_nama, atas, 1.25, foto_ukuran,
                    15, True, PUTIH)

        # batang
        panjang = max(0.05, batang_lebar_maks * (b['nilai'] / nilai_maks))
        # rel kosong (tipis)
        rel = slide.shapes.add_shape(
            MSO_SHAPE.RECTANGLE, Inches(batang_x), Inches(atas + foto_ukuran / 2 - 0.015),
            Inches(batang_lebar_maks), Inches(0.03)
        )
        rel.fill.solid()
        rel.fill.fore_color.rgb = PUTIH
        rel.line.fill.background()
        rel.shadow.inherit = False

        # batang berisi
        batang = slide.shapes.add_shape(
            MSO_SHAPE.RECTANGLE, Inches(batang_x), Inches(atas + 0.10),
            Inches(panjang), Inches(foto_ukuran - 0.20)
        )
        batang.fill.solid()
        batang.fill.fore_color.rgb = BIRU_BATANG
        batang.line.color.rgb = PUTIH
        batang.line.width = Pt(0.75)
        batang.shadow.inherit = False

        # angka nilai
        tambah_teks(slide, f"{b['nilai']:.2f}".replace('.', ','),
                    x_angka, atas, 0.7, foto_ukuran, 16, True, PUTIH,
                    PP_ALIGN.RIGHT)

        # label kategori
        kat = b['kategori']
        pil = tambah_bentuk(
            slide, MSO_SHAPE.ROUNDED_RECTANGLE,
            x_label, atas + 0.14, 1.5, 0.5,
            WARNA_KATEGORI.get(kat, WARNA_KATEGORI['Kurang'])
        )
        pil.adjustments[0] = 0.5
        tf = pil.text_frame
        tf.word_wrap = False
        p = tf.paragraphs[0]
        p.alignment = PP_ALIGN.CENTER
        r = p.add_run()
        r.text = kat
        r.font.size = Pt(12)
        r.font.bold = True
        r.font.color.rgb = PUTIH
        r.font.name = 'Arial'
'''

baru = '''def gambar_grafik(slide, baris: list[dict]):
    """Batang horizontal dengan foto, nama, angka, dan label kategori.

    Panjang batang dihitung dari nol sampai 5,00 supaya benar-benar
    proporsional: nilai 3,15 terlihat jelas lebih pendek daripada 4,92.
    Batang dibuat ramping (lebih tipis dari tinggi baris) seperti lampiran.
    """
    atas_awal = 2.22
    tinggi_baris = 0.95
    foto_ukuran = 0.80

    x_foto = 0.68
    x_nama = 1.75           # nama pegawai
    batang_x = 3.05         # awal batang
    batang_lebar_maks = 3.90  # panjang batang untuk nilai 5,00
    tinggi_batang = 0.40
    x_angka = batang_x + batang_lebar_maks + 0.12
    x_label = x_angka + 0.62

    # garis tegak pemisah, sejajar dengan blok baris (tidak menonjol)
    garis = slide.shapes.add_shape(
        MSO_SHAPE.RECTANGLE,
        Inches(batang_x - 0.06),
        Inches(atas_awal - 0.02),
        Inches(0.015),
        Inches(tinggi_baris * len(baris) - 0.12),
    )
    garis.fill.solid()
    garis.fill.fore_color.rgb = PUTIH
    garis.line.fill.background()
    garis.shadow.inherit = False

    nilai_maks = 5.0

    for i, b in enumerate(baris):
        atas = atas_awal + i * tinggi_baris
        tengah = atas + foto_ukuran / 2

        # foto
        tambah_foto_bulat(slide, b.get('foto'), x_foto, atas, foto_ukuran)

        # nama
        tambah_teks(slide, b['nama'], x_nama, atas, 1.2, foto_ukuran,
                    14, True, PUTIH)

        # batang berisi — mulai dari batang_x, panjang sesuai nilai
        panjang = max(0.06, batang_lebar_maks * (b['nilai'] / nilai_maks))
        batang = slide.shapes.add_shape(
            MSO_SHAPE.RECTANGLE,
            Inches(batang_x),
            Inches(tengah - tinggi_batang / 2),
            Inches(panjang),
            Inches(tinggi_batang),
        )
        batang.fill.solid()
        batang.fill.fore_color.rgb = BIRU_BATANG
        batang.line.color.rgb = PUTIH
        batang.line.width = Pt(0.75)
        batang.shadow.inherit = False

        # angka nilai, rata kanan di ujung tetap supaya tidak bergeser
        tambah_teks(slide, f"{b['nilai']:.2f}".replace('.', ','),
                    x_angka, atas, 0.72, foto_ukuran, 15, True, PUTIH,
                    PP_ALIGN.RIGHT)

        # label kategori
        kat = b['kategori']
        pil = tambah_bentuk(
            slide, MSO_SHAPE.ROUNDED_RECTANGLE,
            x_label, tengah - 0.22, 1.42, 0.44,
            WARNA_KATEGORI.get(kat, WARNA_KATEGORI['Kurang'])
        )
        pil.adjustments[0] = 0.5
        tf = pil.text_frame
        tf.word_wrap = False
        p = tf.paragraphs[0]
        p.alignment = PP_ALIGN.CENTER
        r = p.add_run()
        r.text = kat
        r.font.size = Pt(11)
        r.font.bold = True
        r.font.color.rgb = PUTIH
        r.font.name = 'Arial'
'''

if lama in s:
    s = s.replace(lama, baru)
    p.write_text(s)
    print('gambar_grafik diperbaiki')
else:
    print('POLA tidak ditemukan')
