/**
 * Konfigurasi modus pengiriman sosmed.
 *
 * Dibaca dari berkas (bukan env) supaya bisa diubah TANPA build ulang:
 *   config/sosmed.json
 *
 * Contoh isi:
 * {
 *   "modus": "nyata",
 *   "instagram": { "igUserId": "17841400...", "accessToken": "EAAG..." },
 *   "tiktok":    { "accessToken": "act.xxx", "modePrivasi": "DRAFT" }
 * }
 *
 * Berkas ini TIDAK ikut git (berisi token), lihat .gitignore.
 */

import fs from 'node:fs';
import path from 'node:path';
import type { KonfigSosmed } from './penerbit';

const LOKASI = path.join(process.cwd(), 'config', 'sosmed.json');

/** Isi awal kalau berkas belum ada: simulasi penuh, aman dijalankan siapa pun. */
const BAWAAN: KonfigSosmed = { modus: 'mock' };

export function bacaKonfigSosmed(): KonfigSosmed {
  try {
    if (!fs.existsSync(LOKASI)) return BAWAAN;
    const mentah = fs.readFileSync(LOKASI, 'utf8');
    const isi = JSON.parse(mentah) as Partial<KonfigSosmed>;

    // validasi longgar: modus harus salah satu, sisanya diteruskan
    const modus = isi.modus === 'nyata' ? 'nyata' : 'mock';
    return {
      modus,
      instagram: isi.instagram,
      tiktok: isi.tiktok,
    };
  } catch (e) {
    console.error('[sosmed] gagal membaca config/sosmed.json:', e);
    return BAWAAN;
  }
}

/**
 * Ringkasan untuk halaman /sosmed/pengaturan — TIDAK pernah memuat token,
 * hanya menyatakan ada/tidak ada dan panjangnya.
 */
export function ringkasKonfig() {
  const k = bacaKonfigSosmed();
  const potong = (s?: string) =>
    s ? { ada: true, panjang: s.length, awal: s.slice(0, 4) + '…' } : { ada: false };

  return {
    modus: k.modus,
    lokasi: LOKASI,
    instagram: {
      igUserId: potong(k.instagram?.igUserId),
      accessToken: potong(k.instagram?.accessToken),
      apiVersi: k.instagram?.apiVersi ?? 'v21.0',
    },
    tiktok: {
      accessToken: potong(k.tiktok?.accessToken),
      modePrivasi: k.tiktok?.modePrivasi ?? 'DRAFT',
    },
  };
}
