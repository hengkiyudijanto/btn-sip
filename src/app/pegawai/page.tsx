import { redirect } from 'next/navigation';
import Link from 'next/link';
import { pegawaiDariSesi } from '@/lib/auth';
import { Kerangka } from '@/components/kerangka';
import { prisma } from '@/lib/db';
import { PanelImpor, PanelTambah, AksiBaris } from '@/components/kelola-pegawai';
import { boleh } from '@/lib/sip/akses';

export const metadata = { title: 'Pegawai' };

export default async function HalamanPegawai() {
  const saya = await pegawaiDariSesi();
  if (!saya) redirect('/masuk');
  if (saya.harusGantiPassword) redirect('/ubah-password');
  if (!boleh(saya.role, 'lihat_pegawai')) redirect('/dasbor');

  const admin = saya.role === 'ADMIN';

  const [daftar, daftarCabang, daftarJabatan] = await Promise.all([
    prisma.pegawai.findMany({
      where: admin ? {} : { cabangId: saya.cabang.id },
      include: {
        jabatan: { select: { nama: true } },
        cabang: { select: { kode: true, nama: true } },
      },
      orderBy: [{ cabang: { kode: 'asc' } }, { nama: 'asc' }],
    }),
    prisma.cabang.findMany({ where: { aktif: true }, orderBy: { kode: 'asc' } }),
    prisma.jabatan.findMany({ where: { aktif: true }, orderBy: { kode: 'asc' } }),
  ]);

  const labelRole: Record<string, string> = {
    PEGAWAI: 'Pegawai',
    SUPERVISOR: 'Supervisor',
    MANAGER: 'Manager',
    ADMIN: 'Admin',
  };

  return (
    <Kerangka pegawai={saya}>
      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-8">
        <div className="animasi-naik">
          <h1 className="text-2xl font-bold text-abu-900">Pengelolaan Pegawai</h1>
          <div className="mt-2 h-0.5 w-10 bg-btn-merah-500 rounded-full" />
          <p className="mt-3 text-sm text-abu-500">
            {daftar.length} pegawai terdaftar
            {!admin && ` di ${saya.cabang.nama}`}
            {admin && <> &middot; {daftarCabang.length} cabang</>}
          </p>
        </div>

        {/* Panel admin: tambah manual & impor massal */}
        {admin && (
          <div className="mt-6 space-y-4">
            <PanelTambah daftarCabang={daftarCabang} daftarJabatan={daftarJabatan} />
            <PanelImpor />
          </div>
        )}

        {/* Tabel pegawai */}
        <div className="mt-6 kartu overflow-hidden">
          <div className="overflow-x-auto">
            <table className="tabel-sip">
              <thead>
                <tr>
                  <th>NIP</th>
                  <th>Nama</th>
                  <th>Jabatan</th>
                  <th>Cabang</th>
                  <th>Peran</th>
                  <th>Status</th>
                  <th>Login terakhir</th>
                  {admin && <th className="text-right">Aksi</th>}
                </tr>
              </thead>
              <tbody>
                {daftar.length === 0 && (
                  <tr>
                    <td
                      colSpan={admin ? 8 : 7}
                      className="text-center py-10 text-sm text-abu-400"
                    >
                      Belum ada pegawai terdaftar.
                      {admin && ' Gunakan tombol Tambah Pegawai atau Impor massal di atas.'}
                    </td>
                  </tr>
                )}
                {daftar.map((p) => (
                  <tr key={p.id}>
                    <td className="tabular-nums text-xs text-abu-600">{p.nip}</td>
                    <td className="font-medium text-abu-900">
                      <Link
                        href={`/pegawai/${p.id}`}
                        className="hover:text-btn-biru-600 transition-colors"
                      >
                        {p.nama}
                      </Link>
                      {p.harusGantiPassword && (
                        <span className="ml-2 rounded bg-peringatan-bg px-1.5 py-0.5 text-[10px] text-peringatan whitespace-nowrap">
                          belum ganti password
                        </span>
                      )}
                      {p.fotoData && (
                        <span className="ml-2 text-[10px] text-abu-400" title="Punya foto">
                          📷
                        </span>
                      )}
                    </td>
                    <td className="text-xs text-abu-600">{p.jabatan?.nama ?? '—'}</td>
                    <td className="text-xs text-abu-600">
                      {p.cabang.kode} — {p.cabang.nama}
                    </td>
                    <td className="text-xs text-abu-600">{labelRole[p.role]}</td>
                    <td>
                      <span
                        className={`inline-block rounded-full px-2.5 py-1 text-[11px] font-medium ${
                          p.aktif ? 'bg-sukses-bg text-sukses' : 'bg-abu-100 text-abu-500'
                        }`}
                      >
                        {p.aktif ? 'Aktif' : 'Nonaktif'}
                      </span>
                    </td>
                    <td className="text-xs text-abu-400 tabular-nums">
                      {p.lastLoginAt
                        ? p.lastLoginAt.toLocaleDateString('id-ID', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                          })
                        : '—'}
                    </td>
                    {admin && (
                      <td className="text-right">
                        <AksiBaris
                          pegawaiId={p.id}
                          aktif={p.aktif}
                          data={{
                            nip: p.nip,
                            nama: p.nama,
                            email: p.email,
                            cabangId: p.cabangId,
                            jabatanId: p.jabatanId,
                            role: p.role,
                          }}
                          daftarCabang={daftarCabang}
                          daftarJabatan={daftarJabatan}
                        />
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </Kerangka>
  );
}
