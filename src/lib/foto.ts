/**
 * Kompresi foto pegawai di sisi browser sebelum dikirim ke server.
 *
 * Alasan: foto dari kamera HP bisa 2-5 MB, padahal yang dibutuhkan hanya
 * 3x4 untuk laporan. Mengirim file besar membebani koneksi pegawai dan
 * memperlambat penyimpanan.
 *
 * Hasil akhir: JPEG ~300x400 px, target ≤ 80 KB.
 */

export const UKURAN_FOTO = {
  /** rasio 3:4 */
  lebar: 300,
  tinggi: 400,
  /** batas ukuran file (byte) setelah kompresi */
  maksByte: 80 * 1024,
};

export type HasilKompresi = {
  dataUrl: string;
  lebar: number;
  tinggi: number;
  byte: number;
  mime: string;
};

/** Perkirakan ukuran byte dari data URL base64. */
export function ukuranDataUrl(dataUrl: string): number {
  const i = dataUrl.indexOf(',');
  if (i < 0) return 0;
  const b64 = dataUrl.slice(i + 1);
  // base64: 4 karakter mewakili 3 byte; kurangi padding
  const padding = b64.endsWith('==') ? 2 : b64.endsWith('=') ? 1 : 0;
  return Math.floor((b64.length * 3) / 4) - padding;
}

/**
 * Kompres gambar menjadi JPEG 3:4 dengan pemotongan tengah (center crop)
 * supaya wajah tetap di tengah dan rasio konsisten.
 */
export async function kompresFoto(
  berkas: File,
  opsi: { lebar?: number; tinggi?: number; kualitas?: number } = {}
): Promise<HasilKompresi> {
  const lebarTarget = opsi.lebar ?? UKURAN_FOTO.lebar;
  const tinggiTarget = opsi.tinggi ?? UKURAN_FOTO.tinggi;

  if (!berkas.type.startsWith('image/')) {
    throw new Error('Berkas harus berupa gambar (JPG atau PNG).');
  }

  const bitmap = await bacaGambar(berkas);

  // sumber: potong tengah sesuai rasio target
  const rasioTarget = lebarTarget / tinggiTarget;
  const rasioAsal = bitmap.width / bitmap.height;

  let sx = 0;
  let sy = 0;
  let sw = bitmap.width;
  let sh = bitmap.height;

  if (rasioAsal > rasioTarget) {
    // gambar terlalu lebar -> potong kiri-kanan
    sw = Math.round(bitmap.height * rasioTarget);
    sx = Math.round((bitmap.width - sw) / 2);
  } else {
    // gambar terlalu tinggi -> potong atas-bawah
    sh = Math.round(bitmap.width / rasioTarget);
    sy = Math.round((bitmap.height - sh) / 2);
  }

  const canvas = document.createElement('canvas');
  canvas.width = lebarTarget;
  canvas.height = tinggiTarget;

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Peramban tidak mendukung pemrosesan gambar.');

  // latar putih supaya PNG transparan tidak jadi hitam di JPEG
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, lebarTarget, tinggiTarget);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bitmap, sx, sy, sw, sh, 0, 0, lebarTarget, tinggiTarget);

  if ('close' in bitmap && typeof bitmap.close === 'function') bitmap.close();

  // turunkan kualitas bertahap sampai ukuran di bawah batas
  let dataUrl = canvas.toDataURL('image/jpeg', opsi.kualitas ?? 0.85);
  let byte = ukuranDataUrl(dataUrl);

  for (const kualitas of [0.75, 0.65, 0.55, 0.45]) {
    if (byte <= UKURAN_FOTO.maksByte) break;
    dataUrl = canvas.toDataURL('image/jpeg', kualitas);
    byte = ukuranDataUrl(dataUrl);
  }

  return {
    dataUrl,
    lebar: lebarTarget,
    tinggi: tinggiTarget,
    byte,
    mime: 'image/jpeg',
  };
}

/** Baca berkas jadi bitmap — pakai createImageBitmap kalau tersedia. */
async function bacaGambar(berkas: File): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(berkas, { imageOrientation: 'from-image' });
    } catch {
      // jatuh ke cara lama kalau createImageBitmap gagal
    }
  }

  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(berkas);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Gambar tidak dapat dibaca.'));
    };
    img.src = url;
  });
}

/** Format ukuran byte jadi teks yang mudah dibaca. */
export function formatUkuran(byte: number): string {
  if (byte < 1024) return `${byte} B`;
  if (byte < 1024 * 1024) return `${(byte / 1024).toFixed(0)} KB`;
  return `${(byte / 1024 / 1024).toFixed(1)} MB`;
}
