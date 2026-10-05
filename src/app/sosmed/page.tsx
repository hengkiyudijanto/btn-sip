import { redirect } from 'next/navigation';
import Link from 'next/link';
import { pegawaiDariSesi } from '@/lib/auth';
import { Kerangka } from '@/components/kerangka';
import { prisma } from '@/lib/db';
import { bolehEfek } from '@/lib/sosmed/akses';
import { whereCakupan } from '@/lib/sosmed/akses';
import { hitungRingkasan, LABEL_STATUS, WARNA_STATUS, type StatusKonten } from '@/lib/sosmed/status';
import { ringkasHasilKirim } from '@/lib/sosmed/hasil';
import { bacaKonfigSosmed } from '@/lib/sosmed/konfig';
import { statusIkon } from '@/lib/sosmed/ikon';

export const metadata = { title: 'Konten Sosmed' };

const FILTER: { nilai: string; label: string }[] = [
  { nilai: 'SEMUA', label: 'Semua' },
  { nilai: 'DRAFT', label: 'Draft' },
  { nilai: 'MENUNGGU', label: 'Menunggu' },
  { nilai: 'REVISI', label: 'Perlu revisi' },
  { nilai: 'DISETUJUI', label: 'Disetujui' },
  { nilai: 'DIJADWALKAN', label: 'Dijadwalkan' },
  { nilai: 'DIKIRIM', label: 'Terkirim' },
];

