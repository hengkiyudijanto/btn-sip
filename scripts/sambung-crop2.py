"""Lanjutan: catat potongan foto per slide dan terapkan setelah PPTX jadi."""

from pathlib import Path

p = Path('/home/ubuntu/projects/btn-sip/src/lib/sip/ranking-pptx.ts')
s = p.read_text()
ubah = 0

# ---------- 1. ganti pemakaian sizing cover -> hitung potongan ----------
a = """    const foto = petaFoto.get(b.nip);
    if (foto) {
      // Foto selalu diisi memenuhi kotaknya tanpa gepeng.
      //
      // `sizing: cover` diselesaikan oleh PowerPoint sendiri: gambar
      // diskalakan sampai MENUTUPI seluruh kotak (skala x dan y sama, jadi
      // proporsi tidak berubah) lalu kelebihannya dipotong rata dua sisi.
      // Sama seperti `object-fit: cover` di CSS.
      //
      // Ukuran kotaknya diambil dari kotakIsiFoto, bukan x/y/w/h, supaya
      // posisi crop-nya tepat di dalam bingkai putih.
      slide.addImage({
        data: `data:image/jpeg;base64,${foto}`,
        x: kotakIsiFoto.x, y: kotakIsiFoto.y,
        w: kotakIsiFoto.w, h: kotakIsiFoto.h,
        sizing: {
          type: 'cover',
          w: kotakIsiFoto.w,
          h: kotakIsiFoto.h,
        },
      });
    }"""

b = """    const foto = petaFoto.get(b.nip);
    if (foto) {
      // Foto selalu mengisi penuh kotaknya tanpa gepeng.
      //
      // Gambar ditaruh MEMENUHI kotak (w,h = kotak), lalu kelebihan sisi
      // dipotong lewat srcRect yang disisipkan setelah PPTX jadi — lihat
      // potong-gambar-pptx.ts. pptxgenjs sendiri tidak bisa menulis srcRect;
      // opsi `sizing: cover` miliknya hanya merentangkan gambar (gepeng).
      slide.addImage({
        data: `data:image/jpeg;base64,${foto}`,
        x: kotakIsiFoto.x, y: kotakIsiFoto.y,
        w: kotakIsiFoto.w, h: kotakIsiFoto.h,
      });

      // Hitung berapa bagian yang harus dipotong supaya proporsi foto asli
      // dipertahankan (sama seperti object-fit: cover).
      const rasio = rasioFotoJpeg(foto);
      if (rasio) {
        const tempat = hitungPenempatanFoto(kotakIsiFoto, rasio);
        potongan.set(nomorSlide, {
          kiri: tempat.potongKiri,
          kanan: tempat.potongKanan,
          atas: tempat.potongAtas,
          bawah: tempat.potongBawah,
        });
      }
    }"""

if a in s:
    s = s.replace(a, b, 1)
    ubah += 1
    print('1. sizing cover diganti perhitungan potongan')
else:
    print('1. POLA blok foto tidak ketemu')

# ---------- 2. import fungsi hitung ----------
a2 = "import { potongGambarPerSlide, type Potongan } from './potong-gambar-pptx';"
b2 = """import { potongGambarPerSlide, type Potongan } from './potong-gambar-pptx';
import { hitungPenempatanFoto, rasioFotoJpeg } from './potong-foto';"""
if a2 in s:
    s = s.replace(a2, b2, 1)
    ubah += 1
    print('2. import hitungPenempatanFoto ditambahkan')

# ---------- 3. nomorSlide: slide ini nomor berapa ----------
a3 = "  const slide = prs.addSlide();\n  latar(slide);\n  kop(slide, kelompok.unit, kelompok.posisi);"
b3 = """  const slide = prs.addSlide();
  // Nomor slide di dalam berkas: slide 1 = ringkasan, jadi slide ranking
  // pertama adalah nomor 2 + indeks kelompok.
  const nomorSlide = potongan.size + 2;
  latar(slide);
  kop(slide, kelompok.unit, kelompok.posisi);"""
if a3 in s:
    s = s.replace(a3, b3, 1)
    ubah += 1
    print('3. nomorSlide dihitung')
else:
    print('3. POLA addSlide tidak ketemu')

# ---------- 4. bangunPptxRanking: terapkan potongan ----------
a4 = """  slideRingkasan(prs, data);
  for (const k of data.kelompok) {
    slideRanking(prs, k, petaFoto);
  }

  const keluaran = await prs.write({ outputType: 'nodebuffer' });
  return keluaran as Buffer;"""

b4 = """  // Nomor slide -> potongan foto. Diisi saat menggambar tiap slide, lalu
  // diterapkan ke XML setelah berkasnya jadi.
  const potongan = new Map<number, Potongan>();

  slideRingkasan(prs, data);
  for (const k of data.kelompok) {
    slideRanking(prs, k, petaFoto, potongan);
  }

  const keluaran = (await prs.write({ outputType: 'nodebuffer' })) as Buffer;

  // pptxgenjs tidak bisa menulis srcRect (atribut potongan gambar), jadi
  // disisipkan setelahnya. Tanpa ini foto akan gepeng karena direntangkan.
  if (potongan.size === 0) return keluaran;
  return potongGambarPerSlide(keluaran, potongan);"""

if a4 in s:
    s = s.replace(a4, b4, 1)
    ubah += 1
    print('4. penerapan potongan di bangunPptxRanking')
else:
    print('4. POLA bangunPptxRanking tidak ketemu')

p.write_text(s)
print(f'\n{ubah} dari 4 perubahan diterapkan')
