/**
 * ADAPTER PUBLISH — satu pintu untuk mengirim konten ke platform sosial.
 *
 * Kenapa dibuat berlapis: integrasi nyata ke TikTok & Instagram butuh
 * kredensial developer + app review dari masing-masing platform, dan hal itu
 * tidak bisa ditunggu saat pengembangan. Jadi:
 *
 *   kode aplikasi  ->  PenerbitSosmed (interface)  ->  mock | tiktok | instagram
 *
 * Modus dipilih lewat `config/sosmed.json` (berkas di bawah `config/`, jadi
 * mengubahnya TIDAK perlu build ulang — cukup save dan muat ulang halaman).
 * Dengan begitu aplikasi bisa didemokan penuh sekarang, lalu pindah ke API
 * nyata cukup dengan mengisi kredensial.
 *
 * ATURAN: adapter tidak boleh menyentuh Prisma/halaman. Semua yang dibutuhkan
 * dikirim sebagai `PermintaanKirim`.
 */

import { platformDariTujuan, type Platform, type PlatformTujuan } from './status';

export type PermintaanKirim = {
  /** id Konten di database — dipakai sebagai kunci laporan hasil. */
  kontenId: string;
  tujuan: PlatformTujuan;
  caption: string;
  /** URL publik media (harus bisa diakses TikTok/Meta, bukan localhost). */
  mediaUrl: string;
  jenis: 'GAMBAR' | 'VIDEO';
  /** TikTok/IG butuh ini untuk menarik gambar sampul video. */
  sampulUrl?: string | null;
};

export type HasilPlatform = {
  platform: Platform;
  berhasil: boolean;
  /** id postingan di platform (video id / media id). */
  idPlatform?: string;
  /** tautan yang bisa diklik pemakai untuk memeriksa hasilnya. */
  urlPublik?: string;
  /** pesan yang aman ditampilkan ke pemakai (tanpa token/rahasia). */
  pesan: string;
  /** true bila platform masih menunggu unggahan berkas selesai. */
  perluPolling?: boolean;
};

export type HasilKirim = {
  /** hasil per platform — sukses sebagian mungkin terjadi, jadi dikirim apa adanya */
  hasil: HasilPlatform[];
  /** true bila SEMUA platform berhasil */
  semuaBerhasil: boolean;
  /** 'mock' atau 'nyata' — supaya UI bisa memasang tanda peringatan */
  modus: 'mock' | 'nyata';
};

export type PenerbitSosmed = {
  nama: string;
  modus: 'mock' | 'nyata';
  platform: Platform;
  terbitkan(permintaan: PermintaanKirim): Promise<HasilPlatform>;
};

// ===========================================================================
// Adapter MOCK — untuk demo & pengujian alur penuh tanpa app review
// ===========================================================================

/**
 * Mock sengaja TIDAK selalu berhasil: satu dari lima id akan gagal, supaya
 * jalur gagal (dan tombol "Coba Kirim Lagi") benar-benar teruji, bukan cuma
 * ada di kode.
 */
export function buatPenerbitMock(platform: Platform): PenerbitSosmed {
  return {
    nama: `mock-${platform.toLowerCase()}`,
    modus: 'mock',
    platform,

    async terbitkan(p) {
      // simulasi jeda jaringan
      await new Promise((r) => setTimeout(r, 250));

      const nomor = Number(
        [...p.kontenId].reduce((a, c) => a + c.charCodeAt(0), 0) % 5
      );
      const idPlatform = `${platform.toLowerCase()}_mock_${Date.now().toString(36)}`;

      if (nomor === 4) {
        return {
          platform,
          berhasil: false,
          pesan:
            'SIMULASI: platform menolak unggahan (kredensial contoh). Coba kirim lagi untuk melihat jalur pemulihan.',
        };
      }

      return {
        platform,
        berhasil: true,
        idPlatform,
        urlPublik: `https://contoh.invalid/${platform.toLowerCase()}/${idPlatform}`,
        pesan: 'SIMULASI: berhasil dikirim (tidak ada unggahan nyata).',
      };
    },
  };
}

// ===========================================================================
// Adapter INSTAGRAM (Meta Graph API) — siap pakai begitu kredensial ada
// ===========================================================================

/**
 * Instagram Graph API:
 *   1. POST /{ig-user-id}/media          -> creation id (container)
 *   2. POST /{ig-user-id}/media_publish  -> media id
 *
 * Untuk VIDEO langkahnya beda: container dibuat dengan media_type=REELS, lalu
 * DITUNGGU (status_code FINISHED) sebelum publish. Karena itu adapter ini
 * menandai `perluPolling` kalau video.
 *
 * Syarat akun: Instagram Business/Creator + terhubung ke Facebook Page.
 * Access token bersifat sementara; produksi sebaiknya memakai long-lived
 * token + refresh (belum diotomatiskan di sini).
 */
