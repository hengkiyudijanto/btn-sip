import Link from 'next/link';
import { LogoBTN } from '@/components/logo-btn';
import { MenuMobile, NavigasiMenu } from '@/components/navigasi-menu';
import { LoncengNotifikasi } from '@/components/lonceng-notifikasi';
import { saringMenu } from '@/components/menu';
import { keluar } from '@/app/actions/auth';
import { ambilPengingat } from '@/lib/sip/pengingat';
import type { PegawaiSesi } from '@/lib/auth';

const LABEL_ROLE: Record<string, string> = {
  PEGAWAI: 'Pegawai',
  PENGAMAT: 'Pengamat',
  SUPERVISOR: 'Supervisor',
  MANAGER: 'Manager',
  ADMIN: 'Administrator',
};

export async function Kerangka({ pegawai, children }: { pegawai: PegawaiSesi; children: React.ReactNode }) {
  const menu = saringMenu(pegawai.role);

  // Lonceng menampilkan hal yang perlu ditindak (petugas belum dinilai,
  // penilaian menunggu diketahui, periode hampir ditutup). Kalau tidak ada
  // apa-apa, komponennya tidak merender apa pun.
  const pengingat = await ambilPengingat(pegawai);

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
            <LoncengNotifikasi daftar={pengingat.daftar} jumlah={pengingat.jumlahButir} />
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
