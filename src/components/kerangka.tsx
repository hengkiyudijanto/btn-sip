import Link from 'next/link';
import { LogoBTN } from '@/components/logo-btn';
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

const MENU_DASAR: ItemMenu[] = [
  { href: '/dasbor', label: 'Dasbor' },
  { href: '/penilaian', label: 'Penilaian' },
  { href: '/persetujuan', label: 'Persetujuan', role: ['MANAGER', 'ADMIN'] },
  { href: '/laporan', label: 'Laporan' },
  { href: '/laporan/ranking', label: 'Ranking PPTX' },
  { href: '/pegawai', label: 'Pegawai', role: ['ADMIN', 'MANAGER'] },
  { href: '/pengajuan-pegawai', label: 'Usul Pegawai', role: ['SUPERVISOR', 'MANAGER', 'ADMIN'] },
  { href: '/cabang', label: 'Cabang', role: ['ADMIN'] },
  { href: '/periode', label: 'Periode', role: ['ADMIN'] },
];

export function Kerangka({ pegawai, children }: { pegawai: PegawaiSesi; children: React.ReactNode }) {
  const menu = MENU_DASAR.filter(
    (m) => !m.role || m.role.includes(pegawai.role)
  );

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

            <nav className="hidden md:flex items-center gap-1">
              {menu.map((m) => (
                <Link
                  key={m.href}
                  href={m.href}
                  className="rounded-md px-3 py-2 text-sm font-medium text-white/80 hover:text-white hover:bg-white/10 transition-colors"
                >
                  {m.label}
                </Link>
              ))}
            </nav>
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
        <nav className="md:hidden flex overflow-x-auto border-t border-white/10">
          {menu.map((m) => (
            <Link
              key={m.href}
              href={m.href}
              className="shrink-0 px-4 py-2.5 text-xs font-medium text-white/75 hover:text-white hover:bg-white/10 transition-colors"
            >
              {m.label}
            </Link>
          ))}
        </nav>
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
