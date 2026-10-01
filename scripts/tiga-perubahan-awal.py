"""Tiga perubahan slide ranking:

1. Nama petugas diringkas: kata pertama penuh, kata kedua dst ambil huruf
   depannya saja. Contoh: "Irwan Allo" -> "Irwan A.", "Ahmad Budi Santoso"
   -> "Ahmad B. S."

2. Kotak nilai panjangnya proporsional: skala 0..5 memetakan ke seluruh lebar
   kolom. Nilai 3,51 -> 70,2% lebar, nilai 5 -> 100%.

3. Kriteria (pil) diletakkan di samping KANAN kotak nilai yang memanjang.
"""

from pathlib import Path

# ---------- 1. fungsi peringkas nama (di file baru supaya bisa diuji) ----------
fungsi = '''/**
 * Meringkas nama petugas untuk slide.
 *
 * Aturan (permintaan user): kata PERTAMA ditulis penuh, kata KEDUA dan
 * seterusnya diambil huruf depannya saja lalu diberi titik.
 *
 *   "Irwan Allo"            -> "Irwan A."
 *   "Ahmad Budi Santoso"    -> "Ahmad B. S."
 *   "Deborah C"             -> "Deborah C."
 *   "Benny"                 -> "Benny"
 *
 * Nama kosong / hanya spasi dikembalikan apa adanya.
 */
export function ringkasNama(nama: string): string {
  const kata = nama.trim().split(/\\s+/).filter(Boolean);
  if (kata.length <= 1) return nama.trim();

  const [pertama, ...sisanya] = kata;
  const inisial = sisanya.map((k) => `${k[0].toUpperCase()}.`);
  return [pertama, ...inisial].join(' ');
}
'''

Path('/home/ubuntu/projects/btn-sip/src/lib/sip/nama-petugas.ts').write_text(fungsi)
print('1. src/lib/sip/nama-petugas.ts dibuat')

# ---------- 2 & 3. ubah generator slide ----------
p = Path('/home/ubuntu/projects/btn-sip/src/lib/sip/ranking-pptx.ts')
s = p.read_text()
ubah = 0

# import
a = "import { labelPosisi } from './label-posisi';"
if a in s:
    s = s.replace(a, "import { labelPosisi } from './label-posisi';\nimport { ringkasNama } from './nama-petugas';")
    ubah += 1
    print('2. import ringkasNama ditambahkan')
else:
    # cari baris import lain sebagai jangkar
    print('2. import label-posisi tidak ketemu, cek manual')

# konstanta skala
a2 = "const KOTAK_NILAI_TINGGI = 0.40;"
b2 = """const KOTAK_NILAI_TINGGI = 0.40;

/**
 * Skala penilaian 0..5 yang dipetakan ke panjang kotak nilai.
 * Nilai 0 -> lebar 0, nilai 5 -> lebar penuh kolom. Sesuai permintaan user:
 * panjang kotak mengikuti nilainya, jadi bar 5,00 akan penuh dan bar 3,51
 * sekitar 70% lebar kolom.
 */
const NILAI_MAKSIMUM = 5;"""
if a2 in s:
    s = s.replace(a2, b2)
    ubah += 1
    print('3. konstanta NILAI_MAKSIMUM ditambahkan')

p.write_text(s)
print(f'\n{ubah} perubahan pada ranking-pptx.ts')
