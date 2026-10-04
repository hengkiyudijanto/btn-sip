import { redirect } from 'next/navigation';
import Link from 'next/link';
import { pegawaiDariSesi } from '@/lib/auth';
import { Kerangka } from '@/components/kerangka';
import { prisma } from '@/lib/db';
import { BadgeRating } from '@/components/badge-rating';
import { angkaID } from '@/lib/sip/laporan';
import { kumpulkanTurunan, susunPohon, LABEL_JENIS, type CabangRingkas } from '@/lib/sip/hierarki';
import { pilihPeriodeRelevan, daftarPeriodeUntukPemilih } from '@/lib/sip/periode-aktif';
import { boleh, bolehBukaHalaman } from '@/lib/sip/akses';

export const metadata = { title: 'Laporan' };

export default async function HalamanLaporan({
  searchParams,
}: {
  searchParams: Promise<{ periode?: string; cabang?: string }>;
}) {
  const saya = await pegawaiDariSesi();
  if (!saya) redirect('/masuk');
  if (saya.harusGantiPassword) redirect('/ubah-password');
  // Laporan memuat nilai SEMUA petugas dalam cakupan — bukan halaman pegawai.
  if (!bolehBukaHalaman(saya.role, '/laporan')) redirect('/dasbor');

  const { periode: periodeId, cabang: cabangId } = await searchParams;

  // Periode di sekitar hari ini (3 bulan ke belakang sampai 6 bulan ke
  // depan). Sebelumnya memakai orderBy desc + take 20, yang mengambil
  // 20 periode TERAKHIR di database — sejak periode otomatis dibuat
  // sampai 2027, itu berarti menampilkan Desember 2027 padahal sekarang
  // baru 2026.
  const daftarPeriode = await daftarPeriodeUntukPemilih();

  const periodeTerpilih = periodeId
    ? (daftarPeriode.find((p) => p.id === periodeId) ?? (await pilihPeriodeRelevan()))
    : await pilihPeriodeRelevan();

  const bolehLihatSemua = boleh(saya.role, 'lihat_semua_cabang');
  const semuaCabang = await prisma.cabang.findMany({ orderBy: { kode: 'asc' } });
  const daftarCabang = bolehLihatSemua ? semuaCabang.filter((c) => c.aktif) : [];

  // ===== Tentukan cakupan cabang =====
  // Opsi B: pilih satu unit -> otomatis mencakup seluruh cabang turunannya
  // (KC di bawah Kanwil, KCP di bawah KC). Tanpa pilihan -> seluruh cabang
  // yang menjadi wewenang pengguna.
  const ringkasCabang: CabangRingkas[] = semuaCabang.map((c) => ({
    id: c.id,
    kode: c.kode,
    nama: c.nama,
    jenis: c.jenis,
    indukId: c.indukId,
    aktif: c.aktif,
  }));

  const unitTerpilih = bolehLihatSemua
    ? cabangId
      ? semuaCabang.find((c) => c.id === cabangId)
      : null
    : semuaCabang.find((c) => c.id === saya.cabang.id) ?? null;

  let idCakupan: string[] | null = null;
  if (unitTerpilih) {
    idCakupan = kumpulkanTurunan(unitTerpilih.id, ringkasCabang);
  } else if (!bolehLihatSemua) {
    idCakupan = [saya.cabang.id];
  }

  const daftarTurunan = unitTerpilih
    ? ringkasCabang.filter((c) => idCakupan!.includes(c.id) && c.id !== unitTerpilih.id)
    : [];

  const penilaian = periodeTerpilih
    ? await prisma.penilaian.findMany({
        where: {
          periodeId: periodeTerpilih.id,
          ...(idCakupan ? { pegawai: { cabangId: { in: idCakupan } } } : {}),
        },
        include: {
          pegawai: {
            select: {
              nama: true,
              nip: true,
              cabang: { select: { id: true, kode: true, nama: true } },
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

        {/* ===== Info cakupan ===== */}
        <div className="mt-5 rounded-lg border border-btn-biru-200 bg-btn-biru-50 px-4 py-3">
          {unitTerpilih ? (
            <p className="text-xs leading-relaxed text-btn-biru-700">
              <strong>Cakupan laporan:</strong> {LABEL_JENIS[unitTerpilih.jenis]}{' '}
              <strong>
                {unitTerpilih.kode} — {unitTerpilih.nama}
              </strong>
              {daftarTurunan.length > 0 ? (
                <>
                  {' '}
                  beserta <strong>{daftarTurunan.length} unit turunan</strong> di bawahnya (
                  {daftarTurunan.map((c) => c.kode).join(', ')}).
                </>
              ) : (
                <> (tanpa unit turunan).</>
              )}
            </p>
          ) : (
            <p className="text-xs leading-relaxed text-btn-biru-700">
              <strong>Cakupan laporan:</strong> {bolehLihatSemua ? 'seluruh unit kerja' : `unit ${saya.cabang.nama}`}.
              Pilih unit tertentu pada filter di bawah untuk melihat cakupan yang lebih sempit
              (unit turunannya tetap ikut terhitung).
            </p>
          )}
        </div>

        {/* ===== peringatan periode tidak sesuai bulan berjalan ===== */}
        {(() => {
          if (!periodeTerpilih) return null;
          const hariIni = new Date();
          const t = new Date(hariIni.getFullYear(), hariIni.getMonth(), hariIni.getDate());
          const mulai = new Date(periodeTerpilih.tanggalMulai);
          const selesai = new Date(periodeTerpilih.tanggalSelesai);
          const berjalan = t >= mulai && t <= selesai;
          const lewat = t > selesai;
          const bulanBerbeda = mulai.getMonth() !== hariIni.getMonth() ||
            mulai.getFullYear() !== hariIni.getFullYear();

          if (berjalan) return null;

          const BULAN = ['Januari','Februari','Maret','April','Mei','Juni','Juli',
            'Agustus','September','Oktober','November','Desember'];

          return (
            <div className="mt-4 rounded-lg border border-peringatan/30 bg-peringatan-bg px-3.5 py-2.5 text-xs leading-relaxed text-peringatan">
              <strong>⚠ Perhatian.</strong>{' '}
              {lewat
                ? 'Periode yang dipilih sudah lewat'
                : 'Periode yang dipilih belum dimulai'}
              {bulanBerbeda && (
                <> — sekarang <strong>{BULAN[hariIni.getMonth()]} {hariIni.getFullYear()}</strong>,
                sedangkan periode ini <strong>{BULAN[mulai.getMonth()]} {mulai.getFullYear()}</strong></>
              )}
              . Pastikan ini periode yang ingin dilihat; kalau tidak, ubah pilihan di atas.
            </div>
          );
        })()}

        {/* ===== Filter ===== */}
        <form className="mt-6 kartu p-5" method="get">
          {/*
            Sejajar memakai GRID dengan SATU kolom = satu wadah vertikal
            (label + field + bantuan). Jangan menaruh label/field/bantuan
            sebagai baris-baris grid terpisah: sel kosong (`<span />`, atau
            label `invisible`) TETAP memakan satu slot sehingga kolom
            berikutnya bergeser turun satu baris.
          */}
          <div
            className={`grid grid-cols-1 gap-x-4 gap-y-3 items-start ${
              bolehLihatSemua && daftarCabang.length > 0 ? 'sm:grid-cols-2' : ''
            }`}
          >
            <div>
              <label htmlFor="periode" className="label-kolom block">
                Periode
              </label>
              <select
                id="periode"
                name="periode"
                defaultValue={periodeTerpilih?.id ?? ''}
                className="mt-1.5 w-full rounded-lg border border-abu-300 bg-white px-3 py-2 text-sm text-abu-800 focus:border-btn-biru-500 focus:ring-2 focus:ring-btn-biru-500/20 focus:outline-none"
              >
                {daftarPeriode.length === 0 && <option value="">Belum ada periode</option>}
                {daftarPeriode.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nama}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-[11px] text-abu-400 tabular-nums">
                {periodeTerpilih
                  ? `${periodeTerpilih.tanggalMulai.toLocaleDateString('id-ID', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })} – ${periodeTerpilih.tanggalSelesai.toLocaleDateString('id-ID', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}`
                  : '\u00a0'}
              </p>
            </div>

            {bolehLihatSemua && daftarCabang.length > 0 && (
              <div>
                <label htmlFor="cabang" className="label-kolom block">
                  Unit kerja
                </label>
                <select
                  id="cabang"
                  name="cabang"
                  defaultValue={unitTerpilih?.id ?? ''}
                  className="mt-1.5 w-full rounded-lg border border-abu-300 bg-white px-3 py-2 text-sm text-abu-800 focus:border-btn-biru-500 focus:ring-2 focus:ring-btn-biru-500/20 focus:outline-none"
                >
                  <option value="">Semua unit</option>
                  {susunPohon(
                    daftarCabang.map((c) => ({
                      id: c.id,
                      kode: c.kode,
                      nama: c.nama,
                      jenis: c.jenis,
                      indukId: c.indukId,
                      aktif: c.aktif,
                    }))
                  ).map((c) => (
                    <option key={c.id} value={c.id}>
                      {'\u00A0'.repeat(c.kedalaman * 3)}
                      {LABEL_JENIS[c.jenis]} {c.kode} — {c.nama}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-[11px] text-abu-400">&nbsp;</p>
              </div>
            )}

            <div
              className={`mt-1 flex flex-wrap items-center gap-3 ${
                bolehLihatSemua && daftarCabang.length > 0 ? 'sm:col-span-2' : ''
              }`}
            >
              <button
                type="submit"
                className="rounded-lg bg-btn-biru-600 px-4 py-2 text-sm font-semibold text-white hover:bg-btn-biru-700 transition-colors"
              >
                Tampilkan
              </button>

              {/* unduh rekap memakai filter yang sedang aktif */}
              <a
                href={`/laporan/ekspor?${new URLSearchParams({
                  ...(periodeTerpilih ? { periode: periodeTerpilih.id } : {}),
                  ...(unitTerpilih ? { cabang: unitTerpilih.id } : {}),
                }).toString()}`}
                className="inline-flex items-center gap-1.5 rounded-lg border border-abu-300 bg-white px-4 py-2 text-sm font-medium text-abu-700 hover:bg-abu-50 transition-colors"
                title="Unduh rekap periode dan cakupan ini sebagai berkas Excel/CSV"
              >
                <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M10.75 2.75a.75.75 0 00-1.5 0v8.614L6.295 8.235a.75.75 0 10-1.09 1.03l4.25 4.5a.75.75 0 001.09 0l4.25-4.5a.75.75 0 00-1.09-1.03l-2.955 3.129V2.75z" />
                  <path d="M3.5 12.75a.75.75 0 00-1.5 0v2.5A2.75 2.75 0 004.75 18h10.5A2.75 2.75 0 0018 15.25v-2.5a.75.75 0 00-1.5 0v2.5c0 .69-.56 1.25-1.25 1.25H4.75c-.69 0-1.25-.56-1.25-1.25v-2.5z" />
                </svg>
                Unduh Excel
              </a>
            </div>
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
