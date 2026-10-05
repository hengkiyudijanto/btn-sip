/**
 * KONTEN SOSMED — konstanta & aturan murni (tanpa Prisma).
 *
 * WAJIB: berkas ini TIDAK boleh mengimpor Prisma. Komponen klien ikut
 * memakainya, dan kalau ada impor Prisma di rantai ini, driver `pg` masuk ke
 * bundel browser lalu build gagal dengan "Can't resolve 'dns'" — pesannya
 * tidak menyebut Prisma sama sekali. Pola yang sama dipakai
 * src/lib/sip/pengajuan-konstanta.ts.
 *
 * Mesin transisi status ada di sini juga (fungsi murni) supaya bisa diuji
 * tanpa database: src/lib/sosmed/status.test.ts.
 */

// ===========================================================================
// Platform
// ===========================================================================

export const PLATFORM = {
  TIKTOK: 'TIKTOK',
  INSTAGRAM: 'INSTAGRAM',
} as const;

export type Platform = (typeof PLATFORM)[keyof typeof PLATFORM];

export const SEMUA_PLATFORM: Platform[] = [PLATFORM.TIKTOK, PLATFORM.INSTAGRAM];

export const LABEL_PLATFORM: Record<Platform, string> = {
  TIKTOK: 'TikTok',
  INSTAGRAM: 'Instagram',
};

/**
 * Batasan nyata tiap platform — dipakai untuk VALIDASI SEBELUM posting,
 * bukan sesudah. Angka ini adalah batas resmi API-nya:
 *
 * - TikTok: caption maks 2200 karakter; video maks 4 GB; durasi maks 10 menit.
 * - Instagram: caption maks 2200 karakter; feed image JPEG saja; carousel
 *   maks 10 item. Instagram Web API juga menolak video vertikal < 3 detik.
 *
 * Catatan penting yang harus disebut ke pemakai: Instagram TIDAK menerima
 * PNG/WebP untuk feed — kalau ada PNG, konversi ke JPEG dulu.
 */
export const BATAS_PLATFORM: Record<
  Platform,
  {
    maksCaption: number;
    maksBerkasByte: number;
    mimeDiizinkan: string[];
    maksDurasiDetik: number | null;
    /** Instagram menolak gambar selain JPEG untuk feed. */
    wajibJpegUntukGambar: boolean;
    catatan: string;
  }
> = {
  TIKTOK: {
    maksCaption: 2200,
    maksBerkasByte: 4 * 1024 * 1024 * 1024,
    mimeDiizinkan: ['video/mp4', 'video/quicktime', 'video/webm'],
    maksDurasiDetik: 600,
    wajibJpegUntukGambar: false,
    catatan:
      'TikTok hanya menerima video. Gambar tidak bisa diposting langsung ke TikTok.',
  },
  INSTAGRAM: {
    maksCaption: 2200,
    maksBerkasByte: 100 * 1024 * 1024,
    mimeDiizinkan: [
      'image/jpeg',
      'image/png',
      'image/webp',
      'video/mp4',
      'video/quicktime',
    ],
    maksDurasiDetik: 900,
    wajibJpegUntukGambar: true,
    catatan: 'Instagram feed hanya menerima gambar JPEG (bukan PNG/WebP).',
  },
};

// ===========================================================================
// Master konten: platform, jenis, status
// ===========================================================================

export const PLATFORM_TUJUAN = ['TIKTOK', 'INSTAGRAM', 'KEDUANYA'] as const;
export type PlatformTujuan = (typeof PLATFORM_TUJUAN)[number];

export const LABEL_PLATFORM_TUJUAN: Record<PlatformTujuan, string> = {
  TIKTOK: 'TikTok saja',
  INSTAGRAM: 'Instagram saja',
  KEDUANYA: 'TikTok & Instagram',
};

/** Platform mana saja yang jadi tujuan sebuah Konten. */
export function platformDariTujuan(t: PlatformTujuan): Platform[] {
  if (t === 'KEDUANYA') return [PLATFORM.TIKTOK, PLATFORM.INSTAGRAM];
  return [t];
}

export const JENIS_MEDIA = ['GAMBAR', 'VIDEO'] as const;
export type JenisMedia = (typeof JENIS_MEDIA)[keyof typeof JENIS_MEDIA];

/**
 * STATUS KONTEN — satu tahap approval, tapi bisa bolak-balik revisi.
 *
 *   DRAFT ──(kreator ajukan)──► MENUNGGU ──(approver setujui)──► DISETUJUI
 *     ▲                            │                                │
 *     └──(kreator/approver tarik)──┴──(approver minta revisi)────────┘
 *
 * DISETUJUI belum berarti terkirim: pengiriman ke TikTok/Instagram adalah
 * langkah terpisah (PUBLISH) supaya kegagalan platform tidak mengubah
 * keputusan approval.
 */
