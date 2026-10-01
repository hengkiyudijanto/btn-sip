import { redirect } from 'next/navigation';
import { pegawaiDariSesi } from '@/lib/auth';
import { Kerangka } from '@/components/kerangka';
import { prisma } from '@/lib/db';
import {
  FormTambahJabatan,
  TabelJabatan,
} from '@/components/kelola-jabatan';

export const metadata = { title: 'Jabatan' };

export default async function HalamanJabatan() {
  const saya = await pegawaiDariSesi();
  if (!saya) redirect('/masuk');
  if (saya.harusGantiPassword) redirect('/ubah-password');
  if (saya.role !== 'ADMIN') redirect('/dasbor');

  const daftar = await prisma.jabatan.findMany({
    orderBy: [{ aktif: 'desc' }, { nama: 'asc' }],
    include: { _count: { select: { pegawai: true } } },
  });

  return (
    <Kerangka pegawai={saya}>
      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-6 sm:py-8">
        <div>
          <h1 className="text-xl font-semibold text-abu-900">Jabatan</h1>
          <p className="mt-1 text-sm text-abu-500">
            Jabatan dipakai sebagai posisi yang dinilai pada laporan penilaian.
            Nama di sini yang tampil di aplikasi; sebutan di slide presentasi
            diatur terpisah.
          </p>
        </div>

        <div className="mt-6">
          <FormTambahJabatan />
        </div>

        <TabelJabatan
          daftar={daftar.map((j) => ({
            id: j.id,
            kode: j.kode,
            nama: j.nama,
            namaEn: j.namaEn,
            aktif: j.aktif,
            jumlahPegawai: j._count.pegawai,
          }))}
        />
      </div>
    </Kerangka>
  );
}
