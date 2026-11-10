import { redirect } from 'next/navigation';
import Link from 'next/link';
import { pegawaiDariSesi } from '@/lib/auth';
import { Kerangka } from '@/components/kerangka';
import { prisma } from '@/lib/db';
import { PanelImpor, PanelTambah, AksiBaris, AksiPerubahanDataFisik } from '@/components/kelola-pegawai';
import { boleh } from '@/lib/sip/akses';
import { kumpulkanTurunan } from '@/lib/sip/hierarki';

export const metadata = { title: 'Pegawai' };

export default async function HalamanPegawai() {
  const saya = await pegawaiDariSesi();
  if (!saya) redirect('/masuk');
  if (saya.harusGantiPassword) redirect('/ubah-password');
  if (!boleh(saya.role, 'lihat_pegawai')) redirect('/dasbor');

  const admin = saya.role === 'ADMIN';
  const supervisor = saya.role === 'SUPERVISOR';
  const semuaCabang = await prisma.cabang.findMany({ where: { aktif: true }, orderBy: { kode: 'asc' } });
  const cabangSupervisor = supervisor
    ? kumpulkanTurunan(saya.cabang.id, semuaCabang.map((c) => ({ id: c.id, indukId: c.indukId })))
    : null;

  const [daftar, daftarCabang, daftarJabatan, perubahan] = await Promise.all([
    prisma.pegawai.findMany({
      where: admin ? {} : supervisor ? { cabangId: { in: cabangSupervisor! }, role: 'PEGAWAI' } : { cabangId: saya.cabang.id, role: 'PEGAWAI' },
      include: {
        jabatan: { select: { nama: true } },
        cabang: { select: { kode: true, nama: true } },
      },
      orderBy: [{ cabang: { kode: 'asc' } }, { nama: 'asc' }],
    }),
    Promise.resolve(semuaCabang),
    prisma.jabatan.findMany({ where: { aktif: true }, orderBy: { kode: 'asc' } }),
    prisma.perubahanDataPegawai.findMany({
      where: admin ? { status: 'MENUNGGU' } : { pengajuId: saya.id, status: 'MENUNGGU' },
      include: { pegawai: { select: { id: true, nip: true, nama: true, tanggalLahir: true, tinggiBadan: true } }, pengaju: { select: { nama: true } } },
      orderBy: { createdAt: 'asc' },
    }),
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

        {/* Pengajuan perubahan data fisik */}
        {perubahan.length > 0 && (
          <div className="mt-6 kartu overflow-hidden">
            <div className="border-b border-abu-200 px-4 py-3"><h2 className="text-sm font-semibold text-abu-800">{admin ? 'Menunggu persetujuan perubahan data fisik' : 'Pengajuan perubahan data fisik'}</h2></div>
            <div className="divide-y divide-abu-100">
              {perubahan.map((p) => <div key={p.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-xs"><div><strong>{p.pegawai.nama}</strong> <span className="text-abu-400">({p.pegawai.nip})</span><div className="mt-1 text-abu-500">{p.namaBaru ? `Nama: ${p.pegawai.nama} → ${p.namaBaru} · NIP: ${p.pegawai.nip} → ${p.nipBaru}` : `Tanggal lahir: ${p.pegawai.tanggalLahir?.toLocaleDateString('id-ID') ?? '—'} → ${p.tanggalLahirBaru?.toLocaleDateString('id-ID') ?? '—'} · Tinggi: ${p.pegawai.tinggiBadan ?? '—'} → ${p.tinggiBadanBaru ?? '—'} cm`}</div>{admin && <div className="text-abu-400">Diajukan oleh {p.pengaju.nama}</div>}</div>{admin ? <AksiPerubahanDataFisik perubahanId={p.id} /> : <span className="rounded bg-peringatan-bg px-2 py-1 text-peringatan">Menunggu admin</span>}</div>)}
            </div>
          </div>
        )}


        <div className="mt-6 kartu overflow-hidden">
          <div className="overflow-x-auto">
            <table className="tabel-sip">
              <thead>
                <tr>
                  <th>NIP</th>
                  <th>Nama</th>
                  <th>Tanggal lahir</th>
                  <th>Tinggi badan</th>
                  <th>Berat badan awal</th>
                  <th>Jabatan</th>
                  <th>Cabang</th>
                  <th>Peran</th>
                  <th>Status</th>
                  <th>Login terakhir</th>
                  {admin || supervisor ? <th className="text-right">Aksi</th> : null}
                </tr>
              </thead>
              <tbody>
                {daftar.length === 0 && (
                  <tr>
                    <td
                      colSpan={admin || supervisor ? 10 : 9}
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
                    <td className="text-xs text-abu-600 whitespace-nowrap">
                      {p.tanggalLahir?.toLocaleDateString('id-ID') ?? '—'}
                    </td>
                    <td className="text-xs text-abu-600 whitespace-nowrap">{p.tinggiBadan ? `${p.tinggiBadan} cm` : '—'}</td>
                    <td className="text-xs text-abu-600 whitespace-nowrap">{p.beratBadan ? `${p.beratBadan} kg` : '—'}</td>
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
                    {(admin || supervisor) && (
                      <td className="text-right">
                        <AksiBaris
                          pegawaiId={p.id}
                          izinMode={supervisor ? 'SUPERVISOR' : 'ADMIN'}
                          aktif={p.aktif}
                          data={{
                            nip: p.nip,
                            nama: p.nama,
                            email: p.email,
                            cabangId: p.cabangId,
                            jabatanId: p.jabatanId,
                            role: p.role,
                            tanggalLahir: p.tanggalLahir,
                            tinggiBadan: p.tinggiBadan,
                            beratBadan: p.beratBadan,
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
