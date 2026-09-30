import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { pegawaiDariSesi } from '@/lib/auth';
import { Kerangka } from '@/components/kerangka';
import { prisma } from '@/lib/db';
import { UnggahFoto } from '@/components/unggah-foto';
import { LABEL_JENIS, WARNA_JENIS } from '@/lib/sip/hierarki';

export const metadata = { title: 'Detail Pegawai' };

export default async function HalamanDetailPegawai({
  params,
}: {
  params: Promise<{ pegawaiId: string }>;
}) {
  const saya = await pegawaiDariSesi();
  if (!saya) redirect('/masuk');
  if (saya.harusGantiPassword) redirect('/ubah-password');

  const { pegawaiId } = await params;

  const p = await prisma.pegawai.findUnique({
    where: { id: pegawaiId },
    include: {
      jabatan: true,
      cabang: { include: { induk: { select: { kode: true, nama: true, jenis: true } } } },
      atasan: { select: { nama: true, nip: true } },
      penilaianku: {
        include: { periode: { select: { nama: true } } },
        orderBy: { createdAt: 'desc' },
        take: 5,
      },
    },
  });
  if (!p) notFound();

  // pegawai biasa hanya boleh melihat dirinya sendiri
  if (saya.role === 'PEGAWAI' && p.id !== saya.id) redirect('/dasbor');

  const labelRole: Record<string, string> = {
    PEGAWAI: 'Pegawai',
    SUPERVISOR: 'Supervisor (penilai)',
    MANAGER: 'Manager (mengetahui)',
    ADMIN: 'Administrator',
  };

  const fotoTampil = p.fotoData ?? p.fotoUrl;

  return (
    <Kerangka pegawai={saya}>
      <div className="mx-auto max-w-5xl px-4 sm:px-6 py-8">
        <Link
          href="/pegawai"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-abu-500 hover:text-btn-biru-600 transition-colors mb-5"
        >
          <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
            <path
              fillRule="evenodd"
              d="M12.79 5.23a.75.75 0 01-.02 1.06L8.832 10l3.938 3.71a.75.75 0 11-1.04 1.08l-4.5-4.25a.75.75 0 010-1.08l4.5-4.25a.75.75 0 011.06.02z"
              clipRule="evenodd"
            />
          </svg>
          Kembali ke daftar pegawai
        </Link>

        {/* ===== Kepala: identitas ===== */}
        <div className="animasi-naik kartu p-6 mb-6">
          <div className="flex flex-wrap items-start gap-6">
            <div className="shrink-0">
              <div
                className="rounded-lg border border-abu-200 bg-abu-50 overflow-hidden flex items-center justify-center"
                style={{ width: '96px', height: '128px' }}
              >
                {fotoTampil ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={fotoTampil}
                    alt={p.nama}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                ) : (
                  <span className="text-[10px] text-abu-400 text-center px-2">Tanpa foto</span>
                )}
              </div>
            </div>

            <div className="flex-1 min-w-[240px]">
              <h1 className="text-xl font-bold text-abu-900">{p.nama}</h1>
              <div className="mt-1.5 h-0.5 w-8 bg-btn-merah-500 rounded-full" />

              <dl className="mt-4 grid gap-2 sm:grid-cols-2 text-sm">
                <Baris label="NIP" nilai={p.nip} />
                <Baris label="Jabatan" nilai={p.jabatan?.nama ?? '—'} />
                <Baris label="Peran" nilai={labelRole[p.role] ?? p.role} />
                <Baris label="Email" nilai={p.email ?? '—'} />
                <div className="sm:col-span-2">
                  <dt className="text-xs text-abu-400">Unit kerja</dt>
                  <dd className="mt-0.5 flex items-center gap-2 flex-wrap">
                    <span
                      className={`inline-block rounded px-2 py-0.5 text-[10px] font-semibold ${
                        WARNA_JENIS[p.cabang.jenis] ?? 'bg-abu-100 text-abu-600'
                      }`}
                    >
                      {LABEL_JENIS[p.cabang.jenis]}
                    </span>
                    <span className="font-medium text-abu-800">
                      {p.cabang.kode} — {p.cabang.nama}
                    </span>
                  </dd>
                  {p.cabang.induk && (
                    <p className="mt-1 text-[11px] text-abu-400">
                      Induk: {LABEL_JENIS[p.cabang.induk.jenis]} {p.cabang.induk.kode} —{' '}
                      {p.cabang.induk.nama}
                    </p>
                  )}
                </div>
                {p.atasan && (
                  <div className="sm:col-span-2">
                    <dt className="text-xs text-abu-400">Atasan langsung</dt>
                    <dd className="mt-0.5 font-medium text-abu-800">
                      {p.atasan.nama} <span className="text-abu-400 tabular-nums">({p.atasan.nip})</span>
                    </dd>
                  </div>
                )}
              </dl>

              <div className="mt-4 flex flex-wrap items-center gap-2">
                <span
                  className={`inline-block rounded-full px-2.5 py-1 text-[11px] font-medium ${
                    p.aktif ? 'bg-sukses-bg text-sukses' : 'bg-abu-100 text-abu-500'
                  }`}
                >
                  {p.aktif ? 'Aktif' : 'Nonaktif'}
                </span>
                {p.harusGantiPassword && (
                  <span className="inline-block rounded-full bg-peringatan-bg px-2.5 py-1 text-[11px] font-medium text-peringatan">
                    Wajib ganti password
                  </span>
                )}
                {p.lastLoginAt && (
                  <span className="text-[11px] text-abu-400">
                    Login terakhir {p.lastLoginAt.toLocaleDateString('id-ID')}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ===== Unggah foto (admin) ===== */}
        {saya.role === 'ADMIN' && (
          <div className="mb-6">
            <UnggahFoto
              pegawaiId={p.id}
              nama={p.nama}
              fotoUrl={p.fotoData ?? p.fotoUrl}
              ukuranAwal={p.fotoUkuran}
            />
          </div>
        )}

        {/* ===== Riwayat penilaian ===== */}
        {p.penilaianku.length > 0 && (
          <div className="kartu overflow-hidden">
            <div className="px-6 py-4 border-b border-abu-200">
              <h3 className="text-sm font-semibold text-abu-800">Riwayat penilaian</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="tabel-sip">
                <thead>
                  <tr>
                    <th>Periode</th>
                    <th>Penampilan</th>
                    <th>Kemampuan</th>
                    <th>Sikap</th>
                    <th className="text-right">Nilai Akhir</th>
                    <th className="text-right">Laporan</th>
                  </tr>
                </thead>
                <tbody>
                  {p.penilaianku.map((n) => (
                    <tr key={n.id}>
                      <td className="text-xs text-abu-600">{n.periode.nama}</td>
                      <td className="tabular-nums text-sm">{n.nilaiPenampilan?.toFixed(2) ?? '—'}</td>
                      <td className="tabular-nums text-sm">{n.nilaiKemampuan?.toFixed(2) ?? '—'}</td>
                      <td className="tabular-nums text-sm">{n.nilaiSikap?.toFixed(2) ?? '—'}</td>
                      <td className="text-right text-sm font-semibold tabular-nums">
                        {n.nilaiAkhir?.toFixed(2) ?? '—'}
                      </td>
                      <td className="text-right">
                        <Link
                          href={`/laporan/${n.id}`}
                          className="text-xs font-medium text-btn-biru-600 hover:underline"
                        >
                          Lihat
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </Kerangka>
  );
}

function Baris({ label, nilai }: { label: string; nilai: string }) {
  return (
    <div>
      <dt className="text-xs text-abu-400">{label}</dt>
      <dd className="mt-0.5 font-medium text-abu-800">{nilai}</dd>
    </div>
  );
}
