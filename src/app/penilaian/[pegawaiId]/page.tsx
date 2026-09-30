import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { pegawaiDariSesi } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { FormPenilaian, type NilaiAspek } from '@/components/form-penilaian';
import { simpanPenilaian } from '@/app/actions/penilaian';
import { Kerangka } from '@/components/kerangka';

export const metadata = { title: 'Isi Penilaian' };

const BOLEH_MENILAI = new Set(['SUPERVISOR', 'MANAGER', 'ADMIN']);

export default async function HalamanIsiPenilaian({
  params,
  searchParams,
}: {
  params: Promise<{ pegawaiId: string }>;
  searchParams: Promise<{ periode?: string }>;
}) {
  const saya = await pegawaiDariSesi();
  if (!saya) redirect('/masuk');
  if (saya.harusGantiPassword) redirect('/ubah-password');
  if (!BOLEH_MENILAI.has(saya.role)) redirect('/dasbor');

  const { pegawaiId } = await params;
  const { periode: periodeIdParam } = await searchParams;

  const target = await prisma.pegawai.findUnique({
    where: { id: pegawaiId },
    include: {
      jabatan: true,
      cabang: { select: { kode: true, nama: true } },
    },
  });
  if (!target) notFound();

  const periode = periodeIdParam
    ? await prisma.periode.findUnique({ where: { id: periodeIdParam } })
    : await prisma.periode.findFirst({
        where: { aktif: true },
        orderBy: { tanggalMulai: 'desc' },
      });
  if (!periode) redirect('/penilaian');

  // Nilai yang sudah ada (kalau pernah disimpan)
  const tersimpan = await prisma.penilaian.findUnique({
    where: { pegawaiId_periodeId: { pegawaiId, periodeId: periode.id } },
    include: { detail: true },
  });

  const nilaiAwal: NilaiAspek = {};
  for (const d of tersimpan?.detail ?? []) {
    nilaiAwal[d.kodeAspek] = {
      nilai: d.nilaiMentah,
      catatan: d.catatan ?? '',
    };
  }

  const terkunci = periode.dikunci || tersimpan?.status === 'DIKETAHUI' || tersimpan?.status === 'FINAL';

  return (
    <Kerangka pegawai={saya}>
    <div className="mx-auto max-w-7xl px-4 sm:px-6 py-8">
      {/* Navigasi kembali */}
      <Link
        href="/penilaian"
        className="inline-flex items-center gap-1.5 text-xs font-medium text-abu-500 hover:text-btn-biru-600 transition-colors mb-5"
      >
        <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
          <path
            fillRule="evenodd"
            d="M12.79 5.23a.75.75 0 01-.02 1.06L8.832 10l3.938 3.71a.75.75 0 11-1.04 1.08l-4.5-4.25a.75.75 0 010-1.08l4.5-4.25a.75.75 0 011.06.02z"
            clipRule="evenodd"
          />
        </svg>
        Kembali ke daftar penilaian
      </Link>

      {/* Kepala halaman */}
      <div className="animasi-naik mb-6">
        <h1 className="text-2xl font-bold text-abu-900">Form Penilaian</h1>
        <div className="mt-2 h-0.5 w-10 bg-btn-merah-500 rounded-full" />

        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="kartu p-4">
            <div className="label-kolom">Nama</div>
            <div className="mt-1 text-sm font-semibold text-abu-900">{target.nama}</div>
          </div>
          <div className="kartu p-4">
            <div className="label-kolom">NIP</div>
            <div className="mt-1 text-sm font-semibold tabular-nums text-abu-900">
              {target.nip}
            </div>
          </div>
          <div className="kartu p-4">
            <div className="label-kolom">Jabatan</div>
            <div className="mt-1 text-sm font-semibold text-abu-900">
              {target.jabatan?.nama ?? '—'}
            </div>
          </div>
          <div className="kartu p-4">
            <div className="label-kolom">Periode</div>
            <div className="mt-1 text-sm font-semibold text-abu-900">{periode.nama}</div>
          </div>
        </div>

        {target.cabang && (
          <p className="mt-3 text-xs text-abu-400">
            Cabang {target.cabang.kode} — {target.cabang.nama}
          </p>
        )}
      </div>

      {terkunci && (
        <div className="mb-5 flex items-start gap-2 rounded-lg border border-btn-biru-200 bg-btn-biru-50 px-4 py-3 text-sm text-btn-biru-700">
          <svg className="h-4 w-4 mt-0.5 shrink-0" viewBox="0 0 20 20" fill="currentColor">
            <path
              fillRule="evenodd"
              d="M10 1a4.5 4.5 0 00-4.5 4.5V9H5a2 2 0 00-2 2v6a2 2 0 002 2h10a2 2 0 002-2v-6a2 2 0 00-2-2h-.5V5.5A4.5 4.5 0 0010 1zm3 8V5.5a3 3 0 10-6 0V9h6z"
              clipRule="evenodd"
            />
          </svg>
          <span>
            Penilaian ini terkunci dan tidak dapat diubah. Hubungi admin bila
            perlu koreksi.
          </span>
        </div>
      )}

      <FormPenilaian
        aksi={simpanPenilaian}
        pegawaiId={target.id}
        periodeId={periode.id}
        nilaiAwal={nilaiAwal}
        catatanUmumAwal={tersimpan?.catatanUmum ?? ''}
        sudahDikirim={Boolean(tersimpan?.dikirimAt)}
      />

      {tersimpan && (
        <div className="mt-6 kartu p-5">
          <h3 className="text-xs font-semibold text-abu-700 mb-3">Jejak penilaian</h3>
          <dl className="grid gap-3 sm:grid-cols-3 text-xs">
            <div>
              <dt className="text-abu-400">Terakhir disimpan</dt>
              <dd className="mt-0.5 font-medium text-abu-700 tabular-nums">
                {tersimpan.updatedAt.toLocaleString('id-ID')}
              </dd>
            </div>
            <div>
              <dt className="text-abu-400">Dikirim</dt>
              <dd className="mt-0.5 font-medium text-abu-700 tabular-nums">
                {tersimpan.dikirimAt?.toLocaleString('id-ID') ?? '—'}
              </dd>
            </div>
            <div>
              <dt className="text-abu-400">Status</dt>
              <dd className="mt-0.5 font-medium text-abu-700">{tersimpan.status}</dd>
            </div>
          </dl>
        </div>
      )}
    </div>
    </Kerangka>
  );
}