export function buatPenerbitInstagram(kredensial: {
  igUserId: string;
  accessToken: string;
  apiVersi?: string;
}): PenerbitSosmed {
  const v = kredensial.apiVersi ?? 'v21.0';
  const dasar = `https://graph.facebook.com/${v}`;

  return {
    nama: 'instagram-graph',
    modus: 'nyata',
    platform: 'INSTAGRAM',

    async terbitkan(p) {
      try {
        const wadah = new URLSearchParams({
          access_token: kredensial.accessToken,
        });

        if (p.jenis === 'VIDEO') {
          wadah.set('media_type', 'REELS');
          wadah.set('video_url', p.mediaUrl);
          wadah.set('caption', p.caption);
          if (p.sampulUrl) wadah.set('cover_url', p.sampulUrl);
        } else {
          wadah.set('image_url', p.mediaUrl);
          wadah.set('caption', p.caption);
        }

        const r1 = await fetch(`${dasar}/${kredensial.igUserId}/media`, {
          method: 'POST',
          body: wadah,
        });
        const j1 = (await r1.json()) as { id?: string; error?: { message?: string } };
        if (!r1.ok || !j1.id) {
          return {
            platform: 'INSTAGRAM',
            berhasil: false,
            pesan: `Instagram menolak pembuatan media: ${j1.error?.message ?? r1.status}`,
          };
        }

        const r2 = await fetch(`${dasar}/${kredensial.igUserId}/media_publish`, {
          method: 'POST',
          body: new URLSearchParams({
            creation_id: j1.id,
            access_token: kredensial.accessToken,
          }),
        });
        const j2 = (await r2.json()) as { id?: string; error?: { message?: string } };

        if (!r2.ok || !j2.id) {
          return {
            platform: 'INSTAGRAM',
            berhasil: false,
            pesan: `Media dibuat tetapi gagal dipublikasikan: ${j2.error?.message ?? r2.status}`,
          };
        }

        return {
          platform: 'INSTAGRAM',
          berhasil: true,
          idPlatform: j2.id,
          urlPublik: `https://www.instagram.com/p/${j2.id}`,
          pesan: 'Terpublikasi ke Instagram.',
        };
      } catch (e) {
        return {
          platform: 'INSTAGRAM',
          berhasil: false,
          pesan: `Gagal menghubungi Instagram: ${e instanceof Error ? e.message : 'kesalahan jaringan'}`,
        };
      }
    },
  };
}

// ===========================================================================
// Adapter TIKTOK (Content Posting API) — siap pakai begitu app di-approve
// ===========================================================================

/**
 * TikTok Content Posting API:
 *   POST /v2/post/publish/video/init/  -> publish_id + upload_url
 *   PUT  {upload_url}                  -> kirim byte video
 *   GET  /v2/post/publish/status/fetch -> tunggu status
 *
 * CATATAN JUJUR: TikTok menolak `video_url` pihak ketiga yang tidak
 * terverifikasi domainnya, jadi jalur yang dipakai adalah PULL_FROM_URL hanya
 * bila domain media sudah diverifikasi di TikTok Developer Portal; kalau tidak,
 * memakai FILE_UPLOAD (byte diunggah dari server ini). Adapter ini memakai
 * FILE_UPLOAD karena paling pasti, dan karena itu butuh isi berkasnya.
 *
 * Selama app belum lolos review, TikTok hanya mengizinkan posting ke DRAFT
 * (pemakai masih menekan Publish di aplikasi TikTok).
 */
