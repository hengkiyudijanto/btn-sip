import { redirect } from 'next/navigation';
import { pegawaiDariSesi } from '@/lib/auth';
import { Kerangka } from '@/components/kerangka';
import { prisma } from '@/lib/db';
import { bolehEfek } from '@/lib/sosmed/akses';
import { ringkasKonfig } from '@/lib/sosmed/konfig';
import { BATAS_PLATFORM, SEMUA_PLATFORM, LABEL_PLATFORM } from '@/lib/sosmed/status';
import { BATAS_MEDIA, formatUkuran } from '@/lib/sosmed/media';

export const metadata = { title: 'Pengaturan Platform' };

/**
 * Halaman pengaturan pengiriman.
 *
 * PENTING — halaman ini TIDAK menyimpan kredensial. Kredensial ditulis ke
 * `config/sosmed.json` di server (tidak ikut git). Alasannya: menaruh token di
 * kolom database berarti token ikut ter-backup, ter-ekspor, dan terlihat di
 * setiap dump — sedangkan berkas config hanya dibaca proses yang membutuhkan.
 * Halaman ini hanya MEMBACA dan menampilkan status ada/tidak ada + panjangnya.
 */
export default async function PengaturanSosmed() {
  const saya = await pegawaiDariSesi();
  if (!saya) redirect('/masuk');
  if (saya.harusGantiPassword) redirect('/ubah-password');
  if (!bolehEfek(saya.role, 'kelola_sosmed')) redirect('/sosmed');

  const konfig = ringkasKonfig();

  // Statistik berkas: untuk memutuskan kapan pindah ke object storage.
  const [total, pakaiBerkas, jumlahDilihat] = await Promise.all([
    prisma.kontenSosmed.count(),
    prisma.kontenSosmed.count({ where: { mediaData: { not: null } } }),
    prisma.kontenSosmed.aggregate({ _sum: { mediaByte: true, mediaDilihat: true } }),
  ]);

  const totalByte = jumlahDilihat._sum.mediaByte ?? 0;

  return (
    <Kerangka pegawai={saya}>
      <div className="mx-auto max-w-4xl px-4 sm:px-6 py-8">
        <div className="animasi-naik">
          <h1 className="text-2xl font-bold text-abu-900">Pengaturan Platform</h1>
          <div className="mt-2 h-0.5 w-10 bg-btn-merah-500 rounded-full" />
          <p className="mt-3 text-sm text-abu-500 leading-relaxed">
            Status koneksi ke TikTok & Instagram. Selama kredensial belum diisi, pengiriman berjalan
            dalam <strong>modus simulasi</strong> — alur approval tetap nyata, tetapi tidak ada
            unggahan ke platform.
          </p>
        </div>

        {/* ===== modus ===== */}
        <div className="mt-6 kartu p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="label-kolom">Modus pengiriman</div>
              <div className="mt-1.5 flex items-center gap-2.5">
                <span
                  className={`text-lg font-bold ${
                    konfig.modus === 'nyata' ? 'text-sukses' : 'text-peringatan'
                  }`}
                >
                  {konfig.modus === 'nyata' ? 'Nyata' : 'Simulasi'}
                </span>
                <span
                  className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${
                    konfig.modus === 'nyata'
                      ? 'bg-sukses-bg text-sukses'
                      : 'bg-peringatan-bg text-peringatan'
                  }`}
                >
                  {konfig.modus === 'nyata' ? 'API sungguhan' : 'tanpa unggahan nyata'}
                </span>
              </div>
            </div>
            <div className="text-right">
              <div className="label-kolom">Berkas konfigurasi</div>
              <div className="mt-1.5 text-[11px] font-mono text-abu-600 break-all">
                {konfig.lokasi}
              </div>
            </div>
          </div>

          <pre className="mt-4 overflow-x-auto rounded-lg bg-abu-900 px-4 py-3 text-[11px] leading-relaxed text-abu-100">
{`{
  "modus": "nyata",
  "instagram": {
    "igUserId": "17841400000000000",
    "accessToken": "EAAG...",
    "apiVersi": "v21.0"
  },
  "tiktok": {
    "accessToken": "act....",
    "modePrivasi": "DRAFT"
  }
}`}
          </pre>
          <p className="mt-2 text-[11px] text-abu-500 leading-relaxed">
            Simpan berkas itu di server, lalu muat ulang halaman ini — tidak perlu build ulang.
            Selama <code className="font-mono">modus</code> masih <code className="font-mono">mock</code>,
            pengiriman tetap disimulasikan walau kredensial terisi.
          </p>
        </div>

        {/* ===== status kredensial ===== */}
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          {SEMUA_PLATFORM.map((p) => {
            const data =
              p === 'INSTAGRAM'
                ? {
                    token: konfig.instagram.accessToken,
                    akun: konfig.instagram.igUserId,
                    akunLabel: 'Instagram User ID',
                  }
                : {
                    token: konfig.tiktok.accessToken,
                    akun: { ada: false },
                    akunLabel: 'Mode posting',
                  };
            const siap = data.token.ada && (p === 'TIKTOK' || data.akun.ada);

            return (
              <div key={p} className="kartu p-5">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-sm font-semibold text-abu-800">{LABEL_PLATFORM[p]}</h2>
                  <span
                    className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${
                      siap ? 'bg-sukses-bg text-sukses' : 'bg-abu-100 text-abu-500'
                    }`}
                  >
                    {siap ? 'siap' : 'belum lengkap'}
                  </span>
                </div>

                <dl className="mt-3 space-y-2 text-[11px]">
                  <div className="flex justify-between gap-3">
                    <dt className="text-abu-500">{data.akunLabel}</dt>
                    <dd className="font-mono text-abu-700">
                      {p === 'TIKTOK'
                        ? konfig.tiktok.modePrivasi
                        : data.akun.ada
                          ? `${data.akun.awal} (${data.akun.panjang} karakter)`
                          : '— belum diisi'}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-abu-500">Access token</dt>
                    <dd className="font-mono text-abu-700">
                      {data.token.ada
                        ? `${data.token.awal} (${data.token.panjang} karakter)`
                        : '— belum diisi'}
                    </dd>
                  </div>
                </dl>

                <p className="mt-3 text-[11px] text-abu-500 leading-relaxed">
                  {p === 'INSTAGRAM'
                    ? 'Syarat: akun Instagram Business/Creator yang terhubung ke Facebook Page, serta aplikasi Meta dengan izin instagram_content_publish.'
                    : 'Syarat: aplikasi TikTok Developer dengan Content Posting API. Selama app belum lolos review, TikTok hanya mengizinkan posting ke draft.'}
                </p>
              </div>
            );
          })}
        </div>

        {/* ===== batasan platform ===== */}
        <div className="mt-5 kartu p-5">
          <h2 className="text-sm font-semibold text-abu-800 mb-3">
            Batasan platform (divalidasi sebelum kirim)
          </h2>
          <div className="overflow-x-auto">
            <table className="tabel-sip">
              <thead>
                <tr>
                  <th>Platform</th>
                  <th>Berkas</th>
                  <th>Caption</th>
                  <th>Catatan</th>
                </tr>
              </thead>
              <tbody>
                {SEMUA_PLATFORM.map((p) => {
                  const b = BATAS_PLATFORM[p];
                  return (
                    <tr key={p}>
                      <td className="font-medium text-abu-900">{LABEL_PLATFORM[p]}</td>
                      <td className="text-xs text-abu-600">
                        {b.mimeDiizinkan.join(', ')}
                        {b.maksDurasiDetik && (
                          <span className="block text-abu-400">
                            durasi maks {Math.round(b.maksDurasiDetik / 60)} menit
                          </span>
                        )}
                      </td>
                      <td className="text-xs text-abu-600 tabular-nums">{b.maksCaption} karakter</td>
                      <td className="text-xs text-abu-600">{b.catatan}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* ===== penyimpanan ===== */}
        <div className="mt-5 kartu p-5">
          <h2 className="text-sm font-semibold text-abu-800 mb-3">Penyimpanan berkas</h2>
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <div className="label-kolom">Konten</div>
              <div className="mt-1.5 text-xl font-bold text-abu-900 tabular-nums">{total}</div>
              <div className="mt-0.5 text-[11px] text-abu-400">{pakaiBerkas} punya berkas</div>
            </div>
            <div>
              <div className="label-kolom">Total berkas</div>
              <div className="mt-1.5 text-xl font-bold text-abu-900 tabular-nums">
                {formatUkuran(totalByte)}
              </div>
              <div className="mt-0.5 text-[11px] text-abu-400">
                batas per berkas {formatUkuran(BATAS_MEDIA.videoMaksByte)} (video)
              </div>
            </div>
            <div>
              <div className="label-kolom">Diakses</div>
              <div className="mt-1.5 text-xl font-bold text-abu-900 tabular-nums">
                {jumlahDilihat._sum.mediaDilihat ?? 0}×
              </div>
              <div className="mt-0.5 text-[11px] text-abu-400">pembacaan berkas media</div>
            </div>
          </div>

          <p className="mt-4 text-[11px] text-abu-500 leading-relaxed">
            Berkas disimpan sebagai kolom di database (Postgres/Vercel tidak punya filesystem
            permanen). Ini cukup untuk video pendek berukuran beberapa MB, tetapi{' '}
            <strong>bukan tempatnya untuk video besar</strong>: kalau kolom ini membengkak, pindahkan
            penyimpanan ke object storage (mis. Vercel Blob / S3) — hanya{' '}
            <code className="font-mono">/sosmed/media/[id]</code> yang perlu diubah.
          </p>
        </div>

        {/* ===== catatan integrasi ===== */}
        <div className="mt-5 kartu p-5 border-l-[3px] border-peringatan">
          <h2 className="text-sm font-semibold text-peringatan mb-2">
            Belum selesai sebelum bisa dipakai produksi
          </h2>
          <ul className="space-y-2 text-xs text-abu-700 leading-relaxed list-disc pl-4">
            <li>
              <strong>URL media publik.</strong> TikTok & Instagram menarik berkas dari URL. Route{' '}
              <code className="font-mono">/sosmed/media/[id]</code> saat ini{' '}
              <em>memerlukan sesi login</em>, sehingga platform tidak bisa mengaksesnya. Untuk
              produksi perlu token sekali-pakai berumur pendek khusus pengiriman.
            </li>
            <li>
              <strong>Domain publik.</strong> Setel <code className="font-mono">NEXT_PUBLIC_APP_URL</code>{' '}
              ke alamat aplikasi, kalau tidak URL media akan menunjuk ke localhost.
            </li>
            <li>
              <strong>Refresh token.</strong> Access token Meta kedaluwarsa (~60 hari) dan TikTok
              memakai refresh token — belum ada pembaru otomatis.
            </li>
            <li>
              <strong>App review.</strong> TikTok Content Posting API & izin Meta perlu ditinjau
              platform sebelum unggahan nyata diizinkan.
            </li>
          </ul>
        </div>
      </div>
    </Kerangka>
  );
}
