import { redirect } from 'next/navigation';
import { pegawaiDariSesi } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { BadgeRating } from '@/components/badge-rating';
import { Kerangka } from '@/components/kerangka';
import { pilihPeriodeRelevan, daftarPeriodeUntukPemilih } from '@/lib/sip/periode-aktif';
import { ambilPengingat } from '@/lib/sip/pengingat';
import { PanelPengingat } from '@/components/panel-pengingat';
import { PemilihPeriode } from '@/components/pemilih-periode';
import Link from 'next/link';
import { boleh } from '@/lib/sip/akses';

export const metadata = { title: 'Daftar Penilaian' };

const LABEL_STATUS: Record<string, { teks: string; kelas: string }> = {
  DRAFT: { teks: 'Draft', kelas: 'bg-abu-100 text-abu-600' },
  DIKIRIM: { teks: 'Menunggu diketahui', kelas: 'bg-peringatan-bg text-peringatan' },
  DIKETAHUI: { teks: 'Sudah diketahui', kelas: 'bg-btn-biru-100 text-btn-biru-700' },
  FINAL: { teks: 'Final', kelas: 'bg-sukses-bg text-sukses' },
};

const BOLEH_MENILAI = new Set(['SUPERVISOR', 'MANAGER', 'ADMIN']);

