import { redirect } from 'next/navigation';
import Link from 'next/link';
import { pegawaiDariSesi } from '@/lib/auth';
import { Kerangka } from '@/components/kerangka';
import { prisma } from '@/lib/db';
import { BadgeRating } from '@/components/badge-rating';
import { angkaID } from '@/lib/sip/laporan';

export const metadata = { title: 'Laporan' };

export default async function HalamanLaporan({
  searchParams,
}: {
  searchParams: Promise<{ periode?: string; cabang?: string }>;
}) {
  const saya = await pegawaiDariSesi();
  if (!saya) redirect('/masuk');
  if (saya.harusGantiPassword) redirect('/ubah-password');

  const { periode: periodeId, cabang: cabangId } = await searchParams;

  const daftarPeriode = await prisma.periode.findMany({
    orderBy: { tanggalMulai: 'desc' },
    take: 20,
  });

  const periodeTerpilih = periodeId
    ? daftarPeriode.find((p) => p.id === periodeId)
    : daftarPeriode.find((p) => p.aktif) ?? daftarPeriode[0];

  const bolehLihatSemua = saya.role === 'ADMIN';
  const daftarCabang = bolehLihatSemua
    ? await prisma.cabang.findMany({ where: { aktif: true }, orderBy: { kode: 'asc' } })
    : [];

  const cabangFilter = bolehLihatSemua ? cabangId : undefined;

  const penilaian = periodeTerpilih
    ? await prisma.penilaian.findMany({
        where: {
          periodeId: periodeTerpilih.id,
          ...(bolehLihatSemua
            ? cabangFilter
              ? { pegawai: { cabangId: cabangFilter } }
              : {}
            : { pegawai: { cabangId: saya.cabang.id } }),
        },
        include: {
          pegawai: {
            select: {
              nama: true,
              nip: true,
              cabang: { select: { kode: true, nama: true } },
              jabatan: { select: { nama: true } },
            },
          },
        },
        orderBy: [{ nilaiAkhir: 'desc' }],
      })
    : [];

  const rekap =
    penilaian.length > 0
      ? {
          jumlah: penilaian.length,
          rataRata:
            penilaian.reduce((a, p) => a + (p.nilaiAkhir ?? 0), 0) / penilaian.length,
          tertinggi: penilaian[0],
          terendah: penilaian[penilaian.length - 1],
          perRating: hitungPerRating(penilaian.map((p) => p.rating ?? '—')),
        }
      : null;

  return (
    <Kerangka pegawai={saya}>
      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-8">
        <div className="animasi-naik">
          <h1 className="text-2xl font-bold text-abu-900">Laporan &amp; Rekap</h1>
          <div className="mt-2 h-0.5 w-10 bg-btn-merah-500 rounded-full" />
          <p className="mt-3 text-sm text-abu-500">
            Lihat rekap penilaian per periode, lalu cetak laporan SIP per petugas.
          </p>
        </div>

        {/* ===== Filter ===== */}
        <form className="mt-6 kartu p-5" method="get">
          <div className="flex flex-wrap items-end gap-4">
            <div>
              <label htmlFor="periode" className="block text-xs font-medium text-abu-600 mb-1.5">
                Periode
              </label>
              <select
                id="periode"
                name="periode"
                defaultValue={periodeTerpilih?.id ?? ''}
                className="rounded-lg border border-abu-300 bg-white px-3 py-2 text-sm text-abu-800 focus:border-btn-biru-500 focus:ring-2 focus:ring-btn-biru-500/20 focus:outline-none min-w-[240px]"
              >
                {daftarPeriode.length === 0 && <option value="">Belum ada periode</option>}
                {daftarPeriode.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nama}
                  </option>
                ))}
              </select>
            </div>

            {bolehLihatSemua && daftarCabang.length > 0 && (
              <div>
                <label htmlFor="cabang" className="block text-xs font-medium text-abu-600 mb-1.5">
                  Cabang
                </label>
                <select
                  id="cabang"
                  name="cabang"
                  defaultValue={cabangFilter ?? ''}
                  className="rounded-lg border border-abu-300 bg-white px-3 py-2 text-sm text-abu-800 focus:border-btn-biru-500 focus:ring-2 focus:ring-btn-biru-500/20 focus:outline-none min-w-[200px]"
                >
                  <option value="">Semua cabang</option>
                  {daftarCabang.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.kode} — {c.nama}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <button
              type="submit"
              className="rounded-lg bg-btn-biru-600 px-4 py-2 text-sm font-semibold text-white hover:bg-btn-biru-700 transition-colors"
            >
              Tampilkan
            </button>
          </div>
        </form>

        {rekap && (
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="kartu p-5">
              <div className="label-kolom">Sudah dinilai</div>
              <div className="mt-1.5 text-2xl font-bold text-abu-900">{rekap.jumlah}</div>
              <div className="mt-0.5 text-xs text-abu-400">petugas</div>
            </div>
            <div className="kartu p-5">
              <div className="label-kolom">Rata-rata nilai</div>
              <div className="mt-1.5 text-2xl font-bold text-abu-900 tabular-nums">
                {angkaID(rekap.rataRata)}
              </div>
              <div className="mt-0.5 text-xs text-abu-400">skala 0&ndash;5</div>
            </div>
            <div className="kartu p-5">
              <div className="label-kolom">Nilai tertinggi</div>
              <div className="mt-1.5 text-2xl font-bold text-sukses tabular-nums">
                {angkaID(rekap.tertinggi?.nilaiAkhir)}
              </div>
              <div className="mt-0.5 text-xs text-abu-400 truncate">
                {rekap.tertinggi?.pegawai.nama}
              </div>
            </div>
            <div className="kartu p-5">
              <div className="label-kolom">Nilai terendah</div>
              <div className="mt-1.5 text-2xl font-bold text-btn-merah-600 tabular-nums">
                {angkaID(rekap.terendah?.nilaiAkhir)}
              </div>
              <div className="mt-0.5 text-xs text-abu-400 truncate">
                {rekap.terendah?.pegawai.nama}
              </div>
            </div>
          </div>
        )}

        {rekap && (
          <div className="mt-4 kartu p-5">
            <h3 className="text-xs font-semibold text-abu-700 mb-3">Sebaran kategori</h3>
            <div className="flex flex-wrap gap-3">
              {Object.entries(rekap.perRating).map(([rating, jml]) => (
                <div key={rating} className="flex items-center gap-2">
                  <BadgeRating rating={rating} ukuran="kecil" />
                  <span className="text-sm font-semibold text-abu-700 tabular-nums">{jml}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="mt-6 kartu overflow-hidden">
          <div className="overflow-x-auto">
            <table className="tabel-sip">
              <thead>
                <tr>
                  <th style={{ width: '48px' }}>Rank</th>
                  <th>Nama</th>
                  <th>NIP</th>
                  <th>Jabatan</th>
                  <th>Cabang</th>
                  <th className="text-right">Penampilan</th>
                  <th className="text-right">Kemampuan</th>
                  <th className="text-right">Sikap</th>
                  <th className="text-right">Nilai Akhir</th>
                  <th className="text-center">Status</th>
                  <th className="text-right">Laporan</th>
                </tr>
              </thead>
              <tbody>
                {penilaian.length === 0 && (
                  <tr>
                    <td colSpan={11} className="text-center py-12">
                      <p className="text-sm text-abu-400">
                        Belum ada penilaian pada periode ini.
                      </p>
                      <Link
                        href="/penilaian"
                        className="mt-3 inline-block text-xs font-medium text-btn-biru-600 hover:underline"
                      >
                        Mulai lakukan penilaian
                      </Link>
                    </td>
                  </tr>
                )}
                {penilaian.map((p, i) => (
                  <tr key={p.id}>
                    <td className="text-center">
                      {i < 3 ? (
                        <span
                          className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold ${
                            i === 0
                              ? 'bg-[#fef3c7] text-[#b45309]'
                              : i === 1
                                ? 'bg-abu-200 text-abu-700'
                                : 'bg-[#fed7aa] text-[#c2410c]'
                          }`}
                        >
                          {i + 1}
                        </span>
                      ) : (
                        <span className="text-xs text-abu-400 tabular-nums">{i + 1}</span>
                      )}
                    </td>
                    <td className="font-medium text-abu-900">{p.pegawai.nama}</td>
                    <td className="tabular-nums text-xs text-abu-600">{p.pegawai.nip}</td>
                    <td className="text-xs text-abu-600">{p.pegawai.jabatan?.nama ?? '—'}</td>
                    <td className="text-xs text-abu-600">{p.pegawai.cabang.kode}</td>
                    <td className="text-right tabular-nums text-sm">{angkaID(p.nilaiPenampilan)}</td>
                    <td className="text-right tabular-nums text-sm">{angkaID(p.nilaiKemampuan)}</td>
                    <td className="text-right tabular-nums text-sm">{angkaID(p.nilaiSikap)}</td>
                    <td className="text-right">
                      <BadgeRating
                        rating={p.rating ?? 'Baik'}
                        nilai={p.nilaiAkhir ?? 0}
                        ukuran="kecil"
                      />
                    </td>
                    <td className="text-center text-[11px] text-abu-500">{p.status}</td>
                    <td className="text-right">
                      <Link
                        href={`/laporan/${p.id}`}
                        className="inline-flex items-center gap-1 rounded-md border border-btn-biru-200 bg-btn-biru-50 px-3 py-1.5 text-xs font-medium text-btn-biru-700 hover:bg-btn-biru-100 transition-colors"
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
      </div>
    </Kerangka>
  );
}

function hitungPerRating(daftar: string[]): Record<string, number> {
  const hasil: Record<string, number> = {};
  for (const r of daftar) hasil[r] = (hasil[r] ?? 0) + 1;
  const urutan = ['Istimewa', 'Sangat Baik', 'Baik', 'Cukup', 'Kurang'];
  return Object.fromEntries(urutan.filter((r) => hasil[r]).map((r) => [r, hasil[r]]));
}
