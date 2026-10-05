/**
 * Mediasi berkas media konten sosmed — metode yang SAMA dengan foto pegawai:
 * dikompres di peramban dulu, dikirim sebagai data URL, diverifikasi ulang di
 * server.
 *
 * Kenapa tidak unggah langsung ke TikTok/Instagram dari peramban?
 * Karena API keduanya meminta URL PUBLIK, bukan berkas. Jadi alurnya:
 *   peramban (kompres) -> server (simpan) -> /sosmed/media/[id] (URL publik) -> API platform
 *
 * Berbeda dengan foto pegawai yang dibatasi 80 KB / 3:4, di sini batasnya
 * jauh lebih longgar karena video/gambar konten memang besar.
 */

export const BATAS_MEDIA = {
  /** gambar: 8 MB akhir (data URL ± 10,7 MB) */
  gambarMaksByte: 8 * 1024 * 1024,
  /**
   * video: TIDAK dikompres di peramban (tidak ada encoder yang layak di HP
   * pegawai). Ini batas praktis untuk database Postgres/Vercel — di atas ini
   * sebaiknya pakai object storage, bukan kolom database.
   */
  videoMaksByte: 20 * 1024 * 1024,
  /** batas panjang data URL yang diterima server (base64 = 1,37x byte) */
  maksDataUrl: 28 * 1024 * 1024,
  /** lebar maksimum gambar setelah kompresi */
  gambarLebar: 1440,
};

export type HasilMedia = {
  dataUrl: string;
  mime: string;
  byte: number;
  lebar: number;
  tinggi: number;
  durasiDetik: number | null;
  jenis: 'GAMBAR' | 'VIDEO';
};

/** Perkirakan byte dari data URL (base64 memakai 4 karakter per 3 byte). */
export function ukuranDataUrl(dataUrl: string): number {
  const i = dataUrl.indexOf(',');
  if (i < 0) return 0;
  const b64 = dataUrl.slice(i + 1);
  const padding = b64.endsWith('==') ? 2 : b64.endsWith('=') ? 1 : 0;
  return Math.floor((b64.length * 3) / 4) - padding;
}

/** Format ukuran untuk tampilan (Bahasa Indonesia). */
export function formatUkuran(byte: number): string {
  if (byte >= 1024 * 1024) return `${(byte / 1024 / 1024).toFixed(1)} MB`;
  if (byte >= 1024) return `${Math.round(byte / 1024)} KB`;
  return `${byte} B`;
}

function bacaGambar(berkas: File): Promise<HTMLImageElement> {
  return new Promise((selesai, gagal) => {
    const url = URL.createObjectURL(berkas);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      selesai(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      gagal(new Error('Gambar tidak dapat dibaca.'));
    };
    img.src = url;
  });
}

/**
 * Kompres gambar: perkecil sampai sisi terpanjang <= BATAS_MEDIA.gambarLebar,
 * lalu turunkan mutu JPEG sampai di bawah batas byte.
 *
 * PENTING — Instagram: kalau sumbernya PNG/WebP, keluaran di sini SELALU
 * JPEG. Instagram feed menolak PNG, dan mengonversi di server berarti perlu
 * pustaka encoder tambahan (sharp) di jalur permintaan yang lambat.
 */
export async function kompresGambar(berkas: File): Promise<HasilMedia> {
  if (!berkas.type.startsWith('image/')) {
    throw new Error('Berkas gambar harus JPG, PNG, atau WebP.');
  }

  const img = await bacaGambar(berkas);
  const skala = Math.min(1, BATAS_MEDIA.gambarLebar / Math.max(img.width, img.height));
  const lebar = Math.max(1, Math.round(img.width * skala));
  const tinggi = Math.max(1, Math.round(img.height * skala));

  const kanvas = document.createElement('canvas');
  kanvas.width = lebar;
  kanvas.height = tinggi;
  const ctx = kanvas.getContext('2d');
  if (!ctx) throw new Error('Peramban tidak mendukung pengolahan gambar.');
  ctx.drawImage(img, 0, 0, lebar, tinggi);

  let mutu = 0.86;
  let dataUrl = kanvas.toDataURL('image/jpeg', mutu);
  // turunkan mutu bertahap sampai ukurannya masuk
  while (ukuranDataUrl(dataUrl) > BATAS_MEDIA.gambarMaksByte && mutu > 0.35) {
    mutu -= 0.1;
    dataUrl = kanvas.toDataURL('image/jpeg', mutu);
  }

  const byte = ukuranDataUrl(dataUrl);
  if (byte > BATAS_MEDIA.gambarMaksByte) {
    throw new Error(
      `Gambar masih ${formatUkuran(byte)} setelah dikompres. Maksimum ${formatUkuran(BATAS_MEDIA.gambarMaksByte)}.`
    );
  }

  return {
    dataUrl,
    mime: 'image/jpeg',
    byte,
    lebar,
    tinggi,
    durasiDetik: null,
    jenis: 'GAMBAR',
  };
}

/** Baca metadata video tanpa mengubah isinya (durasi dibutuhkan validasi). */
export function bacaVideo(berkas: File): Promise<HasilMedia> {
  return new Promise((selesai, gagal) => {
    if (!berkas.type.startsWith('video/')) {
      gagal(new Error('Berkas harus berupa video MP4/MOV.'));
      return;
    }
    if (berkas.size > BATAS_MEDIA.videoMaksByte) {
      gagal(
        new Error(
          `Video ${formatUkuran(berkas.size)} melebihi batas ${formatUkuran(BATAS_MEDIA.videoMaksByte)}.`
        )
      );
      return;
    }

    const url = URL.createObjectURL(berkas);
    const v = document.createElement('video');
    v.preload = 'metadata';

    const bersihkan = () => URL.revokeObjectURL(url);

    v.onloadedmetadata = () => {
      const durasi = Number.isFinite(v.duration) ? v.duration : null;
      const lebar = v.videoWidth;
      const tinggi = v.videoHeight;
      const pembaca = new FileReader();
      pembaca.onload = () => {
        bersihkan();
        selesai({
          dataUrl: String(pembaca.result),
          mime: berkas.type || 'video/mp4',
          byte: berkas.size,
          lebar,
          tinggi,
          durasiDetik: durasi,
          jenis: 'VIDEO',
        });
      };
      pembaca.onerror = () => {
        bersihkan();
        gagal(new Error('Video tidak dapat dibaca.'));
      };
      pembaca.readAsDataURL(berkas);
    };

    v.onerror = () => {
      bersihkan();
      gagal(new Error('Video tidak dapat dibaca (format tidak didukung peramban).'));
    };

    v.src = url;
  });
}

/** Pilih jalur yang tepat berdasarkan jenis berkas. */
export async function siapkanMedia(berkas: File): Promise<HasilMedia> {
  if (berkas.type.startsWith('video/')) return bacaVideo(berkas);
  return kompresGambar(berkas);
}
