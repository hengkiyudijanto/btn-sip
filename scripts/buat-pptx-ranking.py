"""Susun data ranking untuk laporan PPTX "Service Drill Ranking".

Data diambil dari database lewat prisma (dijalankan lewat skrip ts di
scripts/ekspor-ranking-pptx.ts), lalu skrip ini yang menggambar slide.

Skrip ini juga bisa dijalankan mandiri dengan file JSON hasil ekspor:
    ~/venvs/dev/bin/python scripts/buat-pptx-ranking.py data.json out.pptx

Memakai helper dari skill powerpoint bila tersedia; kalau tidak, memakai
python-pptx langsung supaya skrip ini berdiri sendiri.
"""

from __future__ import annotations

import base64
import json
import sys
from io import BytesIO
from pathlib import Path

from pptx import Presentation
from pptx.dml.color import RGBColor
from pptx.enum.shapes import MSO_SHAPE
from pptx.enum.text import MSO_ANCHOR, PP_ALIGN
from pptx.util import Emu, Inches, Pt

# ============================================================
# WARNA DAN UKURAN SLIDE (mengikuti lampiran user)
# ============================================================

BIRU_TUA = RGBColor(0x0B, 0x2A, 0x8C)      # latar slide
BIRU_MUDA = RGBColor(0x2E, 0x5C, 0xD6)     # kotak nama cabang
BIRU_BATANG = RGBColor(0x1E, 0x4F, 0xC8)   # batang grafik
PUTIH = RGBColor(0xFF, 0xFF, 0xFF)
MERAH = RGBColor(0xD4, 0x11, 0x2E)

# warna kategori (persis seperti lampiran)
WARNA_KATEGORI = {
    'Istimewa': RGBColor(0x00, 0xB0, 0x50),
    'Sangat Baik': RGBColor(0x66, 0xBB, 0x6A),
    'Baik': RGBColor(0xF5, 0x7C, 0x00),
    'Cukup': RGBColor(0xFF, 0xC1, 0x07),
    'Kurang': RGBColor(0xE5, 0x1B, 0x2B),
}

# ambang kategori (kontrak rubrik BTN)
AMBANG = [
    (4.80, 'Istimewa'),
    (4.60, 'Sangat Baik'),
    (4.00, 'Baik'),
    (3.60, 'Cukup'),
    (0.00, 'Kurang'),
]


def kategori(nilai: float) -> str:
    """Tentukan kategori dari nilai akhir 0-5."""
    for batas, nama in AMBANG:
        if nilai >= batas:
            return nama
    return 'Kurang'


# ukuran slide 16:9 (inci)
LEBAR = 13.333
TINGGI = 7.5


def tambah_teks(slide, teks, kiri, atas, lebar, tinggi,
                ukuran=14, tebal=False, warna=PUTIH,
                rata=PP_ALIGN.LEFT, font='Arial'):
    """Tambah textbox sederhana."""
    kotak = slide.shapes.add_textbox(Inches(kiri), Inches(atas), Inches(lebar), Inches(tinggi))
    tf = kotak.text_frame
    tf.word_wrap = True
    tf.vertical_anchor = MSO_ANCHOR.MIDDLE
    p = tf.paragraphs[0]
    p.alignment = rata
    r = p.add_run()
    r.text = teks
    r.font.size = Pt(ukuran)
    r.font.bold = tebal
    r.font.color.rgb = warna
    r.font.name = font
    return kotak


def tambah_bentuk(slide, bentuk, kiri, atas, lebar, tinggi, isi):
    s = slide.shapes.add_shape(bentuk, Inches(kiri), Inches(atas),
                               Inches(lebar), Inches(tinggi))
    s.fill.solid()
    s.fill.fore_color.rgb = isi
    s.line.fill.background()
    s.shadow.inherit = False
    return s


def gambar_latar(slide):
    """Latar biru tua + pita merah melengkung di bawah (seperti lampiran)."""
    tambah_bentuk(slide, MSO_SHAPE.RECTANGLE, 0, 0, LEBAR, TINGGI, BIRU_TUA)
    # pita merah: dua kotak miring supaya terlihat seperti pita melengkung
    pita = slide.shapes.add_shape(
        MSO_SHAPE.WAVE, Inches(-0.5), Inches(TINGGI - 1.15),
        Inches(LEBAR + 1), Inches(1.35)
    )
    pita.fill.solid()
    pita.fill.fore_color.rgb = MERAH
    pita.line.fill.background()
    pita.shadow.inherit = False


