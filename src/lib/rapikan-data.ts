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

/** Nama field yang isinya nama cabang (pakai aturan khusus). */
const FIELD_CABANG = new Set(['nama']);

/** Model yang nama-nya memakai aturan cabang. */
const MODEL_CABANG = 'Cabang';

/**
 * Merapikan huruf pada satu nilai, sesuai jenis modelnya.
 * Nilai yang bukan teks dikembalikan apa adanya.
 */
function rapikan(nilai: unknown, model: string): unknown {
  if (typeof nilai !== 'string') return nilai;
  return model === MODEL_CABANG ? kapitalkanCabang(nilai) : kapitalkan(nilai);
}

/**
 * Menelusuri hasil query dan merapikan field nama.
 *
 * Prisma mengembalikan bentuk yang berbeda-beda: objek tunggal, array, atau
 * objek dengan relasi bersarang (mis. penilaian.pegawai.cabang.nama). Jadi
 * hasilnya ditelusuri rekursif, dan setiap objek yang punya `nama` dirapikan
 * — dengan aturan cabang kalau objeknya punya penanda model Cabang.
 */
export function rapikanHasil<T>(hasil: T, model: string): T {
  const dikunjungi = new WeakSet<object>();

  function telusuri(nilai: unknown, jenisModel: string): unknown {
    if (nilai === null || nilai === undefined) return nilai;
    if (typeof nilai !== 'object') return nilai;
    if (nilai instanceof Date) return nilai;

    // Buffer/Uint8Array (foto) tidak perlu ditelusuri
    if (ArrayBuffer.isView(nilai as ArrayBufferView)) return nilai;

    if (Array.isArray(nilai)) {
      return nilai.map((n) => telusuri(n, jenisModel));
    }

    const obj = nilai as Record<string, unknown>;
    if (dikunjungi.has(obj)) return obj;
    dikunjungi.add(obj);

    const punyaNama = 'nama' in obj;
    const modelObjek = punyaNama ? jenisModel : '';

    for (const kunci of Object.keys(obj)) {
      const isi = obj[kunci];

      if (kunci === 'nama' && typeof isi === 'string') {
        obj[kunci] = rapikan(isi, modelObjek);
        continue;
      }

      // Relasi bersarang: tebak modelnya dari nama field relasi
      if (isi !== null && typeof isi === 'object') {
        const modelAnak = tebakModel(kunci);
        obj[kunci] = telusuri(isi, modelAnak);
      }
    }

    return obj;
  }

  return telusuri(hasil, model) as T;
}

/** Menebak nama model dari nama field relasi Prisma. */
function tebakModel(field: string): string {
  const peta: Record<string, string> = {
    cabang: 'Cabang',
    pegawai: 'Pegawai',
    jabatan: 'Jabatan',
    penilai: 'Pegawai',
    atasan: 'Pegawai',
  };
  return peta[field] ?? 'Pegawai';
}
