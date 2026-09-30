import Link from 'next/link';
import { pegawaiDariSesi } from '@/lib/auth';

const MENU = [
  { href: '/dasbor', label: 'Dasbor' },
  { href: '/penilaian', label: 'Penilaian' },
  { href: '/laporan', label: 'Laporan' },
  { href: '/pegawai', label: 'Pegawai' },
];

export default async function HalamanTidakDitemukan() {
  const saya = await pegawaiDariSesi();

  return (
    <div className="flex-1 flex flex-col">
      <header className="bg-btn-biru-800 text-white">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 h-16 flex items-center">
          <span className="text-sm font-medium text-white/90">
            Sistem Informasi Penilaian
          </span>
        </div>
        <div className="h-1 bg-btn-merah-500" />
      </header>

      <main className="flex-1 flex items-center justify-center px-6 py-16">
        <div className="text-center max-w-md">
          <p className="text-6xl font-bold text-btn-biru-100">404</p>
          <h1 className="mt-4 text-xl font-bold text-abu-900">
            Halaman tidak ditemukan
          </h1>
          <div className="mt-3 h-0.5 w-10 bg-btn-merah-500 rounded-full mx-auto" />
          <p className="mt-4 text-sm text-abu-500 leading-relaxed">
            Halaman yang Anda cari tidak tersedia atau sudah dipindahkan.
          </p>

          <nav className="mt-8 flex flex-wrap justify-center gap-2.5">
            {MENU.map((m) => (
              <Link
                key={m.href}
                href={saya ? m.href : '/masuk'}
                className="rounded-lg border border-abu-300 bg-white px-4 py-2 text-sm font-medium text-abu-700 hover:bg-abu-50 transition-colors"
              >
                {saya ? m.label : 'Masuk'}
              </Link>
            ))}
          </nav>
        </div>
      </main>
    </div>
  );
}
