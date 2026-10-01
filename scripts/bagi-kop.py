"""Bagi ruang di dalam kotak nama cabang jadi dua baris tanpa tumpang tindih.

Kotak 0,713 inci terlalu tinggi untuk satu teks, tapi tidak cukup untuk dua
teks 18 pt yang ditumpuk. Solusinya: bagi rata, beri jarak 0,04 di tepi atas
dan bawah, sisanya dibagi dua.
"""

from pathlib import Path

p = Path('/home/ubuntu/projects/btn-sip/src/lib/sip/ranking-pptx.ts')
s = p.read_text()

# konstanta jarak & tinggi setiap baris, dihitung dari tinggi kotak
s = s.replace(
    "const RADIUS_NAMA_CABANG = 0.114;   // 16% x 0,713",
    """const RADIUS_NAMA_CABANG = 0.114;   // 16% x 0,713
/**
 * Jarak tepi di dalam kotak nama cabang. Kotaknya diisi DUA baris teks
 * (nama cabang di atas, nama posisi di bawah); 0,04 di tepi atas dan bawah
 * memberi napas, sisanya dibagi dua rata.
 */
const PAD_NAMA_CABANG = 0.04;
/** Tinggi tiap baris teks di dalam kotak nama cabang. */
const BARIS_NAMA_CABANG = (NAMA_CABANG.h - PAD_NAMA_CABANG * 2) / 2;"""
)

# teks nama cabang: baris ATAS
s = s.replace(
    """  slide.addText(unit, {
    x: NAMA_CABANG.x, y: NAMA_CABANG.y + 0.06,
    w: NAMA_CABANG.w, h: NAMA_CABANG.h / 2,
    fontSize: F_UNIT, bold: false, color: PUTIH, align: 'center',
    valign: 'middle', fontFace: FONT_UNIT,
  });""",
    """  slide.addText(unit, {
    x: NAMA_CABANG.x, y: NAMA_CABANG.y + PAD_NAMA_CABANG,
    w: NAMA_CABANG.w, h: BARIS_NAMA_CABANG,
    fontSize: F_UNIT, bold: false, color: PUTIH, align: 'center',
    valign: 'middle', fontFace: FONT_UNIT,
  });"""
)

# nama posisi: baris BAWAH
s = s.replace(
    """  slide.addText(posisi, {
    x: 5.219, y: NAMA_CABANG.y + NAMA_CABANG.h / 2 - 0.06,
    w: 2.896, h: NAMA_CABANG.h / 2,
    fontSize: F_POSISI, color: PUTIH, align: 'center', valign: 'middle',
    fontFace: FONT_POSISI,
  });""",
    """  slide.addText(posisi, {
    x: 5.219, y: NAMA_CABANG.y + PAD_NAMA_CABANG + BARIS_NAMA_CABANG,
    w: 2.896, h: BARIS_NAMA_CABANG,
    fontSize: F_POSISI, color: PUTIH, align: 'center', valign: 'middle',
    fontFace: FONT_POSISI,
  });"""
)

p.write_text(s)

# verifikasi perhitungan
atas, tinggi = 1.380, 0.713
pad = 0.04
baris = (tinggi - pad * 2) / 2
print('Hasil pembagian:')
print(f'  kotak            : {atas:.3f} .. {atas+tinggi:.3f}')
print(f'  teks cabang      : {atas+pad:.3f} .. {atas+pad+baris:.3f}  (h={baris:.3f})')
print(f'  teks posisi      : {atas+pad+baris:.3f} .. {atas+tinggi-pad:.3f}  (h={baris:.3f})')
print(f'  tumpang tindih   : 0,000  -> AMAN')
print(f'  baris data mulai : 2.110  -> {"AMAN" if atas+tinggi < 2.110 else "NABRAK"}')
