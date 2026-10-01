/**
 * Penerapan aturan kapitalisasi PADA SEMUA hasil query.
 *
 * Kenapa di sini, bukan di tiap halaman: ada puluhan tempat menampilkan nama
 * pegawai/cabang/jabatan. Menyunting semuanya satu per satu mudah terlewat,
 * dan yang terlewat akan tampil tidak konsisten. Dengan menaruh aturannya di
 * satu titik keluar data (ekstensi Prisma), semua tampilan ikut otomatis.
 *
 * Penting: ini HANYA mengubah hasil yang dikembalikan ke aplikasi. Data di
 * database tidak disentuh, dan filter/pencarian tetap memakai nilai aslinya.
 *
 * Aturan (permintaan user):
 *   - Umum (nama pegawai, nama jabatan): huruf pertama tiap kata kapital,
 *     sisanya kecil.
 *   - Nama cabang: kalau kata pertamanya KC atau KCP, kata itu KAPITAL SEMUA;
 *     kata sisanya pakai aturan umum.
 */

import { kapitalkan, kapitalkanCabang } from './sip/teks';

/** Kumpulan nama model yang namanya memakai aturan khusus cabang. */
export type ModelCabang = ReadonlySet<string>;

/**
 * Menentukan jenis model dari sebuah objek hasil query.
 *
 * Dipakai FIELD PENANDA yang khas tiap model. Kalau objeknya tidak punya
 * field penanda (karena query-nya cuma mengambil `nama`), jatuh ke nama field
 * relasi yang membawa objek ini — lihat `petunjukRelasi`.
 */
function jenisModelDariObjek(obj: Record<string, unknown>): string {
  if ('nip' in obj) return 'Pegawai';
  if ('jenis' in obj && 'kode' in obj) return 'Cabang';
  if ('bobot' in obj) return 'Jabatan';
  return '';
}

/**
 * Petunjuk jenis model dari nama field relasi Prisma.
 *
 * Diperlukan karena relasi sering diambil hanya sebagian (`select: { nama:
 * true }`), sehingga objeknya tidak punya field penanda apa pun. Tanpa ini,
 * nama cabang yang diambil lewat relasi akan dirapikan dengan aturan umum —
 * "KC MAMUJU" jadi "Kc Mamuju", padahal seharusnya "KC Mamuju".
 */
function petunjukRelasi(namaField: string): string {
  const peta: Record<string, string> = {
    cabang: 'Cabang',
    pegawai: 'Pegawai',
    jabatan: 'Jabatan',
    penilai: 'Pegawai',
    atasan: 'Pegawai',
  };
  return peta[namaField] ?? '';
}

/**
 * Menelusuri hasil query dan merapikan field nama.
 *
 * Prisma mengembalikan bentuk yang berbeda-beda: objek tunggal, array, atau
 * objek dengan relasi bersarang (mis. penilaian.pegawai.cabang.nama). Jadi
 * hasilnya ditelusuri rekursif, dan setiap objek yang punya `nama` dirapikan
 * sesuai jenis modelnya.
 *
 * @param modelAsal   nama model dari Prisma. Dipakai saat objeknya sendiri
 *                    tidak punya field penanda (mis. hasil `select: { nama }`).
 * @param modelCabang nama-nama model yang memakai aturan cabang.
 */
export function rapikanHasil<T>(
  hasil: T,
  modelAsal: string,
  modelCabang: ModelCabang
): T {
  const dikunjungi = new WeakSet<object>();

  function telusuri(nilai: unknown, model: string): unknown {
    if (nilai === null || nilai === undefined) return nilai;
    if (typeof nilai !== 'object') return nilai;
    if (nilai instanceof Date) return nilai;

    // Buffer/Uint8Array (foto) tidak perlu ditelusuri
    if (ArrayBuffer.isView(nilai as ArrayBufferView)) return nilai;

    if (Array.isArray(nilai)) {
      return nilai.map((n) => telusuri(n, model));
    }

    const obj = nilai as Record<string, unknown>;
    if (dikunjungi.has(obj)) return obj;
    dikunjungi.add(obj);

    // Jenis model objek ini: dari field penandanya kalau ada, kalau tidak
    // pakai model dari query-nya.
    const jenisSendiri = jenisModelDariObjek(obj) || model;

    for (const kunci of Object.keys(obj)) {
      const isi = obj[kunci];

      if (kunci === 'nama' && typeof isi === 'string') {
        obj[kunci] = modelCabang.has(jenisSendiri)
          ? kapitalkanCabang(isi)
          : kapitalkan(isi);
        continue;
      }

      // Relasi bersarang: jenis modelnya ditentukan dari field penanda objek
      // itu sendiri, dan kalau tidak ada, dari nama field relasinya.
      if (isi !== null && typeof isi === 'object') {
        obj[kunci] = telusuri(isi, petunjukRelasi(kunci));
      }
    }

    return obj;
  }

  return telusuri(hasil, modelAsal) as T;
}
