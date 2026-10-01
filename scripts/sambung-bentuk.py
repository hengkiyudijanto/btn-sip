"""Menyambungkan pengisian foto ke bentuk pada seluruh alur pembuat PPTX."""

from pathlib import Path

p = Path('/home/ubuntu/projects/btn-sip/src/lib/sip/ranking-pptx.ts')
s = p.read_text()
ubah = 0

# 1. konstanta radius foto
a = "const TEBAL_BINGKAI_FOTO = 0.05;"
b = """const TEBAL_BINGKAI_FOTO = 0.05;

/**
 * Radius sudut kotak foto (inci). Karena fotonya diisikan KE DALAM bentuk ini
 * (bukan ditimpa), sudut foto mengikuti lengkungan ini — jadi tidak ada lagi
 * sudut bolong.
 */
const RADIUS_FOTO = 0.18;"""
if a in s:
    s = s.replace(a, b, 1)
    ubah += 1
    print('1. konstanta RADIUS_FOTO')

# 2. parameter bentukBerfoto di slideRanking
a2 = """  /** Diisi fungsi ini: nomor slide -> potongan foto yang dipakai. */
  potongan: Map<number, Potongan>,
  /** Nomor slide ini di dalam berkas PPTX (slide 1 = ringkasan). */
  nomorSlide: number
) {"""
b2 = """  /** Diisi fungsi ini: daftar bentuk yang harus diisi foto. */
  bentukBerfoto: BentukBerfoto[],
  /** Nomor slide ini di dalam berkas PPTX (slide 1 = ringkasan). */
  nomorSlide: number
) {"""
if a2 in s:
    s = s.replace(a2, b2, 1)
    ubah += 1
    print('2. parameter diganti jadi bentukBerfoto')
else:
    print('2. POLA parameter tidak ketemu')

# 3. bangunPptxRanking: pakai isikanFotoKeBentukPptx
a3 = """  // Nomor slide -> potongan foto. Diisi saat menggambar tiap slide, lalu
  // diterapkan ke XML setelah berkasnya jadi.
  const potongan = new Map<number, Potongan>();

  slideRingkasan(prs, data);
  for (let i = 0; i < data.kelompok.length; i++) {
    // Slide 1 = ringkasan, jadi slide ranking pertama bernomor 2.
    slideRanking(prs, data.kelompok[i], petaFoto, potongan, i + 2);
  }

  const keluaran = (await prs.write({ outputType: 'nodebuffer' })) as Buffer;

  // pptxgenjs tidak bisa menulis srcRect (atribut potongan gambar), jadi
  // disisipkan setelahnya. Tanpa ini foto akan gepeng karena direntangkan.
  if (potongan.size === 0) return keluaran;
  return potongGambarPerSlide(keluaran, potongan);"""

b3 = """  // Daftar bentuk kotak foto yang harus diisi gambar. Diisi saat menggambar
  // tiap slide, lalu diterapkan ke XML setelah berkasnya jadi.
  const bentukBerfoto: BentukBerfoto[] = [];

  slideRingkasan(prs, data);
  for (let i = 0; i < data.kelompok.length; i++) {
    // Slide 1 = ringkasan, jadi slide ranking pertama bernomor 2.
    slideRanking(prs, data.kelompok[i], petaFoto, bentukBerfoto, i + 2);
  }

  const keluaran = (await prs.write({ outputType: 'nodebuffer' })) as Buffer;

  // pptxgenjs tidak bisa mengisi BENTUK dengan gambar, jadi foto diisikan
  // setelah berkasnya jadi. Ini yang membuat foto mengikuti bentuk membulat
  // kotaknya (tanpa sudut bolong).
  if (bentukBerfoto.length === 0) return keluaran;
  return isikanFotoKeBentukPptx(keluaran, bentukBerfoto);"""

if a3 in s:
    s = s.replace(a3, b3, 1)
    ubah += 1
    print('3. bangunPptxRanking memakai isikanFotoKeBentukPptx')
else:
    print('3. POLA bangunPptxRanking tidak ketemu')

p.write_text(s)
print(f'\n{ubah} dari 3 perubahan diterapkan')
