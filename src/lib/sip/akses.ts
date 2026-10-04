/**
 * HAK AKSES — satu sumber kebenaran untuk seluruh aplikasi.
 *
 * Semua keputusan "siapa boleh apa" HARUS lewat modul ini, baik di halaman
 * (menyembunyikan menu/tombol) maupun di server action (menolak aksi).
 *
 * Kenapa dipusatkan: sebelumnya daftar peran ditulis ulang di banyak berkas
 * (`role === 'ADMIN'`, `['SUPERVISOR','MANAGER','ADMIN']`, …). Menambah satu
 * peran baru berarti harus menemukan SEMUA tempat itu — dan satu yang
 * terlewat berarti celah keamanan. Di sini, peran baru cukup didaftarkan di
 * `KEMAMPUAN` lalu dipakai di mana pun.
 *
 * ATURAN PENTING: menyembunyikan tombol BUKAN pengamanan. Setiap server action
 * yang mengubah data wajib memanggil `wajibKemampuan()` — kalau tidak, aksi
 * itu tetap bisa dipanggil langsung lewat HTTP oleh peran mana pun.
 */

export type Peran = 'PEGAWAI' | 'PENGAMAT' | 'SUPERVISOR' | 'MANAGER' | 'ADMIN';

/** Semua peran yang dikenal, urut dari hak tersempit ke terluas. */
export const SEMUA_PERAN: Peran[] = ['PEGAWAI', 'PENGAMAT', 'SUPERVISOR', 'MANAGER', 'ADMIN'];

/** Keterangan peran untuk halaman /parameter/peran. */
export const KETERANGAN_PERAN: Record<Peran, string> = {
  PEGAWAI: 'Melihat hasil penilaian dirinya sendiri.',
  PENGAMAT: 'Hanya melihat dasbor, laporan, dan ranking. Tidak bisa mengubah apa pun.',
  SUPERVISOR: 'Menilai petugas di bawahnya dan mengusulkan pegawai baru.',
  MANAGER: 'Mengetahui/mengakui penilaian, serta melihat data pegawai.',
  ADMIN: 'Kelola data induk (cabang, periode, jabatan, peran) dan akun.',
};

/**
 * Daftar kemampuan yang mungkin dimiliki sebuah peran.
 *
 * Tambahkan kemampuan baru DI SINI, lalu pakai `boleh()` / `wajibKemampuan()`
 * di seluruh aplikasi. Jangan kembali menulis `role === 'ADMIN'` di tempat lain.
 */
export type Kemampuan =
  /** Menyimpan/mengirim penilaian petugas. */
  | 'menilai'
  /** Mengetahui/mengakui penilaian yang masuk. */
  | 'mengetahui'
  /** Mengubah dan menghapus penilaian yang sudah ada. */
  | 'kelola_penilaian'
  /** Melihat daftar seluruh pegawai. */
  | 'lihat_pegawai'
  /** Mengusulkan pegawai baru (perlu persetujuan admin). */
  | 'usul_pegawai'
  /** Menyetujui/menolak usul pegawai. */
  | 'setujui_pegawai'
  /** Menambah/mengubah/menghapus pegawai langsung. */
  | 'kelola_pegawai'
  /** Data induk: cabang, jabatan, periode. */
  | 'kelola_induk'
  /** Melihat audit log. */
  | 'lihat_audit';

/**
 * Peta kemampuan per peran.
 *
 * PENGAMAT sengaja HANYA punya akses baca (dasbor, laporan, ranking). Untuk
 * memberinya akses tambahan nanti, cukup tambahkan kemampuan di barisnya —
 * tidak perlu menyentuh halaman atau action mana pun.
 */
const KEMAMPUAN: Record<Peran, Kemampuan[]> = {
  PEGAWAI: [],

  // ==== HANYA MELIHAT ====
  // Sengaja kosong: akses bacanya (dasbor/laporan/ranking) diberikan lewat
  // daftar putih halaman, bukan lewat kemampuan. Menambahkan kemampuan di
  // sini berarti memberi HAK UBAH, jadi jangan lakukan tanpa diminta.
  PENGAMAT: [],

  SUPERVISOR: ['menilai', 'usul_pegawai'],

  MANAGER: ['menilai', 'mengetahui', 'lihat_pegawai', 'usul_pegawai', 'setujui_pegawai'],

  ADMIN: [
    'menilai',
    'mengetahui',
    'kelola_penilaian',
    'lihat_pegawai',
    'usul_pegawai',
    'setujui_pegawai',
    'kelola_pegawai',
    'kelola_induk',
    'lihat_audit',
  ],
};

/** Apakah peran ini punya kemampuan tersebut? */
export function boleh(role: string, kemampuan: Kemampuan): boolean {
  const daftar = KEMAMPUAN[role as Peran];
  return Array.isArray(daftar) && daftar.includes(kemampuan);
}

/**
 * Halaman yang boleh DIBUKA tiap peran (akses baca).
 *
 * Dipakai untuk menyaring menu dan memblokir halaman yang tidak relevan.
 * `null` = semua peran yang sudah masuk boleh membuka.
 */
const HALAMAN: Record<string, Peran[] | null> = {
  '/dasbor': null,
  '/laporan': null,
  '/laporan/ranking': null,
  '/laporan/ekspor': ['SUPERVISOR', 'MANAGER', 'ADMIN'],

  '/penilaian': ['SUPERVISOR', 'MANAGER', 'ADMIN'],
  '/persetujuan': ['MANAGER', 'ADMIN'],
  '/pegawai': ['MANAGER', 'ADMIN'],
  '/pengajuan-pegawai': ['SUPERVISOR', 'MANAGER', 'ADMIN'],
  '/parameter/cabang': ['ADMIN'],
  '/parameter/jabatan': ['ADMIN'],
  '/parameter/peran': ['ADMIN'],
  '/parameter/periode': ['ADMIN'],
  '/parameter/audit': ['ADMIN'],
};

/**
 * Apakah peran ini boleh membuka halaman tersebut?
 *
 * Mencocokkan berdasarkan awalan terpanjang yang terdaftar, supaya
 * `/laporan/ranking` tidak ikut tertutup oleh aturan `/laporan`.
 */
export function bolehBukaHalaman(role: string, jalur: string): boolean {
  const bersih = jalur.split('?')[0].replace(/\/$/, '') || '/';

  const cocok = Object.keys(HALAMAN)
    .filter((h) => bersih === h || bersih.startsWith(`${h}/`))
    .sort((a, b) => b.length - a.length)[0];

  if (!cocok) {
    // jalur tak terdaftar: pegawai & pengamat tidak boleh menebak-nebak,
    // peran yang boleh menilai boleh (halaman penilaian per petugas)
    return boleh(role, 'menilai');
  }

  const izin = HALAMAN[cocok];
  if (izin === null) return true;
  return izin.includes(role as Peran);
}

/**
 * Penjaga untuk SERVER ACTION.
 *
 * Mengembalikan pesan error siap-pakai, atau null kalau boleh lanjut.
 *
 *   const tolak = wajibKemampuan(pegawai, 'menilai');
 *   if (tolak) return { error: tolak };
 */
export function wajibKemampuan(
  pegawai: { role: string; nama?: string } | null,
  kemampuan: Kemampuan
): string | null {
  if (!pegawai) return 'Sesi habis. Silakan masuk kembali.';
  if (!boleh(pegawai.role, kemampuan)) {
    return `Peran ${pegawai.role} hanya bisa melihat, tidak bisa melakukan tindakan ini.`;
  }
  return null;
}