def tambah_foto_bulat(slide, gambar: str | None, kiri, atas, ukuran):
    """Tempel foto dengan bingkai putih (kotak, seperti lampiran).

    `gambar` berupa teks base64 (karena data datang dari JSON), bisa None.
    """
    bingkai = tambah_bentuk(slide, MSO_SHAPE.ROUNDED_RECTANGLE,
                            kiri, atas, ukuran, ukuran, PUTIH)
    bingkai.adjustments[0] = 0.08
    if gambar:
        try:
            isi = base64.b64decode(gambar)
            return slide.shapes.add_picture(
                BytesIO(isi), Inches(kiri + 0.05), Inches(atas + 0.05),
                Inches(ukuran - 0.1), Inches(ukuran - 0.1)
            )
        except Exception:
            pass
    # tanpa foto: bingkai kosong saja
    return None


def slide_ranking(data: dict, prs: Presentation):
    """Satu slide ranking untuk satu kelompok (cabang + posisi)."""
    slide = prs.slides.add_slide(prs.slide_layouts[6])  # blank
    gambar_latar(slide)

    # ---------- kop ----------
    # Logo Danantara berlatar putih, diletakkan di atas kotak putih membulat
    # supaya menyatu dengan slide biru tua (seperti lampiran).
    # Logo Danantara rasionya PERSEGI (1:1) — kotak putihnya harus persegi
    # juga, kalau tidak logonya gepeng.
    kotak_logo = tambah_bentuk(slide, MSO_SHAPE.ROUNDED_RECTANGLE,
                               0.30, 0.22, 0.78, 0.78, PUTIH)
    kotak_logo.adjustments[0] = 0.12
    logo_path = Path(__file__).resolve().parent.parent / 'public' / 'danantara-logo.png'
    if logo_path.exists():
        slide.shapes.add_picture(str(logo_path), Inches(0.34), Inches(0.26),
                                 Inches(0.70), Inches(0.70))
    tambah_teks(slide, 'btn', LEBAR - 1.5, 0.25, 1.15, 0.55, 34, True, PUTIH,
                PP_ALIGN.RIGHT)

    # ---------- judul ----------
    tambah_teks(slide, 'Service Drill Ranking', 0, 0.28, LEBAR, 0.75,
                36, True, PUTIH, PP_ALIGN.CENTER)

    # kotak nama unit
    kotak_unit = tambah_bentuk(slide, MSO_SHAPE.ROUNDED_RECTANGLE,
                               LEBAR / 2 - 1.9, 1.15, 3.8, 0.5, BIRU_MUDA)
    kotak_unit.adjustments[0] = 0.35
    tf = kotak_unit.text_frame
    tf.word_wrap = True
    p = tf.paragraphs[0]
    p.alignment = PP_ALIGN.CENTER
    r = p.add_run()
    r.text = data['unit']
    r.font.size = Pt(17)
    r.font.color.rgb = PUTIH
    r.font.name = 'Arial'

    # subjudul (posisi yang dinilai)
    tambah_teks(slide, data['posisi'], 0, 1.68, LEBAR, 0.35,
                15, False, PUTIH, PP_ALIGN.CENTER)

    # ---------- grafik batang ----------
    baris = data['baris']
    if not baris:
        tambah_teks(slide, 'Belum ada penilaian pada filter ini.',
                    0, 3.0, LEBAR, 0.5, 16, False, PUTIH, PP_ALIGN.CENTER)
    else:
        gambar_grafik(slide, baris)

    # ---------- legenda ----------
    gambar_legenda(slide)
    return slide


def gambar_grafik(slide, baris: list[dict]):
    """Batang horizontal dengan foto, nama, angka, dan label kategori.

    Panjang batang dihitung dari nol sampai 5,00 supaya benar-benar
    proporsional: nilai 3,15 terlihat jelas lebih pendek daripada 4,92.
    Batang dibuat ramping (lebih tipis dari tinggi baris) seperti lampiran.
    """
    atas_awal = 2.22
    tinggi_baris = 0.95
    foto_ukuran = 0.80

    x_foto = 0.68
    x_nama = 1.68           # nama pegawai
    batang_x = 3.12         # awal batang
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

        # nama — kolom dilebarkan dan word_wrap dimatikan supaya nama
        # panjang seperti "IRWAN ALLO" tidak terbelah dua baris
        kotak_nama = tambah_teks(slide, b['nama'], x_nama, atas, 1.35, foto_ukuran,
                                 14, True, PUTIH)
        kotak_nama.text_frame.word_wrap = False

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


