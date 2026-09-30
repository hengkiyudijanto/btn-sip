import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { LogoBTN } from '@/components/logo-btn';
import { FormUbahPassword } from '@/components/form-ubah-password';
import { gantiPasswordSendiri } from '@/app/actions/auth';
import { pegawaiDariSesi } from '@/lib/auth';

export const metadata: Metadata = {
  title: 'Ubah Password',
};

export default async function HalamanUbahPassword() {
  const pegawai = await pegawaiDariSesi();
  if (!pegawai) redirect('/masuk');

  return (
    <div className="flex-1 flex flex-col justify-center px-6 py-12">
      <div className="w-full max-w-md mx-auto">
        <div className="mb-6">
          <LogoBTN tinggi={32} />
        </div>

        <div className="kartu-padat p-7 animasi-naik">
          <div className="mb-6">
            <h1 className="text-xl font-bold text-abu-900">Ubah Password</h1>
            <div className="mt-2 h-0.5 w-10 bg-btn-merah-500 rounded-full" />
            <p className="mt-3 text-sm text-abu-500">
              {pegawai.nama} &middot; NIP {pegawai.nip}
            </p>
          </div>

          <FormUbahPassword aksi={gantiPasswordSendiri} wajib={pegawai.harusGantiPassword} />
        </div>

        <p className="mt-5 text-center text-xs text-abu-400">
          SIP — Sistem Informasi Penilaian Petugas Frontliner
        </p>
      </div>
    </div>
  );
}
