import { redirect } from 'next/navigation';
import { pegawaiDariSesi } from '@/lib/auth';
import { Kerangka } from '@/components/kerangka';
import { prisma } from '@/lib/db';
import { PanelBuatPeriode, AksiPeriode } from '@/components/kelola-periode';
import { rentangPeriode } from '@/lib/sip/laporan';

export const metadata = { title: 'Periode' };

export default async function HalamanPeriode() {
  const saya = await pegawaiDariSesi();
  if (!saya) redirect('/masuk');
  if (saya.harusGantiPassword) redirect('/ubah-password');
  if (saya.role !== 'ADMIN') redirect('/dasbor');

  const daftar = await prisma.periode.findMany({
    orderBy: { tanggalMulai: 'desc' },
    include: {
      _count: { select: { penilaian: true } },
    },
    take: 52,
  });

  return (
    <Kerangka pegawai={saya}>
      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-8">
        <div className="animasi-naik">
          <h1 className="text-2xl font-bold text-abu-900">Periode Penilaian</h1>
          <div className="mt-2 h-0.5 w-10 bg-btn-merah-500 rounded-full" />
          <p className="mt-3 text-sm text-abu-500">
            {daftar.length} periode terdaftar &middot; penilaian dilakukan
            mingguan
          </p>
        </div>

        <div className="mt-6">
          <PanelBuatPeriode />
        </div>

        <div className="mt-6 kartu overflow-hidden">
          <div className="overflow-x-auto">
            <table className="tabel-sip">
              <thead>
                <tr>
                  <th>Kode</th>
                  <th>Nama</th>
                  <th>Tanggal</th>
                  <th className="text-right">Penilaian</th>
                  <th>Status</th>
                  <th className="text-right">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {daftar.length === 0 && (
                  <tr>
                    <td colSpan={6} className="text-center py-10 text-sm text-abu-400">
                      Belum ada periode. Buat periode pertama di atas.
                    </td>
                  </tr>
                )}
                {daftar.map((p) => (
                  <tr key={p.id}>
                    <td className="tabular-nums text-xs text-abu-600">{p.kode}</td>
                    <td className="text-sm font-medium text-abu-900">{p.nama}</td>
                    <td className="text-xs text-abu-600 tabular-nums">
                      {rentangPeriode(p.tanggalMulai, p.tanggalSelesai)}
                    </td>
                    <td className="text-right tabular-nums text-sm text-abu-700">
                      {p._count.penilaian}
                    </td>
                    <td>
                      <div className="flex flex-wrap gap-1.5">
                        <span
                          className={`inline-block rounded-full px-2.5 py-1 text-[11px] font-medium ${
                            p.aktif ? 'bg-sukses-bg text-sukses' : 'bg-abu-100 text-abu-500'
                          }`}
                        >
                          {p.aktif ? 'Aktif' : 'Nonaktif'}
                        </span>
                        {p.dikunci && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-peringatan-bg px-2.5 py-1 text-[11px] font-medium text-peringatan">
                            🔒 Terkunci
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="text-right">
                      <AksiPeriode periodeId={p.id} aktif={p.aktif} dikunci={p.dikunci} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="mt-6 kartu p-6">
          <h3 className="text-sm font-semibold text-abu-800">Cara kerja periode</h3>
          <ul className="mt-3 space-y-2 text-sm text-abu-500 leading-relaxed">
            <li>
              &middot; <strong>Aktif</strong> &mdash; periode muncul di daftar
              penilaian dan dapat dipilih.
            </li>
            <li>
              &middot; <strong>Terkunci</strong> &mdash; penilaian pada periode ini
              tidak dapat diubah siapa pun, berguna setelah semua selesai ditinjau.
            </li>
            <li>
              &middot; Satu pegawai hanya punya satu penilaian per periode (tidak
              bisa dobel).
            </li>
          </ul>
        </div>
      </div>
    </Kerangka>
  );
}
