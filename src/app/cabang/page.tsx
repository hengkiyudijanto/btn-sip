import { redirect } from 'next/navigation';
import { pegawaiDariSesi } from '@/lib/auth';
import { Kerangka } from '@/components/kerangka';
import { prisma } from '@/lib/db';
import { FormTambahCabang, AksiCabang } from '@/components/kelola-cabang';

export const metadata = { title: 'Cabang' };

export default async function HalamanCabang() {
  const saya = await pegawaiDariSesi();
  if (!saya) redirect('/masuk');
  if (saya.harusGantiPassword) redirect('/ubah-password');
  if (saya.role !== 'ADMIN') redirect('/dasbor');

  const daftar = await prisma.cabang.findMany({
    orderBy: { kode: 'asc' },
    include: { _count: { select: { pegawai: true } } },
  });

  const totalPegawai = daftar.reduce((a, c) => a + c._count.pegawai, 0);

  return (
    <Kerangka pegawai={saya}>
      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-8">
        <div className="animasi-naik">
          <h1 className="text-2xl font-bold text-abu-900">Pengelolaan Cabang</h1>
          <div className="mt-2 h-0.5 w-10 bg-btn-merah-500 rounded-full" />
          <p className="mt-3 text-sm text-abu-500">
            {daftar.length} cabang &middot; {totalPegawai} pegawai terdaftar
          </p>
        </div>

        <div className="mt-6">
          <FormTambahCabang />
        </div>

        <div className="mt-6 kartu overflow-hidden">
          <div className="overflow-x-auto">
            <table className="tabel-sip">
              <thead>
                <tr>
                  <th>Kode</th>
                  <th>Nama</th>
                  <th>Alamat</th>
                  <th className="text-right">Pegawai</th>
                  <th>Status</th>
                  <th className="text-right">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {daftar.length === 0 && (
                  <tr>
                    <td colSpan={6} className="text-center py-10 text-sm text-abu-400">
                      Belum ada cabang. Tambahkan cabang pertama di atas.
                    </td>
                  </tr>
                )}
                {daftar.map((c) => (
                  <tr key={c.id}>
                    <td className="tabular-nums text-xs font-semibold text-abu-800">{c.kode}</td>
                    <td className="font-medium text-abu-900">{c.nama}</td>
                    <td className="text-xs text-abu-500 max-w-[240px] truncate">
                      {c.alamat ?? '—'}
                    </td>
                    <td className="text-right tabular-nums text-sm text-abu-700">
                      {c._count.pegawai}
                    </td>
                    <td>
                      <span
                        className={`inline-block rounded-full px-2.5 py-1 text-[11px] font-medium ${
                          c.aktif ? 'bg-sukses-bg text-sukses' : 'bg-abu-100 text-abu-500'
                        }`}
                      >
                        {c.aktif ? 'Aktif' : 'Nonaktif'}
                      </span>
                    </td>
                    <td className="text-right">
                      <AksiCabang
                        id={c.id}
                        kode={c.kode}
                        nama={c.nama}
                        alamat={c.alamat}
                        aktif={c.aktif}
                        jumlahPegawai={c._count.pegawai}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="mt-6 kartu p-6">
          <h3 className="text-sm font-semibold text-abu-800">Catatan</h3>
          <ul className="mt-3 space-y-2 text-sm text-abu-500 leading-relaxed">
            <li>
              &middot; <strong>Kode cabang</strong> dipakai sebagai filter penilaian
              dan tampil di laporan SIP. Tidak dapat diubah setelah dibuat agar
              data historis tetap konsisten.
            </li>
            <li>
              &middot; Cabang yang masih punya pegawai <strong>tidak dapat dihapus</strong>.
              Pindahkan pegawainya dulu lewat menu Pegawai.
            </li>
            <li>
              &middot; Cabang <strong>nonaktif</strong> tidak muncul sebagai pilihan
              saat menambah pegawai baru, tapi data lamanya tetap utuh.
            </li>
          </ul>
        </div>
      </div>
    </Kerangka>
  );
}
