"""Pakai background asli (gambar) sebagai template slide.

Semua elemen yang tadinya digambar dari kode — latar biru, pita merah, logo
Danantara, tulisan btn — DIHAPUS, karena semuanya sudah ada di dalam gambar
background. Kalau dibiarkan, logo akan tampil dobel.

Ukuran slide disesuaikan dengan rasio gambar background supaya tidak ada
bagian yang terpotong atau gepeng. Gambar asli 1280x740 (rasio 1,7297),
dijadikan 13,333 x 7,7088 inci.
"""

from pathlib import Path
import base64

# ---- 1. ukuran slide mengikuti background ----
LEBAR = 13.333
TINGGI = round(LEBAR / (1280 / 740), 4)  # 7,7088 -> rasio sama dengan gambar
print(f'ukuran slide: {LEBAR} x {TINGGI} inci (rasio {LEBAR / TINGGI:.4f})')

# ---- 2. versi JavaScript (dipakai di Vercel) ----
js = Path('/home/ubuntu/projects/btn-sip/src/lib/sip/ranking-pptx.ts')
s = js.read_text()

logo_b64 = base64.b64encode(
    Path('/home/ubuntu/projects/btn-sip/public/background-ranking.jpg').read_bytes()
).decode()

# ganti konstanta logo lama dengan background
import re
s = re.sub(
    r"/\*\*\n \* Logo Danantara Indonesia.*?\nconst LOGO_DANANTARA =\n  '[^']*';\n",
    "",
    s,
    flags=re.DOTALL,
)
s = s.replace(
    "const LEBAR = 13.333;\nconst TINGGI = 7.5;",
    f"""/**
 * Background asli dari user, ditanam sebagai base64 supaya ikut di dalam
 * berkas PPTX yang diunduh (kalau hanya dirujuk dari public/, background
 * hilang saat PPTX dibuka di komputer lain).
 *
 * Gambar ini SUDAH memuat logo Danantara, logo btn, dan pita merah — jadi
 * slide TIDAK boleh menggambar ulang elemen-elemen itu.
 */
const BACKGROUND_RANKING =
  '{logo_b64}';

// Ukuran slide mengikuti rasio background (1280x740) supaya tidak gepeng.
const LEBAR = 13.333;
const TINGGI = {TINGGI};"""
)

# latar: cukup gambar background, tanpa bentuk tambahan
s = s.replace(
    """function latar(slide: PptxGenJS.Slide) {
  slide.background = { color: BIRU_TUA };
  // pita merah melengkung di bawah
  slide.addShape('rect', {
    x: 0, y: TINGGI - 0.75, w: LEBAR, h: 0.75,
    fill: { color: MERAH }, line: { color: MERAH, width: 0 },
  });
  slide.addShape('ellipse', {
    x: -1.2, y: TINGGI - 1.15, w: LEBAR + 2.4, h: 0.9,
    fill: { color: MERAH }, line: { color: MERAH, width: 0 },
  });
}""",
    """function latar(slide: PptxGenJS.Slide) {
  // Satu gambar background utuh: sudah memuat latar biru, pita merah,
  // logo Danantara, dan logo btn. Tidak ada bentuk tambahan yang diperlukan.
  slide.background = { color: BIRU_TUA };
  slide.addImage({
    data: `data:image/jpeg;base64,${BACKGROUND_RANKING}`,
    x: 0, y: 0, w: LEBAR, h: TINGGI,
  });
}"""
)

# kop: hapus seluruh gambar/teks logo, sisakan judul
s = s.replace(
    """function kopDanJudul(slide: PptxGenJS.Slide) {
  // Logo Danantara berlatar putih, sedangkan slide biru tua — karena itu
  // ditempel di atas kotak putih membulat supaya menyatu (seperti lampiran).
  // Logo Danantara rasionya PERSEGI (1:1). Kotak putihnya harus persegi
  // juga — kalau tidak, logonya gepeng.
  slide.addShape('roundRect', {
    x: 0.3, y: 0.22, w: 0.78, h: 0.78,
    fill: { color: PUTIH }, line: { color: PUTIH, width: 0 },
    rectRadius: 0.12,
  });
  slide.addImage({
    data: `data:image/png;base64,${LOGO_DANANTARA}`,
    x: 0.34, y: 0.26, w: 0.70, h: 0.70,
  });
  slide.addText('btn', {
    x: LEBAR - 1.5, y: 0.22, w: 1.15, h: 0.55,
    fontSize: 34, bold: true, color: PUTIH, align: 'right', fontFace: 'Arial',
  });
  slide.addText('Service Drill Ranking', {""",
    """function kopDanJudul(slide: PptxGenJS.Slide) {
  // Logo Danantara dan btn TIDAK digambar di sini — keduanya sudah ada di
  // dalam gambar background. Menggambarnya ulang membuat logo tampil dobel.
  slide.addText('Service Drill Ranking', {"""
)

js.write_text(s)
print('JS: background asli dipakai, logo manual dihapus')

# ---- 3. versi Python (pemakaian lokal) ----
py = Path('/home/ubuntu/projects/btn-sip/scripts/buat-pptx-ranking.py')
p = py.read_text()

p = p.replace(
    "LEBAR = 13.333\nTINGGI = 7.5",
    f"# Ukuran slide mengikuti rasio background asli (1280x740).\nLEBAR = 13.333\nTINGGI = {TINGGI}"
)

p = p.replace(
    '''def gambar_latar(slide):
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
    pita.shadow.inherit = False''',
    '''def gambar_latar(slide):
    """Tempel background asli sebagai satu gambar penuh.

    Gambar ini sudah memuat latar biru, pita merah, logo Danantara, dan logo
    btn — jadi tidak ada bentuk tambahan yang boleh digambar di sini.
    """
    latar_path = Path(__file__).resolve().parent.parent / 'public' / 'background-ranking.jpg'
    if latar_path.exists():
        slide.shapes.add_picture(str(latar_path), 0, 0,
                                 Inches(LEBAR), Inches(TINGGI))
    else:
        # cadangan kalau berkas background tidak ada
        tambah_bentuk(slide, MSO_SHAPE.RECTANGLE, 0, 0, LEBAR, TINGGI, BIRU_TUA)'''
)

# hapus kop logo di dua tempat
p = p.replace(
    """    # ---------- kop ----------
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
""",
    """    # ---------- kop ----------
    # Logo Danantara dan btn sudah ada di dalam gambar background — tidak
    # digambar ulang di sini supaya tidak tampil dobel.
"""
)
p = p.replace(
    """    # ---------- kop ----------
    kotak_logo = tambah_bentuk(slide, MSO_SHAPE.ROUNDED_RECTANGLE,
                               0.30, 0.20, 1.78, 0.62, PUTIH)
    kotak_logo.adjustments[0] = 0.12
    logo_path = Path(__file__).resolve().parent.parent / 'public' / 'danantara-logo.png'
    if logo_path.exists():
        slide.shapes.add_picture(str(logo_path), Inches(0.38), Inches(0.26),
                                 Inches(1.62), Inches(0.50))
    tambah_teks(slide, 'btn', LEBAR - 1.5, 0.25, 1.15, 0.55, 34, True, PUTIH,
                PP_ALIGN.RIGHT)
""",
    """    # ---------- kop ----------
    # Logo Danantara dan btn sudah ada di dalam gambar background.
"""
)
p.write_text(p)
print('Python: background asli dipakai, logo manual dihapus')
