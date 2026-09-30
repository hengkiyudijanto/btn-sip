import { redirect } from 'next/navigation';
import { pegawaiDariSesi } from '@/lib/auth';
import { Kerangka } from '@/components/kerangka';
import { prisma } from '@/lib/db';
import { PanelBuatPeriode, AksiPeriode } from '@/components/kelola-periode';
import { rentangPeriode } from '@/lib/sip/laporan';
import {
  ambilPengaturan,
  pastikanPeriodeTahun,
  pastikanPeriodeBulan,
} from '@/lib/sip/pengaturan';
import { NAMA_HARI, MIN_HARI_PERIODE } from '@/lib/sip/periode';
import { PanelHariPenilaian } from '@/components/panel-hari-penilaian';

export const metadata = { title: 'Periode' };

export default async function HalamanPeriode() {
  const saya = await pegawaiDariSesi();
  if (!saya) redirect('/masuk');
  if (saya.harusGantiPassword) redirect('/ubah-password');
  if (saya.role !== 'ADMIN') redirect('/dasbor');

  // ===== buat periode otomatis =====
  // Periode dihitung mesin periode (src/lib/sip/periode.ts), tidak lagi
  // dibuat manual. Yang sudah ada tidak diganggu.
  const tahunIni = new Date().getFullYear();
  const hasilTahun = await pastikanPeriodeTahun(tahunIni);
  const hasilBulan = await pastikanPeriodeBulan(new Date());
  const pengaturan = await ambilPengaturan();

  const dibuatBaru = hasilTahun.dibuat + hasilBulan.dibuat;

  const filterTahun = process.env.TAHUN_PERIODE
    ? Number(process.env.TAHUN_PERIODE)
    : tahunIni;

  const daftar = await prisma.periode.findMany({
    where: {
      tanggalMulai: {
        gte: new Date(filterTahun, 0, 1),
        lte: new Date(filterTahun, 11, 31, 23, 59, 59),
      },
    },
    orderBy: { tanggalMulai: 'asc' },
    include: { _count: { select: { penilaian: true } } },
  });

  const hariIni = new Date();
  const totalPeriodeTahun = daftar.length;

  return (
    <Kerangka pegawai={saya}>
      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-8">
        <div className="animasi-naik">
          <h1 className="text-2xl font-bold text-abu-900">Periode Penilaian</h1>
          <div className="mt-2 h-0.5 w-10 bg-btn-merah-500 rounded-full" />
          <p className="mt-3 text-sm text-abu-500">
            {totalPeriodeTahun} periode sepanjang {filterTahun} &middot; dibuat
            otomatis dari aturan periode
            {dibuatBaru > 0 && (
              <span className="ml-2 rounded-full bg-sukses-bg px-2 py-0.5 text-[11px] font-medium text-sukses">
                +{dibuatBaru} baru dibuat
              </span>
            )}
          </p>
        </div>

        {/* ===== pengaturan hari penilaian ===== */}
        <div className="mt-6">
          <PanelHariPenilaian
            hariPenilaian={pengaturan.hariPenilaian}
            jumlahPeriode={totalPeriodeTahun}
          />
        </div>

      <div className="mt-6">
        {dibuatBaru > 0 ? (
          <div className="rounded-lg border border-sukses/30 bg-sukses-bg px-4 py-3 text-xs text-sukses leading-relaxed">
            <strong>{dibuatBaru} periode baru dibuat otomatis</strong> untuk bulan
            yang belum punya periode. Periode dihitung dari aturan resmi
            (mulai tanggal 1, berakhir hari Minggu), jadi tidak perlu dibuat
            manual lagi.
          </div>
        ) : (
          <div className="rounded-lg border border-abu-200 bg-abu-50 px-4 py-3 text-xs text-abu-500 leading-relaxed">
            Periode dibuat <strong>otomatis</strong> dari aturan resmi: mulai
            tanggal 1, berakhir hari Minggu, tidak menyeberang bulan. Semua
            periode sampai akhir tahun ini sudah tersedia.
            <details className="mt-2">
              <summary className="cursor-pointer font-medium text-btn-biru-600 hover:underline">
                Buat periode di luar jadwal otomatis
              </summary>
              <div className="mt-3">
                <PanelBuatPeriode />
              </div>
            </details>
          </div>
        )}
      </div>

        <div className="mt-6 kartu overflow-hidden">
          <div className="overflow-x-auto">
            <table className="tabel-sip">
              <thead>
                <tr>
                  <th>Nama periode</th>
                  <th>Tanggal</th>
                  <th className="text-right">Hari</th>
                  <th className="text-right">Penilaian</th>
                  <th>Status</th>
                  <th className="text-right">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {daftar.length === 0 && (
                  <tr>
                    <td colSpan={6} className="text-center py-10 text-sm text-abu-400">
                      Belum ada periode untuk {filterTahun}.
                    </td>
                  </tr>
                )}
                {daftar.map((p) => {
                  const jumlahHari =
                    Math.round(
                      (p.tanggalSelesai.getTime() - p.tanggalMulai.getTime()) / 86_400_000
                    ) + 1;
                  const sedangBerjalan =
                    hariIni >= p.tanggalMulai && hariIni <= p.tanggalSelesai;
                  return (
                    <tr
                      key={p.id}
                      className={sedangBerjalan ? 'bg-btn-biru-50/40' : undefined}
                    >
                      <td className="text-sm font-medium text-abu-900">
                        {p.nama}
                        {sedangBerjalan && (
                          <span className="ml-2 rounded bg-btn-biru-100 px-1.5 py-0.5 text-[10px] font-semibold text-btn-biru-700">
                            berjalan
                          </span>
                        )}
                      </td>
                      <td className="text-xs text-abu-600 tabular-nums">
                        {rentangPeriode(p.tanggalMulai, p.tanggalSelesai)}
                      </td>
                      <td className="text-right tabular-nums text-xs text-abu-600">
                        {jumlahHari}
                      </td>
                      <td className="text-right tabular-nums text-sm text-abu-700">
                        {p._count.penilaian}
                      </td>
                      <td>
                        <div className="flex flex-wrap gap-1.5">
                          <span
                            className={`inline-block rounded-full px-2.5 py-1 text-[11px] font-medium ${
                              p.aktif ? 'bg-sukses-bg text-sukses' : 'bg-abu-100 text-abu-500'
                            }`}
                          >
                            {p.aktif ? 'Aktif' : 'Nonaktif'}
                          </span>
                          {p.dikunci && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-peringatan-bg px-2.5 py-1 text-[11px] font-medium text-peringatan">
                              🔒 Terkunci
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="text-right">
                        <AksiPeriode periodeId={p.id} aktif={p.aktif} dikunci={p.dikunci} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* ===== penjelasan aturan ===== */}
        <div className="mt-6 kartu p-6">
          <h3 className="text-sm font-semibold text-abu-800">Aturan periode</h3>
          <ul className="mt-3 space-y-2 text-sm text-abu-500 leading-relaxed">
            <li>
              &middot; Penilaian dilakukan <strong>setiap hari{' '}
              {NAMA_HARI[pengaturan.hariPenilaian]}</strong>. Hari ini hanya jadwal
              pengisian — bukan penentu batas periode.
            </li>
            <li>
              &middot; Periode selalu <strong>mulai tanggal 1</strong> tiap bulan dan
              <strong> berakhir hari Minggu</strong>. Tidak menyeberang bulan.
            </li>
            <li>
              &middot; Kalau tanggal 1 jatuh <em>setelah</em> hari penilaian, periode
              pertama jadi lebih panjang (sampai Minggu minggu depan). Contoh: Minggu
              ke-1 Oktober 2026 = 1&ndash;11 Okt.
            </li>
            <li>
              &middot; Periode yang kurang dari <strong>{MIN_HARI_PERIODE} hari</strong>
              {' '}digabung: yang di awal bulan ke periode berikutnya, yang di akhir
              bulan ke periode sebelumnya.
            </li>
            <li>
              &middot; <strong>Aktif</strong> &mdash; periode muncul di daftar penilaian
              dan dapat dipilih.
            </li>
            <li>
              &middot; <strong>Terkunci</strong> &mdash; penilaian pada periode ini tidak
              dapat diubah siapa pun.
            </li>
            <li>
              &middot; Satu pegawai hanya punya satu penilaian per periode.
            </li>
          </ul>
        </div>
      </div>
    </Kerangka>
  );
}
