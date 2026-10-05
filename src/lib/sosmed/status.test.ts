import { describe, it, expect } from 'vitest';
import {
  transisiStatus,
  platformDariTujuan,
  periksaKelayakan,
  bisaDiubah,
  hitungRingkasan,
  BATAS_PLATFORM,
  type StatusKonten,
  type PermintaanTransisi,
} from './status';

/**
 * Mesin transisi status adalah kontrak alur approval. Kalau test ini merah,
 * tombol di UI akan mengizinkan hal yang seharusnya ditolak (atau sebaliknya),
 * jadi perbaiki di sini dulu — bukan di halaman.
 */
/**
 * Helper: menegaskan transisi BOLEH, lalu mengembalikan status barunya.
 * Dipakai supaya TypeScript bisa menyempitkan tipe union HasilTransisi
 * (akses `.statusBaru` langsung pada union akan ditolak compiler).
 */
function statusHasil(h: ReturnType<typeof transisiStatus>): StatusKonten {
  expect(h.boleh).toBe(true);
  if (!h.boleh) throw new Error('transisi ditolak: ' + h.alasan);
  return h.statusBaru;
}

describe('transisiStatus', () => {
  it('kreator mengajukan draft dan konten yang perlu revisi', () => {
    expect(transisiStatus('DRAFT', 'AJUKAN', 'PEMILIK')).toEqual({
      boleh: true,
      statusBaru: 'MENUNGGU',
    });
    expect(transisiStatus('REVISI', 'AJUKAN', 'PEMILIK')).toEqual({
      boleh: true,
      statusBaru: 'MENUNGGU',
    });
  });

  it('menolak pengajuan dari status yang tidak bisa diajukan', () => {
    for (const s of ['MENUNGGU', 'DISETUJUI', 'DIKIRIM', 'DIARSIPKAN'] as StatusKonten[]) {
      const hasil = transisiStatus(s, 'AJUKAN', 'PEMILIK');
      expect(hasil.boleh).toBe(false);
    }
  });

  it('penyetuju TIDAK boleh mengajukan, kreator TIDAK boleh menyetujui', () => {
    expect(transisiStatus('DRAFT', 'AJUKAN', 'PENYETUJU').boleh).toBe(false);
    expect(transisiStatus('MENUNGGU', 'SETUJUI', 'PEMILIK').boleh).toBe(false);
  });

  it('menyetujui hanya dari MENUNGGU', () => {
    expect(transisiStatus('MENUNGGU', 'SETUJUI', 'PENYETUJU')).toEqual({
      boleh: true,
      statusBaru: 'DISETUJUI',
    });
    expect(transisiStatus('DRAFT', 'SETUJUI', 'PENYETUJU').boleh).toBe(false);
    expect(transisiStatus('DISETUJUI', 'SETUJUI', 'PENYETUJU').boleh).toBe(false);
  });

  it('revisi bisa berkali-kali: MENUNGGU -> REVISI -> MENUNGGU -> REVISI', () => {
    expect(statusHasil(transisiStatus('MENUNGGU', 'MINTA_REVISI', 'PENYETUJU'))).toBe('REVISI');
    expect(statusHasil(transisiStatus('REVISI', 'AJUKAN', 'PEMILIK'))).toBe('MENUNGGU');
    expect(statusHasil(transisiStatus('MENUNGGU', 'MINTA_REVISI', 'PENYETUJU'))).toBe('REVISI');
  });

  it('revisi juga bisa diminta setelah disetujui selagi belum dikirim', () => {
    expect(transisiStatus('DISETUJUI', 'MINTA_REVISI', 'PENYETUJU')).toEqual({
      boleh: true,
      statusBaru: 'REVISI',
    });
    // tapi tidak setelah terkirim
    expect(transisiStatus('DIKIRIM', 'MINTA_REVISI', 'PENYETUJU').boleh).toBe(false);
  });

  it('tarik pengajuan hanya dari MENUNGGU dan hanya oleh pemilik', () => {
    expect(statusHasil(transisiStatus('MENUNGGU', 'TARIK', 'PEMILIK'))).toBe('DRAFT');
    expect(transisiStatus('DRAFT', 'TARIK', 'PEMILIK').boleh).toBe(false);
    expect(transisiStatus('MENUNGGU', 'TARIK', 'PENYETUJU').boleh).toBe(false);
  });

  it('pengiriman hanya boleh setelah disetujui (DISETUJUI atau DIJADWALKAN)', () => {
    expect(statusHasil(transisiStatus('DISETUJUI', 'PUBLISH', 'PEMILIK'))).toBe('DIKIRIM');
    expect(statusHasil(transisiStatus('DIJADWALKAN', 'PUBLISH', 'PEMILIK'))).toBe('DIKIRIM');
    for (const s of ['DRAFT', 'MENUNGGU', 'REVISI', 'DIKIRIM'] as StatusKonten[]) {
      expect(transisiStatus(s, 'PUBLISH', 'PEMILIK').boleh).toBe(false);
    }
  });

  it('yang belum disetujui tidak bisa dijual sebagai terkirim (aturan inti)', () => {
    const percobaan: StatusKonten[] = ['DRAFT', 'MENUNGGU', 'REVISI'];
    for (const s of percobaan) {
      for (const peran of ['PEMILIK', 'PENYETUJU'] as const) {
        expect(transisiStatus(s, 'PUBLISH', peran).boleh).toBe(false);
      }
    }
  });

  it('penjadwalan & pembatalan jadwal', () => {
    expect(statusHasil(transisiStatus('DISETUJUI', 'JADWALKAN', 'PEMILIK'))).toBe('DIJADWALKAN');
    expect(transisiStatus('MENUNGGU', 'JADWALKAN', 'PEMILIK').boleh).toBe(false);
    expect(statusHasil(transisiStatus('DIJADWALKAN', 'BATAL_JADWAL', 'PEMILIK'))).toBe('DISETUJUI');
    expect(transisiStatus('DISETUJUI', 'BATAL_JADWAL', 'PEMILIK').boleh).toBe(false);
  });

  it('arsip hanya untuk draft/revisi', () => {
    expect(statusHasil(transisiStatus('DRAFT', 'ARSIPKAN', 'PEMILIK'))).toBe('DIARSIPKAN');
    expect(statusHasil(transisiStatus('REVISI', 'ARSIPKAN', 'PEMILIK'))).toBe('DIARSIPKAN');
    expect(transisiStatus('MENUNGGU', 'ARSIPKAN', 'PEMILIK').boleh).toBe(false);
    expect(transisiStatus('DIKIRIM', 'ARSIPKAN', 'PENYETUJU').boleh).toBe(false);
  });

  it('setiap penolakan menyertakan alasan yang bisa dibaca', () => {
    const semuaStatus: StatusKonten[] = [
      'DRAFT',
      'MENUNGGU',
      'REVISI',
      'DISETUJUI',
      'DIJADWALKAN',
      'DIKIRIM',
      'DIARSIPKAN',
    ];
    const semuaAksi: PermintaanTransisi[] = [
      'AJUKAN',
      'SETUJUI',
      'MINTA_REVISI',
      'TARIK',
      'PUBLISH',
      'JADWALKAN',
      'ARSIPKAN',
      'BATAL_JADWAL',
    ];
    for (const s of semuaStatus) {
      for (const a of semuaAksi) {
        const h = transisiStatus(s, a, 'PEMILIK');
        if (!h.boleh) expect(h.alasan.length).toBeGreaterThan(10);
      }
    }
  });
});

