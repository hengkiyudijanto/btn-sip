import { redirect } from 'next/navigation';
import Link from 'next/link';
import { pegawaiDariSesi } from '@/lib/auth';
import { Kerangka } from '@/components/kerangka';
import { prisma } from '@/lib/db';
import { BadgeRating } from '@/components/badge-rating';

const LABEL_ROLE: Record<string, string> = {
  PEGAWAI: 'Pegawai',
  SUPERVISOR: 'Supervisor',
  MANAGER: 'Manager',
  ADMIN: 'Administrator',
};

export const metadata = { title: 'Dasbor' };

export default async function Dasbor() {
  const pegawai = await pegawaiDariSesi();
  if (!pegawai) redirect('/masuk');
  if (pegawai.harusGantiPassword) redirect('/ubah-password');

  const BOLEH_MENILAI = ['SUPERVISOR', 'MANAGER', 'ADMIN'].includes(pegawai.role);

  // Statistik ringkas
  const periode = await prisma.periode.findFirst({
    where: { aktif: true },
    orderBy: { tanggalMulai: 'desc' },
  });

  const [totalPetugas, penilaianSaya, penilaianPeriodeIni] = await Promise.all([
    prisma.pegawai.count({
      where: {
        aktif: true,
        role: 'PEGAWAI',
        ...(pegawai.role === 'ADMIN' ? {} : { cabangId: pegawai.cabang.id }),
      },
    }),
    prisma.penilaian.findMany({
      where: { pegawaiId: pegawai.id },
      include: { periode: true },
      orderBy: { createdAt: 'desc' },
      take: 5,
    }),
    periode
      ? prisma.penilaian.count({
          where: { periodeId: periode.id, penilaiId: pegawai.id },
        })
      : Promise.resolve(0),
  ]);

  return (
    <Kerangka pegawai={pegawai}>
      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-8">
        {/* ===== Sambutan ===== */}
        <div className="animasi-naik">
          <h1 className="text-2xl font-bold text-abu-900">
            Selamat datang, {pegawai.nama.split(' ')[0]}
          </h1>
          <div className="mt-2 h-0.5 w-10 bg-btn-merah-500 rounded-full" />
          <p className="mt-3 text-sm text-abu-500">
            {LABEL_ROLE[pegawai.role]} &middot; {pegawai.cabang.nama}
            {periode && <> &middot; Periode {periode.nama}</>}
          </p>
        </div>

        {/* ===== Kartu statistik ===== */}
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {BOLEH_MENILAI ? (
            <>
              <StatKartu label="Petugas" nilai={String(totalPetugas)} keterangan="Yang dapat dinilai" />
              <StatKartu
                label="Sudah dinilai"
                nilai={String(penilaianPeriodeIni)}
                keterangan={periode ? periode.nama : 'Belum ada periode'}
              />
              <StatKartu
                label="Belum dinilai"
                nilai={String(Math.max(0, totalPetugas - penilaianPeriodeIni))}
                keterangan="Perlu diselesaikan"
                sorot
              />
            </>
          ) : (
            <>
              <StatKartu
                label="Penilaian saya"
                nilai={String(penilaianSaya.length)}
                keterangan="Total penilaian diterima"
              />
              <StatKartu
                label="Jabatan"
                nilai={pegawai.jabatan?.nama ?? '—'}
                keterangan={pegawai.cabang.nama}
              />
            </>
          )}
          <StatKartu
            label="Peran"
            nilai={LABEL_ROLE[pegawai.role]}
            keterangan={`NIP ${pegawai.nip}`}
          />
        </div>

        {/* ===== Aksi cepat ===== */}
        <div className="mt-8 grid gap-4 lg:grid-cols-3">
          {BOLEH_MENILAI && (
            <Link href="/penilaian" className="kartu p-6 hover:shadow-md transition-shadow group">
              <div className="flex items-center justify-between">
                <div className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-btn-biru-50">
                  <svg className="h-5 w-5 text-btn-biru-600" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M5.433 13.917l1.262-3.155A4 4 0 017.58 9.42l6.92-6.918a2.121 2.121 0 013 3l-6.92 6.918c-.383.383-.84.685-1.343.886l-3.154 1.262a.5.5 0 01-.65-.65z" />
                    <path d="M3.5 5.75c0-.69.56-1.25 1.25-1.25H10A.75.75 0 0010 3H4.75A2.75 2.75 0 002 5.75v9.5A2.75 2.75 0 004.75 18h9.5A2.75 2.75 0 0017 15.25V10a.75.75 0 00-1.5 0v5.25c0 .69-.56 1.25-1.25 1.25h-9.5c-.69 0-1.25-.56-1.25-1.25v-9.5z" />
                  </svg>
                </div>
                <svg className="h-4 w-4 text-abu-300 group-hover:text-btn-biru-500 transition-colors" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" />
                </svg>
              </div>
              <h3 className="mt-4 text-sm font-semibold text-abu-900">Lakukan Penilaian</h3>
              <p className="mt-1.5 text-xs text-abu-500 leading-relaxed">
                Isi form penilaian 13 aspek untuk petugas di cabang Anda.
              </p>
            </Link>
          )}

          <Link href="/laporan" className="kartu p-6 hover:shadow-md transition-shadow group">
            <div className="flex items-center justify-between">
              <div className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-btn-biru-50">
                <svg className="h-5 w-5 text-btn-biru-600" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
                </svg>
              </div>
              <svg className="h-4 w-4 text-abu-300 group-hover:text-btn-biru-500 transition-colors" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" />
              </svg>
            </div>
            <h3 className="mt-4 text-sm font-semibold text-abu-900">Laporan &amp; Rekap</h3>
            <p className="mt-1.5 text-xs text-abu-500 leading-relaxed">
              Cetak laporan SIP, lihat rekap dan peringkat per cabang.
            </p>
          </Link>

          {['ADMIN', 'MANAGER'].includes(pegawai.role) && (
            <Link href="/pegawai" className="kartu p-6 hover:shadow-md transition-shadow group">
              <div className="flex items-center justify-between">
                <div className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-btn-biru-50">
                  <svg className="h-5 w-5 text-btn-biru-600" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M7 9a3 3 0 100-6 3 3 0 000 6zM3 15a5 5 0 019.33-2.5A4.5 4.5 0 0010 12a4.5 4.5 0 00-1 .11V15H3z" />
                    <path d="M15 11a3 3 0 100 6 3 3 0 000-6z" />
                  </svg>
                </div>
                <svg className="h-4 w-4 text-abu-300 group-hover:text-btn-biru-500 transition-colors" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" />
                </svg>
              </div>
              <h3 className="mt-4 text-sm font-semibold text-abu-900">Kelola Pegawai</h3>
              <p className="mt-1.5 text-xs text-abu-500 leading-relaxed">
                Tambah pegawai manual atau impor dari file Excel.
              </p>
            </Link>
          )}
        </div>

        {/* ===== Riwayat penilaian (untuk pegawai biasa) ===== */}
        {!BOLEH_MENILAI && penilaianSaya.length > 0 && (
          <div className="mt-8 kartu overflow-hidden">
            <div className="px-6 py-4 border-b border-abu-200">
              <h2 className="text-sm font-semibold text-abu-800">Riwayat penilaian saya</h2>
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
                  </tr>
                </thead>
                <tbody>
                  {penilaianSaya.map((p) => (
                    <tr key={p.id}>
                      <td className="text-xs text-abu-600">{p.periode.nama}</td>
                      <td className="tabular-nums text-sm">{p.nilaiPenampilan?.toFixed(2) ?? '—'}</td>
                      <td className="tabular-nums text-sm">{p.nilaiKemampuan?.toFixed(2) ?? '—'}</td>
                      <td className="tabular-nums text-sm">{p.nilaiSikap?.toFixed(2) ?? '—'}</td>
                      <td className="text-right">
                        {p.nilaiAkhir != null && (
                          <BadgeRating rating={p.rating ?? 'Baik'} nilai={p.nilaiAkhir} ukuran="kecil" />
                        )}
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

function StatKartu({
  label,
  nilai,
  keterangan,
  sorot,
}: {
  label: string;
  nilai: string;
  keterangan: string;
  sorot?: boolean;
}) {
  return (
    <div className="kartu p-5">
      <div className="label-kolom">{label}</div>
      <div
        className={`mt-1.5 text-2xl font-bold ${
          sorot ? 'text-btn-merah-600' : 'text-abu-900'
        }`}
      >
        {nilai}
      </div>
      <div className="mt-0.5 text-xs text-abu-400 truncate">{keterangan}</div>
    </div>
  );
}