export const STATUS_KONTEN = [
  'DRAFT',
  'MENUNGGU',
  'REVISI',
  'DISETUJUI',
  'DIJADWALKAN',
  'DIKIRIM',
  'DIARSIPKAN',
] as const;

export type StatusKonten = (typeof STATUS_KONTEN)[number];

export const LABEL_STATUS: Record<StatusKonten, string> = {
  DRAFT: 'Draft',
  MENUNGGU: 'Menunggu Persetujuan',
  REVISI: 'Perlu Revisi',
  DISETUJUI: 'Disetujui',
  DIJADWALKAN: 'Dijadwalkan',
  DIKIRIM: 'Sudah Dikirim',
  DIARSIPKAN: 'Diarsipkan',
};

/** Warna lencana status (kelas Tailwind, sengaja literal agar ikut ter-scan). */
export const WARNA_STATUS: Record<StatusKonten, string> = {
  DRAFT: 'bg-abu-100 text-abu-700',
  MENUNGGU: 'bg-peringatan-bg text-peringatan',
  REVISI: 'bg-bahaya-bg text-bahaya',
  DISETUJUI: 'bg-btn-biru-100 text-btn-biru-700',
  DIJADWALKAN: 'bg-btn-biru-100 text-btn-biru-700',
  DIKIRIM: 'bg-sukses-bg text-sukses',
  DIARSIPKAN: 'bg-abu-100 text-abu-400',
};

// ===========================================================================
// Mesin transisi (murni)
// ===========================================================================

export type PeranTransisi = 'PEMILIK' | 'PENYETUJU';

export type PermintaanTransisi =
  | 'AJUKAN'
  | 'SETUJUI'
  | 'MINTA_REVISI'
  | 'TARIK'
  | 'PUBLISH'
  | 'JADWALKAN'
  | 'ARSIPKAN'
  | 'BATAL_JADWAL';

export type HasilTransisi =
  | { boleh: true; statusBaru: StatusKonten }
  | { boleh: false; alasan: string };

/**
 * Tabel transisi status. Dipakai server action DAN dipakai untuk menguji.
 * Kalau aturannya diubah, ubah di sini saja — halaman hanya menanyakan.
 */
export function transisiStatus(
  status: StatusKonten,
  aksi: PermintaanTransisi,
  peran: PeranTransisi
): HasilTransisi {
  const tolak = (alasan: string): HasilTransisi => ({ boleh: false, alasan });
  const boleh: (s: StatusKonten) => HasilTransisi = (s) => ({
    boleh: true,
    statusBaru: s,
  });

  switch (aksi) {
    case 'AJUKAN':
      if (peran !== 'PEMILIK') return tolak('Hanya pembuat konten yang dapat mengajukan.');
      return status === 'DRAFT' || status === 'REVISI'
        ? boleh('MENUNGGU')
        : tolak(
            `Konten berstatus ${LABEL_STATUS[status]} tidak dapat diajukan. Hanya draft atau konten yang perlu revisi.`
          );

    case 'TARIK':
      if (peran !== 'PEMILIK') return tolak('Hanya pembuat konten yang dapat menarik pengajuan.');
      return status === 'MENUNGGU'
        ? boleh('DRAFT')
        : tolak(`Konten berstatus ${LABEL_STATUS[status]} tidak sedang menunggu persetujuan.`);

    case 'SETUJUI':
      if (peran !== 'PENYETUJU') return tolak('Hanya penyetuju yang dapat menyetujui.');
      return status === 'MENUNGGU'
        ? boleh('DISETUJUI')
        : tolak(`Hanya konten yang menunggu persetujuan dapat disetujui (sekarang: ${LABEL_STATUS[status]}).`);

    case 'MINTA_REVISI':
      if (peran !== 'PENYETUJU') return tolak('Hanya penyetuju yang dapat meminta revisi.');
      return status === 'MENUNGGU' || status === 'DISETUJUI'
        ? boleh('REVISI')
        : tolak(`Konten berstatus ${LABEL_STATUS[status]} tidak dapat diminta revisi.`);

    case 'PUBLISH':
      if (peran !== 'PEMILIK' && peran !== 'PENYETUJU') return tolak('Tidak berwenang.');
      return status === 'DISETUJUI' || status === 'DIJADWALKAN'
        ? boleh('DIKIRIM')
        : tolak(
            `Hanya konten yang sudah DISETUJUI yang boleh dikirim ke platform (sekarang: ${LABEL_STATUS[status]}).`
          );

    case 'JADWALKAN':
      if (peran !== 'PEMILIK' && peran !== 'PENYETUJU') return tolak('Tidak berwenang.');
      return status === 'DISETUJUI'
        ? boleh('DIJADWALKAN')
        : tolak(`Hanya konten DISETUJUI yang dapat dijadwalkan (sekarang: ${LABEL_STATUS[status]}).`);

    case 'BATAL_JADWAL':
      if (peran !== 'PEMILIK' && peran !== 'PENYETUJU') return tolak('Tidak berwenang.');
      return status === 'DIJADWALKAN'
        ? boleh('DISETUJUI')
        : tolak('Konten ini tidak sedang dijadwalkan.');

    case 'ARSIPKAN':
      if (peran !== 'PEMILIK' && peran !== 'PENYETUJU') return tolak('Tidak berwenang.');
      return status === 'DRAFT' || status === 'REVISI'
        ? boleh('DIARSIPKAN')
        : tolak(
            `Konten berstatus ${LABEL_STATUS[status]} tidak dapat diarsipkan. Tarik dulu pengajuannya.`
          );
  }
}

