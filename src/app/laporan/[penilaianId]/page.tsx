import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { pegawaiDariSesi } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { LembarLaporan } from '@/components/lembar-laporan';
import { TombolCetak } from '@/components/tombol-cetak';
import {
  susunBlok,
  angkaID,
  labelRatingDwibahasa,
  rentangPeriode,
  tanggalID,
  type DataLaporan,
} from '@/lib/sip/laporan';
import { PERFORMANCE_RATING } from '@/lib/sip/penilaian';
import '@/app/laporan/laporan.css';

export const metadata = { title: 'Laporan SIP' };

export default async function HalamanCetakLaporan({
  params,
  searchParams,
}: {
  params: Promise<{ penilaianId: string }>;
  searchParams: Promise<{ versi?: string }>;
}) {
  const saya = await pegawaiDariSesi();
  if (!saya) redirect('/masuk');
  if (saya.harusGantiPassword) redirect('/ubah-password');

  const { penilaianId } = await params;
  const { versi: versiParam } = await searchParams;
  const versi: 'lengkap' | 'lite' = versiParam === 'lite' ? 'lite' : 'lengkap';

  const p = await prisma.penilaian.findUnique({
    where: { id: penilaianId },
    include: {
      detail: true,
      pegawai: {
        include: {
          jabatan: true,
          cabang: true,
        },
      },
      penilai: { include: { jabatan: true } },
      periode: true,
    },
  });
  if (!p) notFound();

  // Pegawai biasa hanya boleh melihat laporannya sendiri
  if (saya.role === 'PEGAWAI' && p.pegawaiId !== saya.id) {
    redirect('/dasbor');
  }

  const blok = susunBlok(
    p.detail.map((d) => ({
      kodeAspek: d.kodeAspek,
      nilaiMentah: d.nilaiMentah,
      skor: d.skor,
      catatan: d.catatan,
    })),
    versi
  );

  const data: DataLaporan = {
    nama: p.pegawai.nama,
    nip: p.pegawai.nip,
    jabatan: p.pegawai.jabatan?.nama ?? '—',
    jabatanEn: p.pegawai.jabatan?.namaEn ?? '',
    cabang: p.pegawai.cabang.nama,
    kodeCabang: p.pegawai.cabang.kode,
    periode: `${p.periode.nama} (${rentangPeriode(p.periode.tanggalMulai, p.periode.tanggalSelesai)})`,
    // Foto penilaian dipakai lebih dulu (foto kondisi petugas pada periode
    // ini). Kalau belum ada, baru jatuh ke foto pegawai sebagai cadangan —
    // supaya laporan lama yang dibuat sebelum aturan foto tetap tercetak.
    fotoUrl: p.fotoData ?? p.pegawai.fotoData ?? p.pegawai.fotoUrl,
    fotoCatatan: p.fotoCatatan,
    versi,

    blok,
    nilaiPenampilan: p.nilaiPenampilan ?? 0,
    nilaiKemampuan: p.nilaiKemampuan ?? 0,
    nilaiSikap: p.nilaiSikap ?? 0,
    nilaiAkhir: p.nilaiAkhir ?? 0,
    rating: p.rating ?? '—',
    ratingDwibahasa: labelRatingDwibahasa(p.rating ?? '—'),
    band: PERFORMANCE_RATING.find((b) => b.label === p.rating) ?? null,
    catatanUmum: p.catatanUmum,

    penilai: p.penilai.nama,
    penilaiJabatan: p.penilai.jabatan?.nama ?? 'Atasan Langsung',
    penilaiNip: p.penilai.nip,

    tanggalCetak: tanggalID(new Date()),
    status: p.status,
  };

  return (
    <div className="min-h-screen bg-abu-100">
      {/* ===== Bilah aksi (tidak tercetak) ===== */}
      <div className="tanpa-cetak sticky top-0 z-10 bg-white border-b border-abu-200 shadow-sm">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link
              href="/laporan"
              className="inline-flex items-center gap-1.5 text-xs font-medium text-abu-500 hover:text-btn-biru-600 transition-colors"
            >
              <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                <path
                  fillRule="evenodd"
                  d="M12.79 5.23a.75.75 0 01-.02 1.06L8.832 10l3.938 3.71a.75.75 0 11-1.04 1.08l-4.5-4.25a.75.75 0 010-1.08l4.5-4.25a.75.75 0 011.06.02z"
                  clipRule="evenodd"
                />
              </svg>
              Kembali
            </Link>
            <span className="text-abu-300">|</span>
            <span className="text-sm font-semibold text-abu-800">
              Laporan SIP &middot; {p.pegawai.nama}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <span className="hidden sm:block text-xs text-abu-500">
              Nilai akhir{' '}
              <strong className="text-abu-800 tabular-nums">
                {angkaID(p.nilaiAkhir)}
              </strong>{' '}
              &middot; {p.rating}
            </span>
            <TombolCetak />
          </div>
        </div>
      </div>

      {/* ===== Petunjuk cetak + pilih versi (tidak tercetak) ===== */}
      <div className="tanpa-cetak mx-auto max-w-5xl px-4 sm:px-6 pt-5 space-y-3">
        {/* pemilih versi laporan */}
        <div className="rounded-lg border border-abu-200 bg-white px-4 py-3">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-xs font-semibold text-abu-700">Versi laporan:</span>
            <div className="flex gap-2">
              <Link
                href={`/laporan/${penilaianId}`}
                className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-colors ${
                  versi === 'lengkap'
                    ? 'bg-btn-biru-600 text-white'
                    : 'border border-abu-300 bg-white text-abu-700 hover:bg-abu-50'
                }`}
              >
                Lengkap
              </Link>
              <Link
                href={`/laporan/${penilaianId}?versi=lite`}
                className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-colors ${
                  versi === 'lite'
                    ? 'bg-btn-biru-600 text-white'
                    : 'border border-abu-300 bg-white text-abu-700 hover:bg-abu-50'
                }`}
              >
                Lite
              </Link>
            </div>
            <span className="text-[11px] text-abu-500 leading-relaxed">
              {versi === 'lengkap'
                ? 'Menyertakan dasar penilaian (kriteria rubrik) di kolom Catatan.'
                : 'Tanpa dasar penilaian — catatan yang ditulis atasan tetap ditampilkan.'}
            </span>
          </div>
        </div>

        <div className="rounded-lg border border-btn-biru-200 bg-btn-biru-50 px-4 py-3">
          <p className="text-xs leading-relaxed text-btn-biru-700">
            <strong>Untuk mencetak:</strong> klik &ldquo;Cetak / Simpan PDF&rdquo;, lalu pada
            dialog pencetakan pilih ukuran <strong>A4</strong>, orientasi{' '}
            <strong>Portrait</strong>, dan aktifkan{' '}
            <strong>&ldquo;Background graphics&rdquo;</strong> agar warna kop dan
            header tabel ikut tercetak. Untuk menyimpan sebagai PDF, pilih tujuan
            &ldquo;Save as PDF&rdquo;.
          </p>
        </div>
      </div>

      {/* ===== Lembar laporan ===== */}
      <div className="px-4 sm:px-6 py-6">
        <div className="mx-auto bg-white shadow-lg" style={{ maxWidth: '210mm', padding: '14mm 12mm' }}>
          <LembarLaporan data={data} />
        </div>
      </div>
    </div>
  );
}