export default async function DaftarKonten({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; cari?: string }>;
}) {
  const saya = await pegawaiDariSesi();
  if (!saya) redirect('/masuk');
  if (saya.harusGantiPassword) redirect('/ubah-password');

  const sp = await searchParams;
  const status = FILTER.some((f) => f.nilai === sp.status) ? sp.status! : 'SEMUA';
  const cari = (sp.cari ?? '').trim();

  const cakupan = whereCakupan({ id: saya.id, role: saya.role });

  const [daftar, semuaStatus] = await Promise.all([
    prisma.kontenSosmed.findMany({
      where: {
        ...cakupan,
        ...(status !== 'SEMUA' ? { status } : {}),
        ...(cari
          ? {
              OR: [{ judul: { contains: cari, mode: 'insensitive' } }, { caption: { contains: cari, mode: 'insensitive' } }],
            }
          : {}),
      },
      select: {
        id: true,
        judul: true,
        caption: true,
        jenis: true,
        tujuan: true,
        status: true,
        createdAt: true,
        jumlahRevisi: true,
        mediaByte: true,
        hasilKirim: true,
        pembuat: { select: { nama: true } },
        penyetuju: { select: { nama: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    }),
    prisma.kontenSosmed.findMany({ where: cakupan, select: { status: true } }),
  ]);

  const jumlahPerStatus: Partial<Record<StatusKonten, number>> = {};
  for (const k of semuaStatus) {
    const s = k.status as StatusKonten;
    jumlahPerStatus[s] = (jumlahPerStatus[s] ?? 0) + 1;
  }
  const ringkasan = hitungRingkasan(jumlahPerStatus);
  const konfig = bacaKonfigSosmed();
  const bolehBuat = bolehEfek(saya.role, 'kelola_konten');

  return (
    <Kerangka pegawai={saya}>
      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-8">
        <div className="animasi-naik flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-abu-900">Konten Sosmed</h1>
            <div className="mt-2 h-0.5 w-10 bg-btn-merah-500 rounded-full" />
            <p className="mt-3 text-sm text-abu-500">
              Kelola konten TikTok & Instagram: buat, ajukan untuk disetujui, lalu kirim ke platform.
            </p>
          </div>
          {bolehBuat && (
            <Link
              href="/sosmed/baru"
              className="inline-flex items-center gap-2 rounded-lg bg-btn-biru-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-btn-biru-700 transition-colors"
            >
              + Buat Konten
            </Link>
          )}
        </div>

        {/* ===== peringatan modus simulasi ===== */}
        {konfig.modus === 'mock' && bolehBuat && (
          <div className="mt-5 rounded-lg border-l-[3px] border-peringatan bg-peringatan-bg px-4 py-3">
            <p className="text-xs font-semibold text-peringatan">Modus simulasi</p>
            <p className="mt-0.5 text-[11px] text-abu-700 leading-relaxed">
              Pengiriman ke TikTok/Instagram saat ini <strong>disimulasikan</strong> — tidak ada
              unggahan nyata. Isi kredensial di{' '}
              <Link href="/sosmed/pengaturan" className="font-semibold underline">
                Pengaturan Platform
              </Link>{' '}
              kalau sudah siap ke API sungguhan.
            </p>
          </div>
        )}

        {/* ===== ringkasan ===== */}
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="kartu p-5">
            <div className="label-kolom">Terkirim</div>
            <div className="mt-1.5 text-2xl font-bold text-sukses">{ringkasan.selesai}</div>
            <div className="mt-0.5 text-xs text-abu-400">konten sudah dipublikasikan</div>
          </div>
          <div className="kartu p-5">
            <div className="label-kolom">Menunggu persetujuan</div>
            <div className={`mt-1.5 text-2xl font-bold ${ringkasan.menunggu > 0 ? 'text-peringatan' : 'text-abu-900'}`}>
              {ringkasan.menunggu}
            </div>
            <div className="mt-0.5 text-xs text-abu-400">menunggu keputusan penyetuju</div>
          </div>
          <div className="kartu p-5">
            <div className="label-kolom">Perlu revisi</div>
            <div className={`mt-1.5 text-2xl font-bold ${ringkasan.perluTindakan > 0 ? 'text-bahaya' : 'text-abu-900'}`}>
              {ringkasan.perluTindakan}
            </div>
            <div className="mt-0.5 text-xs text-abu-400">dikembalikan ke kreator</div>
          </div>
          <div className="kartu p-5">
            <div className="label-kolom">Total konten</div>
            <div className="mt-1.5 text-2xl font-bold text-abu-900">{semuaStatus.length}</div>
            <div className="mt-0.5 text-xs text-abu-400">dalam cakupan Anda</div>
          </div>
        </div>

        {/* ===== filter ===== */}
        <div className="mt-8 flex flex-wrap items-center gap-2">
          {FILTER.map((f) => {
            const aktif = status === f.nilai;
            const jumlah =
              f.nilai === 'SEMUA' ? semuaStatus.length : jumlahPerStatus[f.nilai as StatusKonten] ?? 0;
            return (
              <Link
                key={f.nilai}
                href={f.nilai === 'SEMUA' ? '/sosmed' : `/sosmed?status=${f.nilai}`}
                className={`rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors ${
                  aktif
                    ? 'bg-btn-biru-600 text-white'
                    : 'bg-white border border-abu-200 text-abu-600 hover:bg-abu-50'
                }`}
              >
                {f.label} <span className="tabular-nums opacity-70">({jumlah})</span>
              </Link>
            );
          })}

          <form action="/sosmed" className="ml-auto flex gap-2">
            {status !== 'SEMUA' && <input type="hidden" name="status" value={status} />}
            <input
              name="cari"
              defaultValue={cari}
              placeholder="Cari judul atau caption…"
              className="rounded-lg border border-abu-300 px-3 py-1.5 text-xs focus:border-btn-biru-500 focus:outline-none"
            />
            <button
              type="submit"
              className="rounded-lg border border-abu-300 bg-white px-3 py-1.5 text-xs font-medium text-abu-700 hover:bg-abu-50 transition-colors"
            >
              Cari
            </button>
          </form>
        </div>

        {/* ===== daftar ===== */}
        {daftar.length === 0 ? (
          <div className="mt-4 kartu p-10 text-center">
            <p className="text-sm text-abu-500">
              {cari || status !== 'SEMUA'
                ? 'Tidak ada konten yang cocok dengan filter ini.'
                : 'Belum ada konten. Mulai dengan membuat konten pertama Anda.'}
            </p>
            {bolehBuat && !cari && status === 'SEMUA' && (
              <Link href="/sosmed/baru" className="mt-4 inline-block text-xs font-semibold text-btn-biru-600 hover:underline">
                + Buat konten pertama
              </Link>
            )}
          </div>
        ) : (
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {daftar.map((k) => {
              const hasil = ringkasHasilKirim(k.hasilKirim);
              return (
                <Link
                  key={k.id}
                  href={`/sosmed/${k.id}`}
                  className="kartu overflow-hidden hover:border-btn-biru-400 transition-colors group"
                >
                  <div className="aspect-video bg-abu-100 relative overflow-hidden">
                    {k.mediaByte ? (
                      k.jenis === 'VIDEO' ? (
                        <div className="w-full h-full flex items-center justify-center bg-abu-800">
                          <span className="text-white text-xs font-medium">▶ Video</span>
                        </div>
                      ) : (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={`/sosmed/media/${k.id}`}
                          alt={k.judul}
                          className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform"
                        />
                      )
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-[11px] text-abu-400">
                        Tanpa berkas
                      </div>
                    )}
                    <span
                      className={`absolute top-2 left-2 rounded-full px-2.5 py-1 text-[10px] font-semibold ${
                        WARNA_STATUS[k.status as StatusKonten] ?? 'bg-abu-100 text-abu-700'
                      }`}
                    >
                      {statusIkon(k.status)} {LABEL_STATUS[k.status as StatusKonten] ?? k.status}
                    </span>
                  </div>

                  <div className="p-4">
                    <h3 className="text-sm font-semibold text-abu-900 line-clamp-1">{k.judul}</h3>
                    <p className="mt-1 text-[11px] text-abu-500 line-clamp-2 leading-relaxed">
                      {k.caption || 'Tanpa caption'}
                    </p>

                    <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-abu-400">
                      <span>{k.tujuan === 'KEDUANYA' ? 'TikTok & Instagram' : k.tujuan}</span>
                      <span>&middot;</span>
                      <span className="truncate">oleh {k.pembuat.nama}</span>
                      {k.penyetuju && (
                        <>
                          <span>&middot;</span>
                          <span className="truncate">penyetuju {k.penyetuju.nama}</span>
                        </>
                      )}
                    </div>

                    {k.status === 'REVISI' && k.jumlahRevisi > 0 && (
                      <p className="mt-2 text-[10px] font-medium text-bahaya">
                        sudah {k.jumlahRevisi}× dikembalikan
                      </p>
                    )}
                    {hasil && (
                      <p
                        className={`mt-2 text-[10px] font-medium ${
                          hasil.adaGagal ? 'text-bahaya' : 'text-sukses'
                        }`}
                      >
                        {hasil.teks}
                      </p>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </Kerangka>
  );
}