/** Status yang masih boleh diubah kreatornya (judul, media, caption). */
export function bisaDiubah(status: StatusKonten): boolean {
  return status === 'DRAFT' || status === 'REVISI';
}

/** Status yang dihitung sebagai "pekerjaan selesai" di dasbor. */
const STATUS_SELESAI: StatusKonten[] = ['DIKIRIM'];

export function hitungRingkasan(jumlah: Partial<Record<StatusKonten, number>>) {
  let selesai = 0;
  let menunggu = 0;
  let perluTindakan = 0;
  for (const s of STATUS_KONTEN) {
    const n = jumlah[s] ?? 0;
    if (STATUS_SELESAI.includes(s)) selesai += n;
    if (s === 'MENUNGGU') menunggu += n;
    if (s === 'REVISI') perluTindakan += n;
  }
  return { selesai, menunggu, perluTindakan };
}

// ===========================================================================
// Validasi sebelum kirim ke platform (dipakai UI & adapters)
// ===========================================================================

export type MasalahKirim = { platform: Platform; pesan: string };

/**
 * Periksa kelayakan kirim SEBELUM memanggil platform. Mengembalikan daftar
 * masalah; kosong = aman dikirim.
 */
export function periksaKelayakan(input: {
  tujuan: PlatformTujuan;
  jenis: JenisMedia;
  caption: string;
  ukuranByte: number;
  mime: string;
  durasiDetik?: number | null;
}): MasalahKirim[] {
  const masalah: MasalahKirim[] = [];

  for (const platform of platformDariTujuan(input.tujuan)) {
    const batas = BATAS_PLATFORM[platform];

    if (platform === 'TIKTOK' && input.jenis === 'GAMBAR') {
      masalah.push({
        platform,
        pesan: `TikTok hanya menerima video. Ubah tujuan menjadi Instagram saja, atau unggah video.`,
      });
      continue;
    }

    if (input.caption.length > batas.maksCaption) {
      masalah.push({
        platform,
        pesan: `Caption ${input.caption.length} karakter, melebihi batas ${batas.maksCaption} karakter.`,
      });
    }

    if (input.ukuranByte > batas.maksBerkasByte) {
      masalah.push({
        platform,
        pesan: `Ukuran berkas terlalu besar (maks ${Math.round(batas.maksBerkasByte / 1024 / 1024)} MB).`,
      });
    }

    if (
      platform === 'INSTAGRAM' &&
      input.jenis === 'GAMBAR' &&
      batas.wajibJpegUntukGambar &&
      input.mime !== 'image/jpeg'
    ) {
      masalah.push({
        platform,
        pesan: `${batas.catatan} Berkas ini ${input.mime}.`,
      });
    }

    if (
      batas.maksDurasiDetik &&
      input.jenis === 'VIDEO' &&
      (input.durasiDetik ?? 0) > batas.maksDurasiDetik
    ) {
      masalah.push({
        platform,
        pesan: `Durasi video melebihi batas ${Math.round(batas.maksDurasiDetik / 60)} menit.`,
      });
    }
  }

  return masalah;
}

// ===========================================================================
// Kapitalisasi tampilan (aturan proyek: teks dari DB dirapikan sebelum tampil)
// ===========================================================================

/** Nama platform seperti yang tertulis di API platform. */
export function rapikanPlatform(p: string): string {
  const k = p.toUpperCase();
  if (k === 'INSTAGRAM') return 'Instagram';
  if (k === 'TIKTOK') return 'TikTok';
  return p;
}