describe('bisaDiubah', () => {
  it('hanya draft & revisi yang boleh diubah isinya', () => {
    expect(bisaDiubah('DRAFT')).toBe(true);
    expect(bisaDiubah('REVISI')).toBe(true);
    for (const s of ['MENUNGGU', 'DISETUJUI', 'DIJADWALKAN', 'DIKIRIM'] as StatusKonten[]) {
      expect(bisaDiubah(s)).toBe(false);
    }
  });
});

describe('platformDariTujuan', () => {
  it('KEDUANYA berarti dua platform, bukan satu', () => {
    expect(platformDariTujuan('KEDUANYA')).toEqual(['TIKTOK', 'INSTAGRAM']);
    expect(platformDariTujuan('TIKTOK')).toEqual(['TIKTOK']);
    expect(platformDariTujuan('INSTAGRAM')).toEqual(['INSTAGRAM']);
  });
});

describe('periksaKelayakan', () => {
  const dasar = {
    tujuan: 'INSTAGRAM' as const,
    jenis: 'GAMBAR' as const,
    caption: 'Caption normal',
    ukuranByte: 1024,
    mime: 'image/jpeg',
  };

  it('menolak gambar ke TikTok (TikTok hanya menerima video)', () => {
    const m = periksaKelayakan({ ...dasar, tujuan: 'TIKTOK' });
    expect(m).toHaveLength(1);
    expect(m[0].platform).toBe('TIKTOK');
    expect(m[0].pesan).toMatch(/video/i);
  });

  it('menolak PNG untuk Instagram dan menyebut JPEG sebagai gantinya', () => {
    const m = periksaKelayakan({ ...dasar, mime: 'image/png' });
    expect(m.some((x) => x.platform === 'INSTAGRAM' && /JPEG/i.test(x.pesan))).toBe(true);
  });

  it('lolos kalau JPEG ke Instagram dalam batas', () => {
    expect(periksaKelayakan(dasar)).toEqual([]);
  });

  it('menolak caption lebih dari 2200 karakter di semua platform', () => {
    const m = periksaKelayakan({ ...dasar, caption: 'a'.repeat(2201) });
    expect(m.map((x) => x.platform).sort()).toEqual(['INSTAGRAM']);
  });

  it('untuk tujuan KEDUANYA, gambar tetap ditolak karena TikTok', () => {
    const m = periksaKelayakan({ ...dasar, tujuan: 'KEDUANYA' });
    expect(m.some((x) => x.platform === 'TIKTOK')).toBe(true);
    expect(m.some((x) => x.platform === 'INSTAGRAM')).toBe(false);
  });

  it('video panjang melebihi batas durasi ditolak', () => {
    const m = periksaKelayakan({
      tujuan: 'TIKTOK',
      jenis: 'VIDEO',
      caption: 'x',
      ukuranByte: 1024,
      mime: 'video/mp4',
      durasiDetik: 700,
    });
    expect(m.some((x) => /durasi/i.test(x.pesan))).toBe(true);
  });

  it('video dalam batas lolos ke TikTok', () => {
    expect(
      periksaKelayakan({
        tujuan: 'TIKTOK',
        jenis: 'VIDEO',
        caption: 'x',
        ukuranByte: 1024,
        mime: 'video/mp4',
        durasiDetik: 30,
      })
    ).toEqual([]);
  });
});

describe('hitungRingkasan', () => {
  it('memisahkan terkirim, menunggu, dan yang perlu tindakan', () => {
    const r = hitungRingkasan({ DIKIRIM: 3, MENUNGGU: 2, REVISI: 1, DRAFT: 4 });
    expect(r).toEqual({ selesai: 3, menunggu: 2, perluTindakan: 1 });
  });

  it('aman untuk data kosong', () => {
    expect(hitungRingkasan({})).toEqual({ selesai: 0, menunggu: 0, perluTindakan: 0 });
  });
});
