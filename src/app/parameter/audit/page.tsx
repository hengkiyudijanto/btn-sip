import Link from 'next/link';
import { redirect } from 'next/navigation';
import { pegawaiDariSesi } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { Kerangka } from '@/components/kerangka';
import { DetailAudit } from '@/components/detail-audit';
import {
  infoAksi,
  ringkasAudit,
  KELOMPOK_AUDIT,
  INFO_AKSI,
  type KelompokAudit,
} from '@/lib/sip/audit';
import { boleh } from '@/lib/sip/akses';

export const metadata = { title: 'Audit Log' };

/** Jumlah baris per halaman. Riwayat audit tumbuh terus — jangan render semuanya. */
const PER_HALAMAN = 50;

const LABEL_ROLE: Record<string, string> = {
  PEGAWAI: 'Pegawai',
  SUPERVISOR: 'Supervisor',
  MANAGER: 'Manager',
  ADMIN: 'Admin',
};

export default async function HalamanAudit({
  searchParams,
}: {
  searchParams: Promise<{
    aksi?: string;
    pegawai?: string;
    dari?: string;
    sampai?: string;
    halaman?: string;
  }>;
}) {
  const saya = await pegawaiDariSesi();
  if (!saya) redirect('/masuk');
  if (saya.harusGantiPassword) redirect('/ubah-password');
  // Audit log memuat IP, jejak login, dan riwayat perubahan nilai — admin saja.
  if (!boleh(saya.role, 'lihat_audit')) redirect('/dasbor');

  const sp = await searchParams;
  const aksiFilter = sp.aksi?.trim() || '';
  const pegawaiFilter = sp.pegawai?.trim() || '';
  const dari = sp.dari?.trim() || '';
  const sampai = sp.sampai?.trim() || '';
  const halaman = Math.max(1, Number(sp.halaman) || 1);

  // ===== bangun filter =====
  const where: Record<string, unknown> = {};
  if (aksiFilter) where.aksi = aksiFilter;
  if (pegawaiFilter) {
    where.pegawai = {
      OR: [
        { nama: { contains: pegawaiFilter, mode: 'insensitive' } },
        { nip: { contains: pegawaiFilter, mode: 'insensitive' } },
      ],
    };
  }
  if (dari || sampai) {
    const rentang: Record<string, Date> = {};
    // tanggal diketik sebagai YYYY-MM-DD; akhir hari inklusif
    if (dari) rentang.gte = new Date(`${dari}T00:00:00`);
    if (sampai) rentang.lte = new Date(`${sampai}T23:59:59.999`);
    where.createdAt = rentang;
  }

  const [total, baris, daftarAksi] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({
      where,
      include: {
        pegawai: {
          select: { nama: true, nip: true, role: true, cabang: { select: { kode: true } } },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip: (halaman - 1) * PER_HALAMAN,
      take: PER_HALAMAN,
    }),
    // daftar aksi yang benar-benar ada di database, bukan hanya yang dikenal
    // modul — supaya aksi lama/asing tetap bisa difilter.
    prisma.auditLog.groupBy({ by: ['aksi'], _count: { _all: true } }),
  ]);

  const jumlahHalaman = Math.max(1, Math.ceil(total / PER_HALAMAN));

  // urutkan daftar aksi menurut label yang terbaca, bukan menurut string kode
  const opsiAksi = daftarAksi
    .map((a) => ({
      aksi: a.aksi,
      label: infoAksi(a.aksi).label,
      kelompok: infoAksi(a.aksi).kelompok,
      jumlah: a._count._all,
    }))
    .sort((a, b) => a.label.localeCompare(b.label, 'id'));

  const rekapKelompok = new Map<KelompokAudit, number>();
  for (const a of opsiAksi) {
    rekapKelompok.set(a.kelompok, (rekapKelompok.get(a.kelompok) ?? 0) + a.jumlah);
  }
  const daftarKelompok = [...rekapKelompok.entries()].sort((a, b) => b[1] - a[1]);

  /** QS untuk tautan filter yang mempertahankan isian lain. */
  function qs(ubah: Record<string, string | number | undefined>): string {
    const p = new URLSearchParams();
    const nilai: Record<string, string | number | undefined> = {
      aksi: aksiFilter || undefined,
      pegawai: pegawaiFilter || undefined,
      dari: dari || undefined,
      sampai: sampai || undefined,
      halaman: halaman > 1 ? halaman : undefined,
      ...ubah,
    };
    for (const [k, v] of Object.entries(nilai)) {
      if (v !== undefined && v !== '' && v !== null) p.set(k, String(v));
    }
    const s = p.toString();
    return s ? `?${s}` : '';
  }

  const adaFilter = Boolean(aksiFilter || pegawaiFilter || dari || sampai);

  return (
    <Kerangka pegawai={saya}>
      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-8">
        <div className="animasi-naik">
          <h1 className="text-2xl font-bold text-abu-900">Audit Log</h1>
          <div className="mt-2 h-0.5 w-10 bg-btn-merah-500 rounded-full" />
          <p className="mt-3 text-sm text-abu-500">
            Riwayat perubahan data aplikasi — siapa, kapan, dari nilai berapa ke berapa.
            Perubahan penilaian menyimpan nilai lama supaya pertanyaan &ldquo;dari berapa
            ke berapa&rdquo; bisa dijawab.
          </p>
        </div>

        {/* ===== ringkasan kelompok ===== */}
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="kartu p-4">
            <div className="label-kolom">Total catatan</div>
            <div className="mt-1 text-xl font-bold text-abu-900 tabular-nums">
              {total.toLocaleString('id-ID')}
            </div>
            <div className="mt-0.5 text-xs text-abu-400">sesuai filter aktif</div>
          </div>
          {daftarKelompok.slice(0, 3).map(([kel, jumlah]) => (
            <div key={kel} className="kartu p-4">
              <div className="label-kolom">{KELOMPOK_AUDIT[kel].label}</div>
              <div className="mt-1 text-xl font-bold text-abu-900 tabular-nums">
                {jumlah.toLocaleString('id-ID')}
              </div>
              <div className="mt-0.5 text-xs text-abu-400">catatan</div>
            </div>
          ))}
        </div>

        {/* ===== filter ===== */}
        <form method="get" className="mt-6 kartu p-5">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <label className="block">
              <span className="label-kolom">Jenis aksi</span>
              <select
                name="aksi"
                defaultValue={aksiFilter}
                className="mt-1.5 w-full rounded-md border border-abu-300 bg-white px-3 py-2 text-sm text-abu-800"
              >
                <option value="">Semua aksi ({opsiAksi.length} jenis)</option>
                {opsiAksi.map((a) => (
                  <option key={a.aksi} value={a.aksi}>
                    {a.label} ({a.jumlah})
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="label-kolom">Pelaku</span>
              <input
                type="text"
                name="pegawai"
                defaultValue={pegawaiFilter}
                placeholder="Nama atau NIP"
                className="mt-1.5 w-full rounded-md border border-abu-300 bg-white px-3 py-2 text-sm text-abu-800"
              />
            </label>
            <label className="block">
              <span className="label-kolom">Dari tanggal</span>
              <input
                type="date"
                name="dari"
                defaultValue={dari}
                className="mt-1.5 w-full rounded-md border border-abu-300 bg-white px-3 py-2 text-sm text-abu-800"
              />
            </label>
            <label className="block">
              <span className="label-kolom">Sampai tanggal</span>
              <input
                type="date"
                name="sampai"
                defaultValue={sampai}
                className="mt-1.5 w-full rounded-md border border-abu-300 bg-white px-3 py-2 text-sm text-abu-800"
              />
            </label>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              type="submit"
              className="rounded-md bg-btn-biru-700 px-4 py-2 text-sm font-medium text-white hover:bg-btn-biru-800 transition-colors"
            >
              Terapkan filter
            </button>
            {adaFilter && (
              <Link
                href="/parameter/audit"
                className="rounded-md border border-abu-300 px-4 py-2 text-sm font-medium text-abu-700 hover:bg-abu-50 transition-colors"
              >
                Bersihkan filter
              </Link>
            )}
            <span className="text-xs text-abu-400">
              {total.toLocaleString('id-ID')} catatan · halaman {halaman} dari {jumlahHalaman}
            </span>
          </div>
        </form>

        {/* ===== tabel ===== */}
        <div className="mt-6 kartu overflow-hidden">
          <div className="overflow-x-auto">
            <table className="tabel-sip">
              <thead>
                <tr>
                  <th className="whitespace-nowrap">Waktu</th>
                  <th>Pelaku</th>
                  <th>Jenis aksi</th>
                  <th>Ringkasan</th>
                  <th className="whitespace-nowrap">Sumber</th>
                  <th className="text-right">Data</th>
                </tr>
              </thead>
              <tbody>
                {baris.length === 0 && (
                  <tr>
                    <td colSpan={6} className="text-center py-10 text-sm text-abu-400">
                      Tidak ada catatan audit untuk filter ini.
                    </td>
                  </tr>
                )}
                {baris.map((b) => {
                  const info = infoAksi(b.aksi);
                  const kel = KELOMPOK_AUDIT[info.kelompok];
                  const ringkas = ringkasAudit(b.aksi, b.dataLama, b.dataBaru);
                  return (
                    <tr key={b.id}>
                      <td className="whitespace-nowrap tabular-nums text-abu-600 text-xs align-top">
                        {b.createdAt.toLocaleString('id-ID', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                        })}
                        <div className="text-abu-400">
                          {b.createdAt.toLocaleTimeString('id-ID', {
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit',
                          })}
                        </div>
                      </td>
                      <td className="text-xs align-top">
                        {b.pegawai ? (
                          <>
                            <div className="font-medium text-abu-900">{b.pegawai.nama}</div>
                            <div className="text-abu-400 tabular-nums">
                              {b.pegawai.nip} · {LABEL_ROLE[b.pegawai.role] ?? b.pegawai.role}
                              {b.pegawai.cabang ? ` · ${b.pegawai.cabang.kode}` : ''}
                            </div>
                          </>
                        ) : (
                          <span className="text-abu-400">— (tanpa akun)</span>
                        )}
                      </td>
                      <td className="align-top">
                        <span
                          className={`inline-block rounded-full px-2.5 py-1 text-[11px] font-medium ${
                            info.gagal ? 'bg-bahaya-bg text-bahaya' : kel.kelas
                          }`}
                          title={b.aksi}
                        >
                          {info.label}
                        </span>
                      </td>
                      <td className="text-xs text-abu-600 align-top">
                        {ringkas ?? <span className="text-abu-400">Lihat data</span>}
                      </td>
                      <td className="text-[11px] text-abu-400 align-top whitespace-nowrap">
                        {b.ip ?? '—'}
                        {b.userAgent && (
                          <div className="max-w-[160px] truncate" title={b.userAgent}>
                            {b.userAgent}
                          </div>
                        )}
                      </td>
                      <td className="text-right align-top">
                        <DetailAudit
                          aksi={b.aksi}
                          label={info.label}
                          waktu={b.createdAt.toLocaleString('id-ID')}
                          dataLama={b.dataLama}
                          dataBaru={b.dataBaru}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* ===== pager ===== */}
        {jumlahHalaman > 1 && (
          <div className="mt-4 flex items-center justify-between gap-3">
            {halaman > 1 ? (
              <Link
                href={`/parameter/audit${qs({ halaman: halaman - 1 })}`}
                className="rounded-md border border-abu-300 px-4 py-2 text-sm font-medium text-abu-700 hover:bg-abu-50"
              >
                ← Sebelumnya
              </Link>
            ) : (
              <span />
            )}
            <span className="text-xs text-abu-500 tabular-nums">
              {((halaman - 1) * PER_HALAMAN + 1).toLocaleString('id-ID')}–
              {Math.min(halaman * PER_HALAMAN, total).toLocaleString('id-ID')} dari{' '}
              {total.toLocaleString('id-ID')}
            </span>
            {halaman < jumlahHalaman ? (
              <Link
                href={`/parameter/audit${qs({ halaman: halaman + 1 })}`}
                className="rounded-md border border-abu-300 px-4 py-2 text-sm font-medium text-abu-700 hover:bg-abu-50"
              >
                Berikutnya →
              </Link>
            ) : (
              <span />
            )}
          </div>
        )}

        <p className="mt-6 text-xs text-abu-400">
          {Object.keys(INFO_AKSI).length} jenis aksi dikenal aplikasi. Aksi yang belum
          berlabel tetap ditampilkan dengan namanya sendiri — tidak disembunyikan.
        </p>
      </div>
    </Kerangka>
  );
}
