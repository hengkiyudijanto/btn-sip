import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { pegawaiDariSesi } from '@/lib/auth';
import { Kerangka } from '@/components/kerangka';
import { prisma } from '@/lib/db';
import { FormKonten } from '@/components/form-konten';
import { AksiKonten, HasilKirim } from '@/components/aksi-konten';
import { daftarCalonPenyetuju } from '@/app/actions/sosmed';
import { bolehEfek, bolehLihatKonten, bolehKonten } from '@/lib/sosmed/akses';
import { bisaDiubah, LABEL_STATUS, WARNA_STATUS, BATAS_PLATFORM, periksaKelayakan, type StatusKonten } from '@/lib/sosmed/status';
import { keteranganStatus, statusIkon } from '@/lib/sosmed/ikon';
import { formatUkuran } from '@/lib/sosmed/media';

export const metadata = { title: 'Detail Konten' };

export default async function HalamanDetailKonten({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const saya = await pegawaiDariSesi();
  if (!saya) redirect('/masuk');
  if (saya.harusGantiPassword) redirect('/ubah-password');

  const { id } = await params;

  const konten = await prisma.kontenSosmed.findUnique({
    where: { id },
    include: {
      pembuat: { select: { id: true, nama: true, nip: true, role: true } },
      penyetuju: { select: { id: true, nama: true, role: true } },
      keputusan: {
        include: { oleh: { select: { nama: true, role: true } } },
        orderBy: { createdAt: 'desc' },
      },
    },
  });
  if (!konten) notFound();

  const izinLihat = bolehLihatKonten(
    { pembuatId: konten.pembuatId, penyetujuId: konten.penyetujuId, status: konten.status as StatusKonten },
    { id: saya.id, role: saya.role }
  );
  if (!izinLihat) redirect('/sosmed');

  const pemilik = konten.pembuatId === saya.id;
  const penyetuju = konten.penyetujuId === saya.id && bolehEfek(saya.role, 'setujui_konten');
  const status = konten.status as StatusKonten;
  const bisaUbah = bolehKonten(
    { pembuatId: konten.pembuatId, penyetujuId: konten.penyetujuId, status },
    { id: saya.id, role: saya.role },
    'ubah'
  ).boleh;

  const calon = bisaUbah ? await daftarCalonPenyetuju(saya) : [];

  // Kelayakan kirim — ditampilkan SUPAYA pemakai tahu sebelum menekan Kirim.
  const masalah =
    konten.jenis && konten.mediaByte
      ? periksaKelayakan({
          tujuan: konten.tujuan as never,
          jenis: konten.jenis as never,
          caption: konten.caption,
          ukuranByte: konten.mediaByte,
          mime: konten.mediaMime ?? '',
          durasiDetik: konten.durasiDetik,
        })
      : [];

  return (
    <Kerangka pegawai={saya}>
      <div className="mx-auto max-w-5xl px-4 sm:px-6 py-8">
        <Link href="/sosmed" className="text-xs text-abu-500 hover:text-abu-700">
          ← Kembali ke daftar konten
        </Link>

        {/* ===== kepala ===== */}
        <div className="animasi-naik mt-3 flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold text-abu-900 break-words">{konten.judul}</h1>
            <div className="mt-2 h-0.5 w-10 bg-btn-merah-500 rounded-full" />
            <p className="mt-3 text-xs text-abu-500">
              Dibuat oleh {konten.pembuat.nama} ({konten.pembuat.nip}) &middot;{' '}
              {konten.createdAt.toLocaleString('id-ID')}
              {konten.penyetuju && <> &middot; penyetuju: {konten.penyetuju.nama}</>}
            </p>
          </div>
          <span
            className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold ${
              WARNA_STATUS[status] ?? 'bg-abu-100 text-abu-700'
            }`}
          >
            {statusIkon(status)} {LABEL_STATUS[status] ?? status}
          </span>
        </div>

        <p className="mt-3 text-xs text-abu-500 bg-abu-100 rounded-lg px-3.5 py-2.5 leading-relaxed">
          {keteranganStatus(status)}
        </p>

        {/* ===== berkas & isi ===== */}
        <div className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="space-y-5">
            {/* pratinjau */}
            <div className="kartu p-5">
              <h2 className="text-sm font-semibold text-abu-800 mb-3">Berkas</h2>
              {!konten.mediaData ? (
                <p className="text-xs text-abu-400">Belum ada berkas.</p>
              ) : konten.jenis === 'VIDEO' ? (
                <video
                  src={`/sosmed/media/${konten.id}`}
                  controls
                  className="w-full rounded-lg bg-abu-900 max-h-[60vh]"
                />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={`/sosmed/media/${konten.id}`}
                  alt={konten.judul}
                  className="w-full rounded-lg border border-abu-200 max-h-[60vh] object-contain bg-abu-50"
                />
              )}
              {konten.mediaByte && (
                <p className="mt-2 text-[11px] text-abu-400 tabular-nums">
                  {konten.jenis} &middot; {formatUkuran(konten.mediaByte)}
                  {konten.mediaLebar ? ` · ${konten.mediaLebar}×${konten.mediaTinggi}` : ''}
                  {konten.durasiDetik ? ` · ${Math.round(konten.durasiDetik)} detik` : ''}
                </p>
              )}
            </div>

            {/* caption */}
            <div className="kartu p-5">
              <h2 className="text-sm font-semibold text-abu-800 mb-2">Caption</h2>
              <p className="text-sm text-abu-700 whitespace-pre-line leading-relaxed">
                {konten.caption || <span className="text-abu-400">Tanpa caption.</span>}
              </p>
              <p className="mt-2 text-[11px] text-abu-400 tabular-nums">
                {konten.caption.length} / 2200 karakter
              </p>
            </div>

            {/* hasil kirim */}
            {konten.hasilKirim && (
              <div className="kartu p-5">
                <h2 className="text-sm font-semibold text-abu-800 mb-3">Hasil pengiriman</h2>
                <HasilKirim hasil={konten.hasilKirim} />
              </div>
            )}

            {/* ubah isi */}
            {bisaUbah && (
              <details className="kartu p-5">
                <summary className="cursor-pointer text-sm font-semibold text-abu-800">
                  Ubah isi konten
                </summary>
                <div className="mt-4">
                  <FormKonten
                    konten={{
                      id: konten.id,
                      judul: konten.judul,
                      caption: konten.caption,
                      tujuan: konten.tujuan,
                      jenis: konten.jenis,
                      mediaUrl: konten.mediaData ? `/sosmed/media/${konten.id}` : null,
                      mediaByte: konten.mediaByte,
                      mediaLebar: konten.mediaLebar,
                      mediaTinggi: konten.mediaTinggi,
                      durasiDetik: konten.durasiDetik,
                      penyetujuId: konten.penyetujuId,
                    }}
                    calonPenyetuju={calon.map((p) => ({
                      id: p.id,
                      nama: p.nama,
                      nip: p.nip,
                      jabatan: p.cabang?.nama ?? null,
                    }))}
                    sayaId={saya.id}
                  />
                </div>
              </details>
            )}

            {/* riwayat */}
            <div className="kartu p-5">
              <h2 className="text-sm font-semibold text-abu-800 mb-3">Riwayat keputusan</h2>
              <ol className="space-y-3">
                {konten.keputusan.map((k) => (
                  <li key={k.id} className="flex gap-3">
                    <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-btn-biru-500" />
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-abu-800">
                        {k.aksi} <span className="font-normal text-abu-500">oleh {k.oleh.nama}</span>
                      </p>
                      <p className="text-[11px] text-abu-400 tabular-nums">
                        {k.createdAt.toLocaleString('id-ID')}
                      </p>
                      {k.catatan && (
                        <p className="mt-1 text-[11px] text-abu-600 bg-abu-50 rounded px-2.5 py-1.5 whitespace-pre-line leading-relaxed">
                          {k.catatan}
                        </p>
                      )}
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          </div>

          {/* ===== kolom kanan ===== */}
          <div className="space-y-5">
            <div className="kartu p-5">
              <h2 className="text-sm font-semibold text-abu-800 mb-3">Tindakan</h2>
              <AksiKonten
                id={konten.id}
                status={status}
                pemilik={pemilik}
                penyetuju={penyetuju}
                sudahPunyaBerkas={Boolean(konten.mediaData)}
              />
            </div>

            <div className="kartu p-5">
              <h2 className="text-sm font-semibold text-abu-800 mb-3">Tujuan</h2>
              <p className="text-xs text-abu-700">
                {konten.tujuan === 'KEDUANYA'
                  ? 'TikTok & Instagram'
                  : konten.tujuan === 'TIKTOK'
                    ? 'TikTok saja'
                    : 'Instagram saja'}
              </p>

              {masalah.length > 0 && (
                <div className="mt-3 space-y-1.5">
                  <p className="text-[11px] font-semibold text-bahaya">
                    Perlu diperhatikan sebelum dikirim:
                  </p>
                  {masalah.map((m, i) => (
                    <p key={i} className="text-[11px] text-bahaya bg-bahaya-bg rounded px-2.5 py-1.5 leading-relaxed">
                      <strong>{m.platform}:</strong> {m.pesan}
                    </p>
                  ))}
                </div>
              )}

              <ul className="mt-3 space-y-1 text-[11px] text-abu-400 leading-relaxed">
                <li>Caption maksimal {BATAS_PLATFORM.INSTAGRAM.maksCaption} karakter.</li>
                <li>Instagram feed: gambar harus JPEG.</li>
                <li>TikTok: hanya video.</li>
                <li>Jumlah revisi: {konten.jumlahRevisi}×</li>
              </ul>
            </div>

            {konten.alasanRevisi && (
              <div className="kartu p-5 border-l-[3px] border-btn-merah-500">
                <h2 className="text-sm font-semibold text-btn-merah-700 mb-2">Alasan revisi</h2>
                <p className="text-xs text-abu-700 whitespace-pre-line leading-relaxed">
                  {konten.alasanRevisi}
                </p>
              </div>
            )}

            {konten.catatanKreator && (
              <div className="kartu p-5">
                <h2 className="text-sm font-semibold text-abu-800 mb-2">Catatan kreator</h2>
                <p className="text-xs text-abu-700 whitespace-pre-line leading-relaxed">
                  {konten.catatanKreator}
                </p>
              </div>
            )}

            {konten.catatanPenyetuju && (
              <div className="kartu p-5">
                <h2 className="text-sm font-semibold text-abu-800 mb-2">Catatan penyetuju</h2>
                <p className="text-xs text-abu-700 whitespace-pre-line leading-relaxed">
                  {konten.catatanPenyetuju}
                </p>
              </div>
            )}

            {konten.status === 'DIKIRIM' && konten.terkirimAt && (
              <div className="kartu p-5">
                <h2 className="text-sm font-semibold text-abu-800 mb-2">Dikirim</h2>
                <p className="text-xs text-abu-700 tabular-nums">
                  {konten.terkirimAt.toLocaleString('id-ID')}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </Kerangka>
  );
}
