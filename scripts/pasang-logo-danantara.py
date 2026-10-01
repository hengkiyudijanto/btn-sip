"""Pasang logo Danantara pada kop slide (menggantikan teks manual).

Latar slide biru tua, sedangkan logo berlatar putih. Supaya menyatu, logo
ditempel di atas kotak putih membulat di sudut kiri atas — sama seperti
perlakuan pada lampiran asli.

Logo juga perlu ikut di dalam berkas PPTX (bukan hanya dirujuk dari URL),
karena berkas akan dibuka di komputer lain yang tidak punya akses ke server.
"""

from pathlib import Path
import base64

# ---- 1. versi JavaScript (dipakai di Vercel) ----
js = Path('/home/ubuntu/projects/btn-sip/src/lib/sip/ranking-pptx.ts')
s = js.read_text()

s = s.replace(
    """function kopDanJudul(slide: PptxGenJS.Slide) {
  slide.addText('Danantara', {
    x: 0.35, y: 0.16, w: 2.0, h: 0.3,
    fontSize: 13, bold: true, color: PUTIH, fontFace: 'Arial',
  });
  slide.addText('Indonesia', {
    x: 0.35, y: 0.42, w: 2.0, h: 0.3,
    fontSize: 13, bold: true, color: PUTIH, fontFace: 'Arial',
  });
  slide.addText('btn', {""",
    """function kopDanJudul(slide: PptxGenJS.Slide) {
  // Logo Danantara berlatar putih, sedangkan slide biru tua — karena itu
  // ditempel di atas kotak putih membulat supaya menyatu (seperti lampiran).
  slide.addShape('roundRect', {
    x: 0.3, y: 0.2, w: 1.78, h: 0.62,
    fill: { color: PUTIH }, line: { color: PUTIH, width: 0 },
    rectRadius: 0.08,
  });
  slide.addImage({
    data: `data:image/png;base64,${LOGO_DANANTARA}`,
    x: 0.38, y: 0.26, w: 1.62, h: 0.50,
  });
  slide.addText('btn', {"""
)

# sisipkan konstanta logo (base64) di awal berkas
if 'LOGO_DANANTARA' in s and 'const LOGO_DANANTARA' not in s:
    anchor = "const LEBAR = 13.333;"
    tambah = """/**
 * Logo Danantara Indonesia, ditanam sebagai base64 supaya ikut di dalam
 * berkas PPTX. Kalau hanya merujuk berkas di public/, PPTX yang diunduh
 * pengguna akan kehilangan logonya saat dibuka di komputer lain.
 */
const LOGO_DANANTARA =
  'GANTI_DENGAN_BASE64';

const LEBAR = 13.333;"""
    s = s.replace(anchor, tambah)

js.write_text(s)
print('JS: kop memakai logo')

# ---- 2. versi Python (pemakaian lokal) ----
py = Path('/home/ubuntu/projects/btn-sip/scripts/buat-pptx-ranking.py')
p = py.read_text()

p = p.replace(
    """    # ---------- kop ----------
    tambah_teks(slide, 'Danantara', 0.35, 0.18, 2.0, 0.3, 13, True, PUTIH)
    tambah_teks(slide, 'Indonesia', 0.35, 0.44, 2.0, 0.3, 13, True, PUTIH)""",
    """    # ---------- kop ----------
    # Logo Danantara berlatar putih, diletakkan di atas kotak putih membulat
    # supaya menyatu dengan slide biru tua (seperti lampiran).
    kotak_logo = tambah_bentuk(slide, MSO_SHAPE.ROUNDED_RECTANGLE,
                               0.30, 0.20, 1.78, 0.62, PUTIH)
    kotak_logo.adjustments[0] = 0.12
    logo_path = Path(__file__).resolve().parent.parent / 'public' / 'danantara-logo.png'
    if logo_path.exists():
        slide.shapes.add_picture(str(logo_path), Inches(0.38), Inches(0.26),
                                 Inches(1.62), Inches(0.50))"""
)

p = p.replace(
    """    # ---------- kop ----------
    tambah_teks(slide, 'Danantara', 0.35, 0.18, 2.0, 0.3, 13, True, PUTIH)
    tambah_teks(slide, 'Indonesia', 0.35, 0.44, 2.0, 0.3, 13, True, PUTIH)
    tambah_teks(slide, 'btn', LEBAR - 1.5, 0.25, 1.15, 0.55, 34, True, PUTIH,
                PP_ALIGN.RIGHT)

    tambah_teks(slide, 'Service Drill Ranking', 0, 0.8, LEBAR, 0.8,""",
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

    tambah_teks(slide, 'Service Drill Ranking', 0, 0.8, LEBAR, 0.8,"""
)
py.write_text(p)
print('Python: kop memakai logo')
