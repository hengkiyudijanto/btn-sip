import { redirect } from 'next/navigation';
import Link from 'next/link';
import { pegawaiDariSesi } from '@/lib/auth';
import { Kerangka } from '@/components/kerangka';
import { prisma } from '@/lib/db';
import { AksiKonten } from '@/components/aksi-konten';
import { bolehEfek } from '@/lib/sosmed/akses';
import { periksaKelayakan, LABEL_STATUS, WARNA_STATUS, type StatusKonten } from '@/lib/sosmed/status';
import { formatUkuran } from '@/lib/sosmed/media';

export const metadata = { title: 'Persetujuan Konten' };

/**
 * Halaman kerja penyetuju.
 *
 * Isinya sengaja DUA daftar saja: yang menunggu keputusan saya, dan riwayat
 * yang sudah saya putuskan. Konten yang menunggu penyetuju LAIN tidak
 * ditampilkan — bukan karena disembunyikan, tapi karena bukan tugas saya.
 */
export default async function PersetujuanKonten() {
  const saya = await pegawaiDariSesi();
  if (!saya) redirect('/masuk');
  if (saya.harusGantiPassword) redirect('/ubah-password');
  if (!bolehEfek(saya.role, 'setujui_konten')) redirect('/sosmed');

  const [menunggu, sudahDiputus] = await Promise.all([
    prisma.kontenSosmed.findMany({
      where: { status: 'MENUNGGU', penyetujuId: saya.id },
      include: {
        pembuat: { select: { nama: true, nip: true } },
        penyetuju: { select: { nama: true } },
      },
      orderBy: { diajukanAt: 'asc' },
    }),
    prisma.kontenSosmed.findMany({
      where: {
        penyetujuId: saya.id,
        status: { in: ['DISETUJUI', 'DIJADWALKAN', 'DIKIRIM', 'REVISI'] },
        diputusAt: { not: null },
      },
      include: {
        pembuat: { select: { nama: true, nip: true } },
        penyetuju: { select: { nama: true } },
      },
      orderBy: { diputusAt: 'desc' },
      take: 30,
    }),
  ]);

  return (
    <Kerangka pegawai={saya}>
      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-8">
        <div className="animasi-naik">
          <h1 className="text-2xl font-bold text-abu-900">Persetujuan Konten</h1>
          <div className="mt-2 h-0.5 w-10 bg-btn-merah-500 rounded-full" />
          <p className="mt-3 text-sm text-abu-500">
            Tinjau konten yang diajukan ke Anda. Setujui untuk meneruskan ke pengiriman, atau minta
            revisi dengan alasan yang jelas.
          </p>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          <div className="kartu p-5">
            <div className="label-kolom">Menunggu keputusan Anda</div>
            <div
              className={`mt-1.5 text-2xl font-bold ${
                menunggu.length > 0 ? 'text-peringatan' : 'text-abu-900'
              }`}
            >
              {menunggu.length}
            </div>
            <div className="mt-0.5 text-xs text-abu-400">konten</div>
          </div>
          <div className="kartu p-5">
            <div className="label-kolom">Sudah Anda putuskan</div>
            <div className="mt-1.5 text-2xl font-bold text-abu-900">{sudahDiputus.length}</div>
            <div className="mt-0.5 text-xs text-abu-400">30 keputusan terakhir</div>
          </div>
          <div className="kartu p-5">
            <div className="label-kolom">Tugas Anda</div>
            <div className="mt-1.5 text-base font-semibold text-abu-900">
              {menunggu.length === 0 ? 'Tidak ada' : `${menunggu.length} konten`}
            </div>
            <div className="mt-0.5 text-xs text-abu-400">sebagai penyetuju</div>
          </div>
        </div>

        <h2 className="mt-8 text-sm font-semibold text-abu-700 mb-3">Menunggu keputusan Anda</h2>

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
            <p className="text-sm text-abu-500">Tidak ada konten yang menunggu persetujuan Anda.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {menunggu.map((k) => {
              const masalah = periksaKelayakan({
                tujuan: k.tujuan as never,
                jenis: k.jenis as never,
                caption: k.caption,
                ukuranByte: k.mediaByte ?? 0,
                mime: k.mediaMime ?? '',
                durasiDetik: k.durasiDetik,
              });

              return (
                <div key={k.id} className="kartu p-6">
                  <div className="flex flex-wrap gap-5">
                    {/* pratinjau kecil */}
                    <div className="shrink-0">
                      <div className="rounded-lg border border-abu-200 bg-abu-50 overflow-hidden w-[150px] h-[190px] flex items-center justify-center">
                        {k.mediaData ? (
                          k.jenis === 'VIDEO' ? (
                            <span className="text-[11px] text-abu-500">▶ Video</span>
                          ) : (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={`/sosmed/media/${k.id}`}
                              alt={k.judul}
                              className="w-full h-full object-cover"
                            />
                          )
                        ) : (
                          <span className="text-[11px] text-abu-400">Tanpa berkas</span>
                        )}
                      </div>
                      {k.mediaByte && (
                        <p className="mt-1 text-[10px] text-abu-400 text-center tabular-nums">
                          {formatUkuran(k.mediaByte)}
                          {k.durasiDetik ? ` · ${Math.round(k.durasiDetik)} dtk` : ''}
                        </p>
                      )}
                    </div>

                    {/* isi */}
                    <div className="flex-1 min-w-[260px]">
                      <div className="flex flex-wrap items-center gap-2.5">
                        <Link
                          href={`/sosmed/${k.id}`}
                          className="text-base font-bold text-abu-900 hover:text-btn-biru-700"
                        >
                          {k.judul}
                        </Link>
                        <span className="text-xs text-abu-400">oleh {k.pembuat.nama}</span>
                      </div>
                      <p className="mt-1 text-[11px] text-abu-400">
                        {k.tujuan === 'KEDUANYA' ? 'TikTok & Instagram' : k.tujuan} &middot;{' '}
                        {k.jenis === 'VIDEO' ? 'Video' : 'Gambar'}
                        {k.diajukanAt && (
                          <> &middot; diajukan {k.diajukanAt.toLocaleString('id-ID')}</>
                        )}
                      </p>

                      <div className="mt-3 rounded-lg bg-abu-50 px-3.5 py-2.5">
                        <p className="text-[11px] font-semibold text-abu-500 mb-1">Caption</p>
                        <p className="text-xs text-abu-700 whitespace-pre-line leading-relaxed line-clamp-6">
                          {k.caption || '—'}
                        </p>
                      </div>

                      {k.catatanKreator && (
                        <div className="mt-2 rounded-lg border-l-[3px] border-btn-biru-500 bg-abu-50 px-3.5 py-2.5">
                          <p className="text-[11px] font-semibold text-abu-500 mb-0.5">
                            Catatan kreator
                          </p>
                          <p className="text-xs text-abu-700 leading-relaxed whitespace-pre-line">
                            {k.catatanKreator}
                          </p>
                        </div>
                      )}

                      {masalah.length > 0 && (
                        <div className="mt-3 space-y-1.5">
                          {masalah.map((m, i) => (
                            <p
                              key={i}
                              className="text-[11px] text-bahaya bg-bahaya-bg rounded px-2.5 py-1.5 leading-relaxed"
                            >
                              <strong>{m.platform}:</strong> {m.pesan}
                            </p>
                          ))}
                        </div>
                      )}

                      <div className="mt-4 pt-4 border-t border-abu-200">
                        <AksiKonten
                          id={k.id}
                          status={k.status}
                          pemilik={k.pembuatId === saya.id}
                          penyetuju={k.penyetujuId === saya.id}
                          sudahPunyaBerkas={Boolean(k.mediaData)}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ===== riwayat ===== */}
        {sudahDiputus.length > 0 && (
          <>
            <h2 className="mt-10 text-sm font-semibold text-abu-700 mb-3">Sudah Anda putuskan</h2>
            <div className="kartu overflow-hidden">
              <div className="overflow-x-auto">
                <table className="tabel-sip">
                  <thead>
                    <tr>
                      <th>Judul</th>
                      <th>Kreator</th>
                      <th>Tujuan</th>
                      <th>Status</th>
                      <th>Keputusan</th>
                      <th>Waktu</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sudahDiputus.map((k) => (
                      <tr key={k.id}>
                        <td className="font-medium text-abu-900">
                          <Link href={`/sosmed/${k.id}`} className="hover:text-btn-biru-700">
                            {k.judul}
                          </Link>
                        </td>
                        <td className="text-xs text-abu-600">{k.pembuat.nama}</td>
                        <td className="text-xs text-abu-600">
                          {k.tujuan === 'KEDUANYA' ? 'TikTok & IG' : k.tujuan}
                        </td>
                        <td>
                          <span
                            className={`inline-block rounded-full px-2.5 py-1 text-[11px] font-medium ${
                              WARNA_STATUS[k.status as StatusKonten] ?? 'bg-abu-100 text-abu-700'
                            }`}
                          >
                            {LABEL_STATUS[k.status as StatusKonten] ?? k.status}
                          </span>
                        </td>
                        <td className="text-xs text-abu-600 max-w-[240px] truncate">
                          {k.alasanRevisi ? `Revisi: ${k.alasanRevisi}` : k.catatanPenyetuju ?? 'Disetujui'}
                        </td>
                        <td className="text-xs text-abu-400 tabular-nums">
                          {k.diputusAt?.toLocaleString('id-ID') ?? '—'}
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