def gambar_legenda(slide):
    """Legenda SKALA PENILAIAN di bagian bawah."""
    # label kecil "SKALA PENILAIAN"
    lx = LEBAR / 2 - 2.4
    kotak = tambah_bentuk(slide, MSO_SHAPE.ROUNDED_RECTANGLE,
                          lx, TINGGI - 1.02, 1.85, 0.28, BIRU_MUDA)
    kotak.adjustments[0] = 0.3
    tf = kotak.text_frame
    p = tf.paragraphs[0]
    p.alignment = PP_ALIGN.CENTER
    r = p.add_run()
    r.text = 'SKALA PENILAIAN'
    r.font.size = Pt(9)
    r.font.bold = True
    r.font.color.rgb = PUTIH
    r.font.name = 'Arial'

    # panel putih legenda
    panel_kiri = LEBAR / 2 - 2.4
    panel = tambah_bentuk(slide, MSO_SHAPE.ROUNDED_RECTANGLE,
                          panel_kiri, TINGGI - 0.72, 4.85, 0.5, PUTIH)
    panel.adjustments[0] = 0.18

    item = [
        ('4,80-5,00', 'Istimewa'),
        ('4,60-4,79', 'Sangat Baik'),
        ('4,00-4,59', 'Baik'),
        ('3,60-3,99', 'Cukup'),
        ('<3,59', 'Kurang'),
    ]
    x = panel_kiri + 0.22
    for rentang, nama in item:
        titik = slide.shapes.add_shape(
            MSO_SHAPE.OVAL, Inches(x), Inches(TINGGI - 0.60), Inches(0.10), Inches(0.10)
        )
        titik.fill.solid()
        titik.fill.fore_color.rgb = WARNA_KATEGORI[nama]
        titik.line.fill.background()
        titik.shadow.inherit = False

        tambah_teks(slide, rentang, x + 0.15, TINGGI - 0.64, 0.75, 0.18,
                    7, False, RGBColor(0x33, 0x33, 0x33))
        tambah_teks(slide, nama, x + 0.15, TINGGI - 0.48, 0.75, 0.18,
                    7, False, RGBColor(0x33, 0x33, 0x33))
        x += 0.95


def slide_ringkasan(data: dict, prs: Presentation):
    """Slide pembuka: ringkasan filter dan jumlah peserta."""
    slide = prs.slides.add_slide(prs.slide_layouts[6])
    gambar_latar(slide)

    tambah_teks(slide, 'Danantara', 0.35, 0.18, 2.0, 0.3, 13, True, PUTIH)
    tambah_teks(slide, 'Indonesia', 0.35, 0.44, 2.0, 0.3, 13, True, PUTIH)
    tambah_teks(slide, 'btn', LEBAR - 1.5, 0.25, 1.15, 0.55, 34, True, PUTIH,
                PP_ALIGN.RIGHT)

    tambah_teks(slide, 'Service Drill Ranking', 0, 0.8, LEBAR, 0.8,
                40, True, PUTIH, PP_ALIGN.CENTER)
    tambah_teks(slide, data.get('periode', ''), 0, 1.65, LEBAR, 0.4,
                18, False, PUTIH, PP_ALIGN.CENTER)

    baris = [
        ('Jenis kantor', data.get('jenisKantor', 'Semua')),
        ('Unit / cabang', data.get('unit', '-')),
        ('Posisi dinilai', data.get('posisi', '-')),
        ('Periode', data.get('periode', '-')),
        ('Jumlah peserta', str(data.get('jumlahPeserta', 0))),
    ]
    atas = 2.6
    for label, nilai in baris:
        tambah_teks(slide, label, 4.2, atas, 2.0, 0.4, 14, False, PUTIH, PP_ALIGN.RIGHT)
        tambah_teks(slide, ': ' + nilai, 6.3, atas, 3.5, 0.4, 14, True, PUTIH)
        atas += 0.52

    return slide


def bangun(data: dict, keluaran: Path):
    prs = Presentation()
    prs.slide_width = Inches(LEBAR)
    prs.slide_height = Inches(TINGGI)

    slide_ringkasan(data, prs)
    for kelompok in data['kelompok']:
        slide_ranking({**kelompok, 'periode': data.get('periode', '')}, prs)

    prs.save(keluaran)
    return keluaran


def main():
    if len(sys.argv) < 3:
        print('pakai: buat-pptx-ranking.py data.json out.pptx')
        sys.exit(1)
    data = json.loads(Path(sys.argv[1]).read_text(encoding='utf-8'))
    keluaran = bangun(data, Path(sys.argv[2]))
    print(f'selesai: {keluaran}')


if __name__ == '__main__':
    main()
