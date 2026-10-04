import { redirect } from 'next/navigation';
import Link from 'next/link';
import { pegawaiDariSesi } from '@/lib/auth';
import { Kerangka } from '@/components/kerangka';
import { prisma } from '@/lib/db';
import { BadgeRating } from '@/components/badge-rating';
import { angkaID } from '@/lib/sip/laporan';
import { pilihPeriodeRelevan } from '@/lib/sip/periode-aktif';
import {
  TombolDiketahui,
  TombolKunci,
  FormKembalikan,
} from '@/components/aksi-persetujuan';
import { boleh } from '@/lib/sip/akses';

export const metadata = { title: 'Persetujuan' };

const BOLEH_MENGETAHUI = new Set(['MANAGER', 'ADMIN']);

export default async function HalamanPersetujuan() {
  const saya = await pegawaiDariSesi();
  if (!saya) redirect('/masuk');
  if (saya.harusGantiPassword) redirect('/ubah-password');
  if (!boleh(saya.role, 'mengetahui')) redirect('/dasbor');

  const periode = await pilihPeriodeRelevan();

  const menunggu = periode
    ? await prisma.penilaian.findMany({
        where: {
          periodeId: periode.id,
          status: 'DIKIRIM',
          ...(saya.role === 'MANAGER'
            ? { pegawai: { cabangId: saya.cabang.id } }
            : {}),
          // manager tidak menilai dirinya sendiri
          ...(saya.role === 'MANAGER' ? { penilaiId: { not: saya.id } } : {}),
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
          penilai: { select: { nama: true } },
        },
        orderBy: { dikirimAt: 'asc' },
      })
    : [];

  const sudahDiketahui = periode
    ? await prisma.penilaian.findMany({
        where: {
          periodeId: periode.id,
          status: { in: ['DIKETAHUI', 'FINAL'] },
          ...(saya.role === 'MANAGER'
            ? { pegawai: { cabangId: saya.cabang.id } }
            : {}),
        },
        include: {
          pegawai: {
            select: {
              nama: true,
              nip: true,
              cabang: { select: { kode: true } },
            },
          },
          mengetahui: { select: { nama: true } },
        },
        orderBy: { diketahuiAt: 'desc' },
        take: 20,
      })
    : [];

  return (
    <Kerangka pegawai={saya}>
      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-8">
        <div className="animasi-naik">
          <h1 className="text-2xl font-bold text-abu-900">Persetujuan Penilaian</h1>
          <div className="mt-2 h-0.5 w-10 bg-btn-merah-500 rounded-full" />
          <p className="mt-3 text-sm text-abu-500">
            Tinjau penilaian yang dikirim atasan, lalu nyatakan mengetahui
            {saya.role === 'ADMIN' && ' atau kunci sebagai final'}.
          </p>
        </div>

        {/* Ringkasan status */}
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          <div className="kartu p-5">
            <div className="label-kolom">Menunggu diketahui</div>
            <div
              className={`mt-1.5 text-2xl font-bold ${
                menunggu.length > 0 ? 'text-peringatan' : 'text-abu-900'
              }`}
            >
              {menunggu.length}
            </div>
            <div className="mt-0.5 text-xs text-abu-400">penilaian</div>
          </div>
          <div className="kartu p-5">
            <div className="label-kolom">Sudah diketahui</div>
            <div className="mt-1.5 text-2xl font-bold text-abu-900">
              {sudahDiketahui.length}
            </div>
            <div className="mt-0.5 text-xs text-abu-400">penilaian</div>
          </div>
          <div className="kartu p-5">
            <div className="label-kolom">Periode</div>
            <div className="mt-1.5 text-base font-semibold text-abu-900">
              {periode?.nama ?? '—'}
            </div>
            <div className="mt-0.5 text-xs text-abu-400">
              {saya.role === 'MANAGER' ? saya.cabang.nama : 'Semua cabang'}
            </div>
          </div>
        </div>

        {/* ===== Menunggu persetujuan ===== */}
        <h2 className="mt-8 text-sm font-semibold text-abu-700 mb-3">
          Menunggu persetujuan Anda
        </h2>

        {menunggu.length === 0 ? (
          <div className="kartu p-10 text-center">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-sukses-bg mb-3">
              <svg className="h-6 w-6 text-sukses" viewBox="0 0 20 20" fill="currentColor">
                <path
                  fillRule="evenodd"
                  d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <p className="text-sm text-abu-500">
              Tidak ada penilaian yang menunggu persetujuan.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {menunggu.map((p) => (
              <div key={p.id} className="kartu p-6">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <h3 className="text-base font-bold text-abu-900">
                        {p.pegawai.nama}
                      </h3>
                      <span className="text-xs text-abu-400 tabular-nums">
                        {p.pegawai.nip}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-abu-500">
                      {p.pegawai.jabatan?.nama ?? '—'} &middot; Cabang{' '}
                      {p.pegawai.cabang.kode} — {p.pegawai.cabang.nama}
                    </p>
                    <p className="mt-1 text-xs text-abu-400">
                      Dinilai oleh {p.penilai.nama}
                      {p.dikirimAt && (
                        <> &middot; dikirim {p.dikirimAt.toLocaleString('id-ID')}</>
                      )}
                    </p>
                  </div>

                  <div className="text-right shrink-0">
                    <BadgeRating
                      rating={p.rating ?? 'Baik'}
                      nilai={p.nilaiAkhir ?? 0}
                      ukuran="besar"
                    />
                    <p className="mt-1.5 text-[11px] text-abu-400">
                      A {angkaID(p.nilaiPenampilan)} &middot; B {angkaID(p.nilaiKemampuan)}{' '}
                      &middot; C {angkaID(p.nilaiSikap)}
                    </p>
                  </div>
                </div>

                <div className="mt-4 grid gap-2 sm:grid-cols-3 text-xs">
                  <div className="rounded-lg bg-abu-50 px-3 py-2">
                    <span className="text-abu-400">Penampilan</span>
                    <span className="ml-2 font-semibold tabular-nums text-abu-800">
                      {angkaID(p.nilaiPenampilan)}
                    </span>
                  </div>
                  <div className="rounded-lg bg-abu-50 px-3 py-2">
                    <span className="text-abu-400">Kemampuan</span>
                    <span className="ml-2 font-semibold tabular-nums text-abu-800">
                      {angkaID(p.nilaiKemampuan)}
                    </span>
                  </div>
                  <div className="rounded-lg bg-abu-50 px-3 py-2">
                    <span className="text-abu-400">Sikap</span>
                    <span className="ml-2 font-semibold tabular-nums text-abu-800">
                      {angkaID(p.nilaiSikap)}
                    </span>
                  </div>
                </div>

                {p.catatanUmum && (
                  <div className="mt-3 rounded-lg border-l-[3px] border-btn-merah-500 bg-abu-50 px-3.5 py-2.5">
                    <p className="text-[11px] font-semibold text-abu-500 mb-0.5">
                      Catatan penilai
                    </p>
                    <p className="text-xs text-abu-700 leading-relaxed whitespace-pre-line">
                      {p.catatanUmum}
                    </p>
                  </div>
                )}

                <div className="mt-4 pt-4 border-t border-abu-200 flex flex-wrap items-start gap-3">
                  <Link
                    href={`/laporan/${p.id}`}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-abu-300 bg-white px-4 py-2 text-sm font-medium text-abu-700 hover:bg-abu-50 transition-colors"
                  >
                    Lihat laporan lengkap
                  </Link>
                  <TombolDiketahui penilaianId={p.id} />
                  {saya.role === 'ADMIN' && <TombolKunci penilaianId={p.id} />}
                  <FormKembalikan penilaianId={p.id} />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ===== Riwayat ===== */}
        {sudahDiketahui.length > 0 && (
          <>
            <h2 className="mt-10 text-sm font-semibold text-abu-700 mb-3">
              Sudah ditinjau
            </h2>
            <div className="kartu overflow-hidden">
              <div className="overflow-x-auto">
                <table className="tabel-sip">
                  <thead>
                    <tr>
                      <th>Nama</th>
                      <th>NIP</th>
                      <th>Cabang</th>
                      <th className="text-right">Nilai</th>
                      <th>Status</th>
                      <th>Diketahui oleh</th>
                      <th>Waktu</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sudahDiketahui.map((p) => (
                      <tr key={p.id}>
                        <td className="font-medium text-abu-900">{p.pegawai.nama}</td>
                        <td className="tabular-nums text-xs text-abu-600">{p.pegawai.nip}</td>
                        <td className="text-xs text-abu-600">{p.pegawai.cabang.kode}</td>
                        <td className="text-right">
                          <BadgeRating
                            rating={p.rating ?? 'Baik'}
                            nilai={p.nilaiAkhir ?? 0}
                            ukuran="kecil"
                          />
                        </td>
                        <td>
                          <span
                            className={`inline-block rounded-full px-2.5 py-1 text-[11px] font-medium ${
                              p.status === 'FINAL'
                                ? 'bg-sukses-bg text-sukses'
                                : 'bg-btn-biru-100 text-btn-biru-700'
                            }`}
                          >
                            {p.status === 'FINAL' ? 'Final' : 'Diketahui'}
                          </span>
                        </td>
                        <td className="text-xs text-abu-600">{p.mengetahui?.nama ?? '—'}</td>
                        <td className="text-xs text-abu-400 tabular-nums">
                          {p.diketahuiAt?.toLocaleString('id-ID') ?? '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </Kerangka>
  );
}
