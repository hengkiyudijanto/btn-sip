import Link from 'next/link';
import { LogoBTN } from '@/components/logo-btn';
import { MenuMobile, NavigasiMenu } from '@/components/navigasi-menu';
import { keluar } from '@/app/actions/auth';
import type { PegawaiSesi } from '@/lib/auth';

const LABEL_ROLE: Record<string, string> = {
  PEGAWAI: 'Pegawai',
  SUPERVISOR: 'Supervisor',
  MANAGER: 'Manager',
  ADMIN: 'Administrator',
};

export type ItemMenu = {
  href: string;
  label: string;
  /** role yang boleh melihat menu ini; undefined = semua */
  role?: string[];
};

export type ItemMenuPohon = {
  /** halaman menu itu sendiri; boleh kosong kalau hanya wadah submenu */
  href?: string;
  label: string;
  /** role yang boleh melihat menu ini; undefined = semua */
  role?: string[];
  anak?: Array<{ href: string; label: string; role?: string[] }>;
};

/**
 * Struktur menu. Dua menu digabung jadi submenu atas permintaan user:
 *   - Laporan (isi: Laporan & Rekap, Ranking PPTX)
 *   - Pegawai (isi: Data Pegawai, Usul Pegawai)
 *
 * Cakupan role dihitung dari anak yang terlihat: menu induk hanya muncul
 * kalau setidaknya ada satu anak yang boleh diakses role tersebut. Jadi
 * supervisor tidak melihat menu "Pegawai" (dia hanya boleh mengusulkan,
 * dan submenu itu ada di dalamnya — sengaja tidak dipisah supaya tidak ada
 * dua pintu menuju halaman yang sama).
 */
const MENU: ItemMenuPohon[] = [
  { href: '/dasbor', label: 'Dasbor' },
  { href: '/penilaian', label: 'Penilaian' },
  { href: '/persetujuan', label: 'Persetujuan', role: ['MANAGER', 'ADMIN'] },
  {
    label: 'Laporan',
    href: '/laporan',
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
  { href: '/cabang', label: 'Cabang', role: ['ADMIN'] },
  { href: '/periode', label: 'Periode', role: ['ADMIN'] },
];

/** Saring menu sesuai role, sekaligus membuang anak yang tidak boleh dilihat. */
function saringMenu(role: string): ItemMenuPohon[] {
  const hasil: ItemMenuPohon[] = [];

  for (const m of MENU) {
    if (m.role && !m.role.includes(role)) continue;

    if (m.anak) {
      const anak = m.anak.filter((a) => !a.role || a.role.includes(role));
      // menu induk hanya muncul kalau ada anak yang bisa diakses
      if (anak.length === 0) continue;
      hasil.push({ ...m, anak });
      continue;
    }

    hasil.push(m);
  }

  return hasil;
}

export function Kerangka({ pegawai, children }: { pegawai: PegawaiSesi; children: React.ReactNode }) {
  const menu = saringMenu(pegawai.role);

  return (
    <div className="flex-1 flex flex-col min-h-screen">
      {/* ===== Bilah atas ===== */}
      <header className="bg-btn-biru-800 text-white sticky top-0 z-40">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-5 min-w-0">
            <Link href="/dasbor" className="flex items-center gap-3 shrink-0">
              <LogoBTN tinggi={26} className="brightness-0 invert" />
              <span className="hidden sm:inline text-sm font-semibold text-white/95">
                SIP
              </span>
            </Link>

            <NavigasiMenu
              menu={menu.map((m) => ({
                href: m.href,
                label: m.label,
                anak: m.anak?.map((a) => ({ href: a.href, label: a.label })),
              }))}
            />
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <div className="hidden sm:block text-right">
              <div className="text-sm font-semibold leading-tight truncate max-w-[180px]">
                {pegawai.nama}
              </div>
              <div className="text-[11px] text-white/60 leading-tight">
                {LABEL_ROLE[pegawai.role]} &middot; {pegawai.cabang.kode}
              </div>
            </div>
            <form action={keluar}>
              <button
                type="submit"
                className="rounded-md border border-white/25 px-3 py-1.5 text-xs font-medium text-white/90 hover:bg-white/10 transition-colors"
              >
                Keluar
              </button>
            </form>
          </div>
        </div>
        <div className="h-1 bg-btn-merah-500" />

        {/* menu mobile */}
        <MenuMobile
          menu={menu.map((m) => ({
            href: m.href,
            label: m.label,
            anak: m.anak?.map((a) => ({ href: a.href, label: a.label })),
          }))}
        />
      </header>

      {/* ===== Isi ===== */}
      <main className="flex-1">{children}</main>

      {/* ===== Footer ===== */}
      <footer className="border-t border-abu-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-4 flex flex-wrap items-center justify-between gap-2">
          <p className="text-[11px] text-abu-400">
            SIP — Sistem Informasi Penilaian Petugas Frontliner
          </p>
          <p className="text-[11px] text-abu-400">
            PT Bank Tabungan Negara (Persero) Tbk
          </p>
        </div>
      </footer>
    </div>
  );
}
