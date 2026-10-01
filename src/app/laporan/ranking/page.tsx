import { redirect } from 'next/navigation';
import Link from 'next/link';
import { pegawaiDariSesi } from '@/lib/auth';
import { Kerangka } from '@/components/kerangka';
import {
  periodeUntukRanking,
  jabatanUntukRanking,
  cabangUntukRanking,
  susunRanking,
} from '@/lib/sip/ranking';
import { pilihPeriodeRelevan } from '@/lib/sip/periode-aktif';

export const metadata = { title: 'Laporan Ranking' };

const JENIS = [
  { nilai: '', label: 'Semua jenis kantor' },
  { nilai: 'KANWIL', label: 'Kantor Wilayah (Kanwil)' },
  { nilai: 'KC', label: 'Kantor Cabang (KC)' },
  { nilai: 'KCP', label: 'Kantor Cabang Pembantu (KCP)' },
] as const;

export default async function HalamanRanking({
  searchParams,
}: {
  searchParams: Promise<{ periode?: string; jenis?: string; cabang?: string; posisi?: string }>;
}) {
  const saya = await pegawaiDariSesi();
  if (!saya) redirect('/masuk');
  if (saya.harusGantiPassword) redirect('/ubah-password');

  const sp = await searchParams;

  const [daftarPeriode, daftarJabatan, daftarCabang] = await Promise.all([
    periodeUntukRanking(),
    jabatanUntukRanking(),
    cabangUntukRanking(),
  ]);

  // periode default: yang relevan hari ini kalau ada penilaian, kalau tidak
  // pakai yang terbaru yang punya penilaian
  const relevan = await pilihPeriodeRelevan();
  const periodeTerpilih =
    sp.periode ??
    daftarPeriode.find((p) => p.id === relevan?.id)?.id ??
    daftarPeriode[0]?.id ??
    '';

  const adaFilter = Boolean(periodeTerpilih);

  const hasil = adaFilter
    ? await susunRanking({
        periodeId: periodeTerpilih,
        jenis: (sp.jenis as 'KANWIL' | 'KC' | 'KCP' | undefined) || null,
        kodeCabang: sp.cabang || null,
        kodeJabatan: sp.posisi || null,
      })
    : null;

  // parameter unduhan PPTX (dibawa apa adanya)
  const kueri = new URLSearchParams();
  if (periodeTerpilih) kueri.set('periode', periodeTerpilih);
  if (sp.jenis) kueri.set('jenis', sp.jenis);
  if (sp.cabang) kueri.set('cabang', sp.cabang);
  if (sp.posisi) kueri.set('posisi', sp.posisi);

  return (
    <Kerangka pegawai={saya}>
      <div className="mx-auto max-w-6xl px-4 sm:px-6 py-8">
        <div className="animasi-naik">
          <h1 className="text-2xl font-bold text-abu-900">Laporan Ranking</h1>
          <div className="mt-2 h-0.5 w-10 bg-btn-merah-500 rounded-full" />
          <p className="mt-3 text-sm text-abu-500">
            Peringkat petugas berdasarkan nilai akhir, disiapkan sebagai slide
            presentasi (PPTX) seperti format Service Drill Ranking.
          </p>
        </div>

        {/* ===== filter ===== */}
        <form className="mt-6 kartu p-5" method="get">
          <h2 className="text-sm font-semibold text-abu-800 mb-4">
            Filter laporan
          </h2>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <label className="block">
              <span className="block text-[11px] font-medium text-abu-600 mb-1">
                Periode penilaian
              </span>
              <select
                name="periode"
                defaultValue={periodeTerpilih}
                className="w-full rounded-lg border border-abu-300 px-3 py-2 text-sm focus:border-btn-biru-500 focus:outline-none"
              >
                {daftarPeriode.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nama}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="block text-[11px] font-medium text-abu-600 mb-1">
                Jenis kantor
              </span>
              <select
                name="jenis"
                defaultValue={sp.jenis ?? ''}
                className="w-full rounded-lg border border-abu-300 px-3 py-2 text-sm focus:border-btn-biru-500 focus:outline-none"
              >
                {JENIS.map((j) => (
                  <option key={j.nilai} value={j.nilai}>
                    {j.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="block text-[11px] font-medium text-abu-600 mb-1">
                Unit / cabang
              </span>
              <select
                name="cabang"
                defaultValue={sp.cabang ?? ''}
                className="w-full rounded-lg border border-abu-300 px-3 py-2 text-sm focus:border-btn-biru-500 focus:outline-none"
              >
                <option value="">Semua unit</option>
                {daftarCabang.map((c) => (
                  <option key={c.kode} value={c.kode}>
                    {c.kode} — {c.nama}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="block text-[11px] font-medium text-abu-600 mb-1">
                Posisi yang dinilai
              </span>
              <select
                name="posisi"
                defaultValue={sp.posisi ?? ''}
                className="w-full rounded-lg border border-abu-300 px-3 py-2 text-sm focus:border-btn-biru-500 focus:outline-none"
              >
                <option value="">Semua posisi</option>
                {daftarJabatan.map((j) => (
                  <option key={j.kode} value={j.kode}>
                    {j.nama}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              type="submit"
              className="rounded-lg bg-btn-biru-600 px-4 py-2 text-xs font-semibold text-white hover:bg-btn-biru-700 transition-colors"
            >
              Tampilkan
            </button>
            <Link
              href="/laporan/ranking"
              className="rounded-lg border border-abu-300 px-4 py-2 text-xs font-medium text-abu-700 hover:bg-abu-50 transition-colors"
            >
              Reset filter
            </Link>

            {hasil && hasil.jumlahPeserta > 0 && (
              <a
                href={`/laporan/ranking/pptx?${kueri.toString()}`}
                className="ml-auto inline-flex items-center gap-2 rounded-lg bg-btn-merah-600 px-4 py-2 text-xs font-semibold text-white hover:bg-btn-merah-700 transition-colors"
              >
                ⬇ Unduh laporan PPTX
              </a>
            )}
          </div>
        </form>

        {/* ===== pratinjau hasil ===== */}
        {!hasil && (
          <div className="mt-6 kartu p-8 text-center text-sm text-abu-400">
            Belum ada periode yang punya penilaian. Isi penilaian dulu.
          </div>
        )}

        {hasil && hasil.jumlahPeserta === 0 && (
          <div className="mt-6 kartu p-8 text-center">
            <p className="text-sm text-abu-600 font-medium">
              Tidak ada penilaian yang cocok dengan filter ini.
            </p>
            <p className="mt-2 text-xs text-abu-400 leading-relaxed">
              Coba ubah periode, longgarkan jenis kantor, atau kosongkan
              posisi. Hasil hanya memuat penilaian yang sudah punya nilai akhir.
            </p>
          </div>
        )}

        {hasil && hasil.jumlahPeserta > 0 && (
          <>
            <div className="mt-6 rounded-lg border border-abu-200 bg-abu-50 px-4 py-3 text-xs text-abu-600 leading-relaxed">
              <strong>{hasil.jumlahPeserta} petugas</strong> dengan penilaian
              bernilai pada <strong>{hasil.periode}</strong> &middot;{' '}
              {hasil.unit} &middot; {hasil.posisi} &middot; akan menjadi{' '}
              <strong>{hasil.kelompok.length} slide</strong> ranking.
            </div>

            <div className="mt-6 space-y-6">
              {hasil.kelompok.map((k) => (
                <div key={`${k.unit}|${k.posisi}`} className="kartu overflow-hidden">
                  <div className="border-b border-abu-200 bg-abu-50 px-4 py-3">
                    <div className="text-sm font-semibold text-abu-900">{k.unit}</div>
                    <div className="text-xs text-abu-500">{k.posisi}</div>
                  </div>
                  <div className="overflow-x-auto">
                    {/*
                      Lebar kolom ditetapkan lewat colgroup, bukan diserahkan
                      ke peramban. Tanpa ini, setiap tabel menghitung lebarnya
                      sendiri sesuai isinya — jadi tabel Customer Service
                      (1 baris) dan Teller Service (2 baris) punya posisi awal
                      kolom yang berbeda. Sudah dibuktikan di laporan cetak
                      bahwa cara ini yang paling andal.
                    */}
                    <table className="tabel-sip tabel-lebar-tetap">
                      <colgroup>
                        <col style={{ width: '12%' }} />
                        <col style={{ width: '30%' }} />
                        <col style={{ width: '18%' }} />
                        <col style={{ width: '18%' }} />
                        <col style={{ width: '22%' }} />
                      </colgroup>
                      <thead>
                        <tr>
                          <th className="text-right">Peringkat</th>
                          <th>Petugas</th>
                          <th>NIP</th>
                          <th className="text-right">Nilai akhir</th>
                          <th>Kategori</th>
                        </tr>
                      </thead>
                      <tbody>
                        {k.baris.map((b, i) => (
                          <tr key={b.nip}>
                            <td className="text-right tabular-nums text-sm font-semibold text-abu-700">
                              {i + 1}
                            </td>
                            <td className="text-sm font-medium text-abu-900">{b.nama}</td>
                            <td className="text-xs text-abu-600 tabular-nums">{b.nip}</td>
                            <td className="text-right tabular-nums text-sm font-semibold text-abu-900">
                              {b.nilai.toFixed(2).replace('.', ',')}
                            </td>
                            <td>
                              <span
                                className="inline-block rounded-full px-2.5 py-1 text-[11px] font-medium text-white"
                                style={{
                                  background:
                                    b.kategori === 'Istimewa' ? '#00b050'
                                    : b.kategori === 'Sangat Baik' ? '#66bb6a'
                                    : b.kategori === 'Baik' ? '#f57c00'
                                    : b.kategori === 'Cukup' ? '#ffc107'
                                    : '#e51b2b',
                                }}
                              >
                                {b.kategori}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>

            <p className="mt-6 text-[11px] text-abu-400 leading-relaxed">
              Slide PPTX memuat foto petugas dari penilaian periode ini. Kalau
              foto belum diunggah, kotak fotonya dibiarkan kosong agar bisa
              ditempel manual.
            </p>
          </>
        )}
      </div>
    </Kerangka>
  );
}