export default async function HalamanPenilaian({
  searchParams,
}: {
  searchParams: Promise<{ periode?: string }>;
}) {
  const saya = await pegawaiDariSesi();
  if (!saya) redirect('/masuk');
  if (saya.harusGantiPassword) redirect('/ubah-password');
  if (!boleh(saya.role, 'menilai')) redirect('/dasbor');

  const bolehMenilai = BOLEH_MENILAI.has(saya.role);

  // periode boleh dipilih lewat ?periode=<id>; kalau tidak ada, pakai
  // periode yang memuat hari ini
  const { periode: periodeParam } = await searchParams;
  const periode = periodeParam
    ? (await prisma.periode.findUnique({ where: { id: periodeParam } })) ??
      (await pilihPeriodeRelevan())
    : await pilihPeriodeRelevan();

  const daftarPeriode = bolehMenilai ? await daftarPeriodeUntukPemilih() : [];

  // Kalau belum ada periode sama sekali, tampilkan pesan
  if (!periode) {
    return (
      <Kerangka pegawai={saya}>
      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-8">
        <Kepala
          judul="Penilaian"
          deskripsi="Belum ada periode penilaian aktif."
        />
        <div className="mt-6 kartu p-8 text-center">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-peringatan-bg mb-4">
            <svg className="h-6 w-6 text-peringatan" viewBox="0 0 20 20" fill="currentColor">
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zm.75-13a.75.75 0 00-1.5 0v5c0 .414.336.75.75.75h4a.75.75 0 000-1.5h-3.25V5z"
                clipRule="evenodd"
              />
            </svg>
          </div>
          <h3 className="text-sm font-semibold text-abu-800">Belum ada periode penilaian</h3>
          <p className="mt-2 text-sm text-abu-500 max-w-md mx-auto">
            Admin perlu membuat periode penilaian mingguan terlebih dahulu
            sebelum penilaian dapat dilakukan.
          </p>
        </div>
      </div>
      </Kerangka>
    );
  }

  // Daftar petugas yang bisa dinilai (satu cabang dengan penilai, kecuali admin)
  const daftarPegawai = await prisma.pegawai.findMany({
    where: {
      aktif: true,
      role: 'PEGAWAI',
      ...(saya.role === 'ADMIN' ? {} : { cabangId: saya.cabang.id }),
    },
    include: {
      jabatan: true,
      cabang: { select: { kode: true, nama: true } },
      penilaianku: { where: { periodeId: periode.id } },
    },
    orderBy: [{ cabang: { kode: 'asc' } }, { nama: 'asc' }],
  });

  const sudahDinilai = daftarPegawai.filter((p) => p.penilaianku.length > 0).length;

  // Pengingat hanya tentang periode yang sedang dibuka — kalau atasan sedang
  // melihat periode arsip, jangan munculkan peringatan tentang periode lain.
  const pengingat = await ambilPengingat(saya);

  return (
    <Kerangka pegawai={saya}>
    <div className="mx-auto max-w-7xl px-4 sm:px-6 py-8">
      <Kepala
        judul="Penilaian"
        deskripsi={
          bolehMenilai
            ? `${periode.nama} · ${sudahDinilai} dari ${daftarPegawai.length} petugas sudah dinilai`
            : `${periode.nama} · Anda dapat melihat hasil penilaian`
        }
      />

      {/* ===== pengingat periode ===== */}
      {pengingat.periode?.id === periode.id && <PanelPengingat ringkasan={pengingat} />}

      {/* ===== pemilih periode ===== */}
      {bolehMenilai && daftarPeriode.length > 0 && (
        <div className="mt-6">
          <PemilihPeriode
            daftar={daftarPeriode.map((p) => ({
              id: p.id,
              nama: p.nama,
              aktif: p.aktif,
              tanggalMulai: p.tanggalMulai,
              tanggalSelesai: p.tanggalSelesai,
            }))}
            terpilihId={periode.id}
            dikunci={periode.dikunci}
          />
        </div>
      )}

      {/* Kartu info periode */}
      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <div className="kartu p-5">
          <div className="label-kolom">Periode</div>
          <div className="mt-1.5 text-base font-semibold text-abu-900">{periode.nama}</div>
          <div className="mt-0.5 text-xs text-abu-400 tabular-nums">
            {periode.tanggalMulai.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
            {' – '}
            {periode.tanggalSelesai.toLocaleDateString('id-ID', {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
            })}
          </div>
        </div>
        <div className="kartu p-5">
          <div className="label-kolom">Petugas</div>
          <div className="mt-1.5 text-base font-semibold text-abu-900">
            {daftarPegawai.length} orang
          </div>
          <div className="mt-0.5 text-xs text-abu-400">
            {saya.role === 'ADMIN' ? 'Semua cabang' : saya.cabang.nama}
          </div>
        </div>
        <div className="kartu p-5">
          <div className="label-kolom">Sudah dinilai</div>
          <div className="mt-1.5 text-base font-semibold text-abu-900">
            {sudahDinilai} orang
          </div>
          <div className="mt-0.5 text-xs text-abu-400">
            {sisaText(daftarPegawai.length - sudahDinilai)}
          </div>
        </div>
      </div>

      {/* Daftar petugas */}
      <div className="mt-6 kartu overflow-hidden">
        <div className="overflow-x-auto">
          <table className="tabel-sip">
            <thead>
              <tr>
                <th>NIP</th>
                <th>Nama</th>
                <th>Jabatan</th>
                <th>Cabang</th>
                <th>Status</th>
                <th className="text-right">Nilai</th>
                <th className="text-right">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {daftarPegawai.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center py-10 text-sm text-abu-400">
                    Belum ada petugas terdaftar. Admin dapat menambahkan pegawai
                    melalui menu Pengelolaan Pegawai.
                  </td>
                </tr>
              )}
              {daftarPegawai.map((p) => {
                const penilaian = p.penilaianku[0];
                const status = penilaian ? LABEL_STATUS[penilaian.status] : null;
                return (
                  <tr key={p.id}>
                    <td className="tabular-nums text-abu-600 text-xs">{p.nip}</td>
                    <td className="font-medium text-abu-900">{p.nama}</td>
                    <td className="text-abu-600 text-xs">{p.jabatan?.nama ?? '—'}</td>
                    <td className="text-abu-600 text-xs">
                      {p.cabang.kode} — {p.cabang.nama}
                    </td>
                    <td>
                      {status ? (
                        <span
                          className={`inline-block rounded-full px-2.5 py-1 text-[11px] font-medium ${status.kelas}`}
                        >
                          {status.teks}
                        </span>
                      ) : (
                        <span className="inline-block rounded-full bg-abu-100 px-2.5 py-1 text-[11px] text-abu-500">
                          Belum dinilai
                        </span>
                      )}
                    </td>
                    <td className="text-right">
                      {penilaian?.nilaiAkhir != null ? (
                        <BadgeRating
                          rating={penilaian.rating ?? 'Baik'}
                          nilai={penilaian.nilaiAkhir}
                          ukuran="kecil"
                        />
                      ) : (
                        <span className="text-abu-300 text-sm">—</span>
                      )}
                    </td>
                    <td className="text-right">
                      {bolehMenilai && !periode.dikunci ? (
                        <Link
                          href={`/penilaian/${p.id}?periode=${periode.id}`}
                          className={`inline-flex items-center gap-1 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${
                            penilaian
                              ? 'border-abu-300 bg-white text-abu-700 hover:bg-abu-50'
                              : 'border-btn-biru-200 bg-btn-biru-50 text-btn-biru-700 hover:bg-btn-biru-100'
                          }`}
                          title={
                            penilaian
                              ? 'Ubah penilaian yang sudah ada'
                              : 'Isi penilaian baru'
                          }
                        >
                          {penilaian ? 'Ubah' : 'Nilai'}
                        </Link>
                      ) : periode.dikunci ? (
                        <span className="text-abu-400 text-xs" title="Periode terkunci">
                          🔒
                        </span>
                      ) : (
                        <span className="text-abu-300 text-xs">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
    </Kerangka>
  );
}

function sisaText(n: number): string {
  if (n <= 0) return 'Semua petugas sudah dinilai';
  return `${n} petugas belum dinilai`;
}

function Kepala({ judul, deskripsi }: { judul: string; deskripsi: string }) {
  return (
    <div className="animasi-naik">
      <h1 className="text-2xl font-bold text-abu-900">{judul}</h1>
      <div className="mt-2 h-0.5 w-10 bg-btn-merah-500 rounded-full" />
      <p className="mt-3 text-sm text-abu-500">{deskripsi}</p>
    </div>
  );
}
