/**
 * Struktur menu navigasi aplikasi.
 *
 * Dipisah dari komponennya (kerangka.tsx) supaya bisa diuji sendiri — di
 * kerangka.tsx ada impor komponen React yang tidak bisa dimuat di lingkungan
 * pengujian.
 *
 * Aturan pengelompokan: satu halaman = satu pintu. Kalau sebuah halaman bisa
 * dicapai dari menu utama maupun dari submenu, pengguna jadi ragu mana yang
 * benar — jadi halaman dipindah ke dalam submenu saja.
 */

export type SubItem = { href: string; label: string; role?: string[] };

export type ItemMenuPohon = {
  /** Halaman menu itu sendiri; kosong kalau hanya wadah submenu. */
  href?: string;
  label: string;
  /** Role yang boleh melihat menu ini; undefined = semua. */
  role?: string[];
  anak?: SubItem[];
};

/**
 * Menu aplikasi.
 *
 * Catatan soal role pada grup: grup tanpa `role` (mis. Pegawai) tidak
 * disembunyikan di sini — penyaringan terjadi di `saringMenu()`, dan grup akan
 * hilang sendiri kalau tidak ada satu pun anaknya yang boleh diakses.
 */
export const MENU: ItemMenuPohon[] = [
  { href: '/dasbor', label: 'Dasbor' },
  { href: '/penilaian', label: 'Penilaian' },
  { href: '/persetujuan', label: 'Persetujuan', role: ['MANAGER', 'ADMIN'] },
  {
    // Induk tanpa href sendiri: halaman /laporan sudah jadi submenu
    // "Laporan & Rekap". Kalau induknya juga menunjuk ke /laporan, ada dua
    // pintu ke halaman yang sama.
    label: 'Laporan',
    anak: [
      { href: '/laporan', label: 'Laporan & Rekap' },
      { href: '/laporan/ranking', label: 'Ranking PPTX' },
    ],
  },
  {
    label: 'Pegawai',
    anak: [
      { href: '/pegawai', label: 'Data Pegawai', role: ['ADMIN', 'MANAGER'] },
      {
        href: '/pengajuan-pegawai',
        label: 'Usul Pegawai',
        role: ['SUPERVISOR', 'MANAGER', 'ADMIN'],
      },
    ],
  },
  {
    label: 'Parameter',
    anak: [
      { href: '/parameter/cabang', label: 'Cabang', role: ['ADMIN'] },
      { href: '/parameter/jabatan', label: 'Jabatan', role: ['ADMIN'] },
      { href: '/parameter/peran', label: 'Peran', role: ['ADMIN'] },
      { href: '/parameter/periode', label: 'Periode', role: ['ADMIN'] },
    ],
  },
];

/** Saring menu sesuai role, sekaligus membuang anak yang tidak boleh dilihat. */
export function saringMenu(role: string): ItemMenuPohon[] {
  const hasil: ItemMenuPohon[] = [];

  for (const m of MENU) {
    if (m.role && !m.role.includes(role)) continue;

    if (m.anak) {
      const anak = m.anak.filter((a) => !a.role || a.role.includes(role));
      // grup hanya muncul kalau ada anak yang bisa diakses
      if (anak.length === 0) continue;
      hasil.push({ ...m, anak });
      continue;
    }

    hasil.push(m);
  }

  return hasil;
}
