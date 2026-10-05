/**
 * AKSES MODUL SOSMED — satu sumber kebenaran untuk "siapa boleh apa" pada
 * konten TikTok/Instagram.
 *
 * Kenapa terpisah dari src/lib/sip/akses.ts: berkas itu adalah gerbang
 * aplikasi (peran & halaman). Di sini yang ditentukan adalah CAKUPAN DATA
 * per baris konten — hal yang berbeda dan paling sering salah dikodekan
 * sebagai `role === 'MANAGER'`.
 *
 * ATURAN:
 *  - Kemampuan (hak ubah)  -> bolehEfek()
 *  - Cakupan data (hak baca) -> bolehLihatKonten() / saringKonten()
 *  - Hak per baris konten  -> bolehKonten()
 */

import type { StatusKonten } from './status';
import { bisaDiubah } from './status';
// impor relatif (bukan alias '@/') karena vitest proyek ini tidak punya
// resolve.alias untuk '@/' — semua test lain juga memakai jalur relatif.
import { boleh, type Kemampuan } from '../sip/akses';

export type Saya = { id: string; role: string };

/** Ringkas data konten yang dibutuhkan untuk memutuskan hak akses. */
export type KontenRingkas = {
  pembuatId: string;
  penyetujuId: string | null;
  status: StatusKonten;
};

/**
 * Pembungkus `boleh()` dari gerbang aplikasi.
 * Sengaja diberi nama berbeda supaya pemakaiannya di modul sosmed mudah dicari.
 */
export function bolehEfek(role: string, kemampuan: Kemampuan): boolean {
  return boleh(role, kemampuan);
}

/**
 * Boleh melihat SEMUA konten (semua kreator)?
 *
 * Ini kemampuan `lihat_semua_konten` — bukan `role === 'ADMIN'`. Dulu pola
 * `role === 'ADMIN'` untuk cakupan data membuat PENGAMAT kehilangan grafiknya;
 * pola yang sama jangan diulang di modul ini.
 */
export function lihatSemuaKonten(saya: Saya): boolean {
  return bolehEfek(saya.role, 'lihat_semua_konten');
}

/**
 * Apakah saya melihat konten ini di daftar?
 *
 * - pembuatnya            -> selalu
 * - penyetuju yang dikunci-> selalu (perlu untuk menyetujui)
 * - punya lihat_semua_konten -> selalu
 */
export function bolehLihatKonten(konten: KontenRingkas, saya: Saya): boolean {
  if (konten.pembuatId === saya.id) return true;
  if (konten.penyetujuId && konten.penyetujuId === saya.id) return true;
  return lihatSemuaKonten(saya);
}

export type AksiKonten = 'ubah' | 'hapus';

/**
 * Hak per baris konten.
 *
 * Aturan yang disengaja:
 *  - Konten yang sedang MENUNGGU tidak boleh diubah pembuatnya (harus ditarik
 *    dulu) — supaya yang disetujui benar-benar yang diperiksa penyetuju.
 *  - Konten yang sudah DIKIRIM/DIJADWALKAN tidak boleh dihapus siapa pun
 *    kecuali admin (jejak publikasi harus tetap ada).
 *  - Penyetuju tidak mengubah ISI konten; ia hanya memutuskan.
 */
export function bolehKonten(
  konten: KontenRingkas,
  saya: Saya,
  aksi: AksiKonten
): { boleh: true } | { boleh: false; alasan: string } {
  const admin = saya.role === 'ADMIN';
  const pemilik = konten.pembuatId === saya.id;

  if (aksi === 'ubah') {
    if (admin) return { boleh: true };
    if (!pemilik) {
      return {
        boleh: false,
        alasan: 'Hanya pembuat konten yang dapat mengubah isinya.',
      };
    }
    if (!bisaDiubah(konten.status)) {
      return {
        boleh: false,
        alasan:
          'Konten yang sedang menunggu persetujuan, sudah disetujui, atau sudah dikirim tidak dapat diubah. Tarik pengajuan (atau minta revisi dari penyetuju) terlebih dahulu.',
      };
    }
    return { boleh: true };
  }

  // aksi === 'hapus'
  if (admin) return { boleh: true };
  if (!pemilik) {
    return { boleh: false, alasan: 'Hanya pembuat konten yang dapat menghapusnya.' };
  }
  if (!bisaDiubah(konten.status)) {
    return {
      boleh: false,
      alasan:
        'Konten yang sudah diajukan/dikirim tidak dapat dihapus — arsipkan atau tarik dulu agar jejaknya tetap terlacak.',
    };
  }
  return { boleh: true };
}

/**
 * Saring daftar konten menurut cakupan. Dipakai di halaman & lib data supaya
 * klausa `where` hanya ditulis sekali.
 */
export function whereCakupan(saya: Saya) {
  if (lihatSemuaKonten(saya)) return {};
  return {
    OR: [{ pembuatId: saya.id }, { penyetujuId: saya.id }],
  };
}

/** Ringkasan jumlah konten per status untuk dasbor modul sosmed. */
export function hitungPerStatus(daftar: { status: string }[]) {
  const hasil: Record<string, number> = {};
  for (const k of daftar) hasil[k.status] = (hasil[k.status] ?? 0) + 1;
  return hasil;
}