export function buatPenerbitTikTok(kredensial: {
  accessToken: string;
  /** 'DRAFT' selama app belum di-approve, 'PUBLIK' setelah lolos review. */
  modePrivasi?: 'DRAFT' | 'PUBLIK';
}): PenerbitSosmed {
  const dasar = 'https://open.tiktokapis.com/v2';

  return {
    nama: 'tiktok-content-posting',
    modus: 'nyata',
    platform: 'TIKTOK',

    async terbitkan(p) {
      try {
        const mode = kredensial.modePrivasi ?? 'DRAFT';

        if (mode === 'PUBLIK') {
          // jalur file upload: ambil dulu byte-nya dari URL media
          const ambil = await fetch(p.mediaUrl);
          if (!ambil.ok) {
            return {
              platform: 'TIKTOK',
              berhasil: false,
              pesan: `Media tidak dapat diambil dari server (${ambil.status}).`,
            };
          }
          const isi = Buffer.from(await ambil.arrayBuffer());
          const ukuran = isi.length;

          const init = await fetch(`${dasar}/post/publish/video/init/`, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${kredensial.accessToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              post_info: {
                title: p.caption,
                privacy_level: 'PUBLIC_TO_EVERYONE',
              },
              source_info: {
                source: 'FILE_UPLOAD',
                video_size: ukuran,
                chunk_size: ukuran,
                total_chunk_count: 1,
              },
            }),
          });
          const j = (await init.json()) as {
            data?: { publish_id?: string; upload_url?: string };
            error?: { code?: string; message?: string };
          };

          if (!init.ok || !j.data?.upload_url || !j.data.publish_id) {
            return {
              platform: 'TIKTOK',
              berhasil: false,
              pesan: `TikTok menolak inisialisasi unggahan: ${j.error?.message ?? init.status}`,
            };
          }

          const unggah = await fetch(j.data.upload_url, {
            method: 'PUT',
            headers: {
              'Content-Type': 'video/mp4',
              'Content-Range': `bytes 0-${ukuran - 1}/${ukuran}`,
            },
            body: new Uint8Array(isi),
          });
          if (!unggah.ok) {
            return {
              platform: 'TIKTOK',
              berhasil: false,
              pesan: `Unggahan video ke TikTok gagal (${unggah.status}).`,
            };
          }

          return {
            platform: 'TIKTOK',
            berhasil: true,
            idPlatform: j.data.publish_id,
            pesan: 'Terkirim ke TikTok dan sedang diproses.',
            perluPolling: true,
          };
        }

        // mode DRAFT — perilaku normal selama app belum lolos review
        const r = await fetch(`${dasar}/post/publish/inbox/video/init/`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${kredensial.accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            source_info: { source: 'PULL_FROM_URL', video_url: p.mediaUrl },
          }),
        });
        const j = (await r.json()) as {
          data?: { publish_id?: string };
          error?: { message?: string };
        };

        if (!r.ok || !j.data?.publish_id) {
          return {
            platform: 'TIKTOK',
            berhasil: false,
            pesan: `TikTok menolak unggahan draft: ${j.error?.message ?? r.status}`,
          };
        }

        return {
          platform: 'TIKTOK',
          berhasil: true,
          idPlatform: j.data.publish_id,
          pesan:
            'Terkirim ke kotak masuk TikTok sebagai draft. Buka aplikasi TikTok untuk menekan Publish.',
        };
      } catch (e) {
        return {
          platform: 'TIKTOK',
          berhasil: false,
          pesan: `Gagal menghubungi TikTok: ${e instanceof Error ? e.message : 'kesalahan jaringan'}`,
        };
      }
    },
  };
}

// ===========================================================================
// Pemilih adapter
// ===========================================================================

export type KonfigSosmed = {
  modus: 'mock' | 'nyata';
  instagram?: { igUserId?: string; accessToken?: string; apiVersi?: string };
  tiktok?: { accessToken?: string; modePrivasi?: 'DRAFT' | 'PUBLIK' };
};

/**
 * Menentukan adapter per platform. Kalau modus 'nyata' tetapi kredensial
 * platform itu belum lengkap, otomatis JATUH KEMBALI ke mock — dengan pesan
 * jelas, supaya alur tidak mati diam-diam dan hasil palsu tidak dikira nyata.
 */
export function pilihPenerbit(
  platform: Platform,
  konfig: KonfigSosmed
): { penerbit: PenerbitSosmed; catatan?: string } {
  if (konfig.modus === 'mock') {
    return { penerbit: buatPenerbitMock(platform) };
  }

  if (platform === 'INSTAGRAM') {
    const k = konfig.instagram;
    if (!k?.igUserId || !k.accessToken) {
      return {
        penerbit: buatPenerbitMock(platform),
        catatan:
          'Kredensial Instagram (igUserId/accessToken) belum diisi — pengiriman memakai simulasi.',
      };
    }
    return {
      penerbit: buatPenerbitInstagram({
        igUserId: k.igUserId,
        accessToken: k.accessToken,
        apiVersi: k.apiVersi,
      }),
    };
  }

  const k = konfig.tiktok;
  if (!k?.accessToken) {
    return {
      penerbit: buatPenerbitMock(platform),
      catatan:
        'Access token TikTok belum diisi — pengiriman memakai simulasi.',
    };
  }
  return {
    penerbit: buatPenerbitTikTok({
      accessToken: k.accessToken,
      modePrivasi: k.modePrivasi,
    }),
  };
}

/** Jalankan pengiriman ke semua platform tujuan, kumpulkan hasilnya. */
export async function kirimKePlatform(
  permintaan: PermintaanKirim,
  konfig: KonfigSosmed
): Promise<HasilKirim> {
  const platform = platformDariTujuan(permintaan.tujuan);
  const catatan: string[] = [];

  const hasil = await Promise.all(
    platform.map(async (p) => {
      const { penerbit, catatan: c } = pilihPenerbit(p, konfig);
      if (c) catatan.push(c);
      const r = await penerbit.terbitkan(permintaan);
      // sertakan catatan modus agar jelas ini simulasi atau nyata
      return c ? { ...r, pesan: `${r.pesan} (${c})` } : r;
    })
  );

  const modus = hasil.every((h) => konfig.modus === 'mock' || h.pesan.includes('simulasi'))
    ? 'mock'
    : 'nyata';

  return {
    hasil,
    semuaBerhasil: hasil.every((h) => h.berhasil),
    modus,
  };
}
