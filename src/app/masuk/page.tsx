import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { LogoBTN } from '@/components/logo-btn';
import { FormMasuk } from '@/components/form-masuk';
import { masuk } from '@/app/actions/auth';
import { pegawaiDariSesi } from '@/lib/auth';

export const metadata: Metadata = {
  title: 'Masuk',
};

export default async function HalamanMasuk() {
  // Kalau sudah punya sesi aktif, langsung ke dasbor
  const pegawai = await pegawaiDariSesi();
  if (pegawai) {
    redirect(pegawai.harusGantiPassword ? '/ubah-password' : '/dasbor');
  }

  return (
    <div className="flex-1 grid lg:grid-cols-[1.1fr_1fr] min-h-screen">
      {/* ============ Panel kiri — identitas korporat ============ */}
      <div className="relative hidden lg:flex flex-col justify-between overflow-hidden bg-btn-biru-800 p-12 text-white">
        {/* pola latar halus */}
        <div
          aria-hidden
          className="absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              'radial-gradient(circle at 1px 1px, white 1px, transparent 0)',
            backgroundSize: '28px 28px',
          }}
        />
        {/* sorotan biru */}
        <div
          aria-hidden
          className="absolute -top-32 -left-32 h-96 w-96 rounded-full blur-3xl"
          style={{ background: 'rgba(26,111,204,0.35)' }}
        />
        {/* aksen merah khas BTN */}
        <div
          aria-hidden
          className="absolute bottom-0 left-0 h-1.5 w-40 bg-btn-merah-500"
        />

        <div className="relative">
          <LogoBTN tinggi={40} className="brightness-0 invert" />
        </div>

        <div className="relative max-w-md">
          <h1 className="text-3xl font-bold leading-tight tracking-tight">
            Sistem Informasi
            <br />
            Penilaian Petugas
          </h1>
          <div className="mt-4 h-1 w-16 bg-btn-merah-500 rounded-full" />
          <p className="mt-5 text-sm leading-relaxed text-white/75">
            Penilaian kinerja mingguan untuk petugas frontliner — Teller,
            Customer Service, Security, Priority Banking Teller, dan Priority
            Banking Customer Service.
          </p>

          <ul className="mt-8 space-y-3 text-sm text-white/70">
            {[
              'Penilaian 13 aspek dalam 3 kategori',
              'Laporan SIP siap cetak',
              'Rekap per cabang dan per periode',
            ].map((t) => (
              <li key={t} className="flex items-center gap-2.5">
                <svg
                  className="h-4 w-4 shrink-0 text-btn-merah-400"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z"
                    clipRule="evenodd"
                  />
                </svg>
                {t}
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-xs text-white/40">
          PT Bank Tabungan Negara (Persero) Tbk
        </p>
      </div>

      {/* ============ Panel kanan — form ============ */}
      <div className="flex flex-col justify-center px-6 py-12 sm:px-12 bg-white">
        <div className="w-full max-w-sm mx-auto">
          {/* logo tampil di mobile */}
          <div className="lg:hidden mb-8">
            <LogoBTN tinggi={36} />
          </div>

          <div className="mb-8">
            <h2 className="text-2xl font-bold text-abu-900">Masuk</h2>
            <div className="mt-2 h-0.5 w-10 bg-btn-merah-500 rounded-full" />
            <p className="mt-3 text-sm text-abu-500">
              Gunakan NIP dan password Anda untuk melanjutkan.
            </p>
          </div>

          <FormMasuk aksi={masuk} />

          <div className="mt-8 pt-6 border-t border-abu-200">
            <p className="text-xs text-abu-500 leading-relaxed">
              Lupa password? Hubungi admin cabang untuk melakukan reset.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
