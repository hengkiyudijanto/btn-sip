import { describe, it, expect } from 'vitest';
import { bolehKonten, bolehLihatKonten, whereCakupan, lihatSemuaKonten } from './akses';
import type { StatusKonten } from './status';

/**
 * Cakupan data adalah sumber bug paling sering di proyek ini (pernah membuat
 * grafik PENGAMAT kosong karena memakai `role === 'ADMIN'`). Test ini mengunci
 * aturannya agar tidak terulang di modul sosmed.
 */

const KREATOR = { id: 'u-kreator', role: 'SUPERVISOR' };
const PENYETUJU = { id: 'u-penyetuju', role: 'MANAGER' };
const ADMIN = { id: 'u-admin', role: 'ADMIN' };
const ORANG_LAIN = { id: 'u-lain', role: 'PEGAWAI' };
const PENGAMAT = { id: 'u-pengamat', role: 'PENGAMAT' };

const konten = (pembuatId: string, penyetujuId: string | null, status: StatusKonten) => ({
  pembuatId,
  penyetujuId,
  status,
});

describe('lihatSemuaKonten', () => {
  it('memakai kemampuan, bukan nama peran', () => {
    expect(lihatSemuaKonten(ADMIN)).toBe(true);
    expect(lihatSemuaKonten(PENGAMAT)).toBe(true);
    expect(lihatSemuaKonten(KREATOR)).toBe(false);
    expect(lihatSemuaKonten(ORANG_LAIN)).toBe(false);
  });
});

describe('bolehLihatKonten', () => {
  it('pembuat selalu melihat kontennya, apa pun statusnya', () => {
    for (const s of ['DRAFT', 'MENUNGGU', 'REVISI', 'DISETUJUI', 'DIKIRIM'] as StatusKonten[]) {
      expect(bolehLihatKonten(konten(KREATOR.id, null, s), KREATOR)).toBe(true);
    }
  });

  it('penyetuju yang ditunjuk melihatnya walau bukan pembuatnya', () => {
    expect(bolehLihatKonten(konten(KREATOR.id, PENYETUJU.id, 'MENUNGGU'), PENYETUJU)).toBe(true);
  });

  it('pegawai biasa tidak melihat konten orang lain', () => {
    expect(bolehLihatKonten(konten(KREATOR.id, null, 'DRAFT'), ORANG_LAIN)).toBe(false);
  });
});

describe('whereCakupan', () => {
  it('cakupan sempit memuat konten sendiri ATAU yang ditugaskan ke saya', () => {
    const w = whereCakupan(ORANG_LAIN);
    expect(w).toEqual({
      OR: [{ pembuatId: ORANG_LAIN.id }, { penyetujuId: ORANG_LAIN.id }],
    });
  });

  it('cakupan luas tidak menyaring apa pun', () => {
    expect(whereCakupan(ADMIN)).toEqual({});
    expect(whereCakupan(PENGAMAT)).toEqual({});
  });
});

describe('bolehKonten — ubah', () => {
  it('pembuat boleh mengubah draft & revisi', () => {
    expect(bolehKonten(konten(KREATOR.id, null, 'DRAFT'), KREATOR, 'ubah').boleh).toBe(true);
    expect(bolehKonten(konten(KREATOR.id, null, 'REVISI'), KREATOR, 'ubah').boleh).toBe(true);
  });

  it('konten yang SEDANG MENUNGGU tidak boleh diubah pembuatnya (harus ditarik dulu)', () => {
    const h = bolehKonten(konten(KREATOR.id, PENYETUJU.id, 'MENUNGGU'), KREATOR, 'ubah');
    expect(h.boleh).toBe(false);
    expect(h.boleh === false && h.alasan).toMatch(/tarik|menunggu/i);
  });

  it('konten yang sudah disetujui/dikirim tidak boleh diubah', () => {
    for (const s of ['DISETUJUI', 'DIJADWALKAN', 'DIKIRIM'] as StatusKonten[]) {
      expect(bolehKonten(konten(KREATOR.id, PENYETUJU.id, s), KREATOR, 'ubah').boleh).toBe(false);
    }
  });

  it('penyetuju TIDAK boleh mengubah isi konten orang lain', () => {
    expect(bolehKonten(konten(KREATOR.id, PENYETUJU.id, 'MENUNGGU'), PENYETUJU, 'ubah').boleh).toBe(
      false
    );
  });

  it('admin boleh mengubah apa pun (pemulihan darurat)', () => {
    expect(bolehKonten(konten(KREATOR.id, null, 'DIKIRIM'), ADMIN, 'ubah').boleh).toBe(true);
  });
});

describe('bolehKonten — hapus', () => {
  it('pembuat boleh menghapus draft/revisi', () => {
    expect(bolehKonten(konten(KREATOR.id, null, 'DRAFT'), KREATOR, 'hapus').boleh).toBe(true);
  });

  it('jejak konten yang sudah dikirim tidak bisa dihapus pembuatnya', () => {
    const h = bolehKonten(konten(KREATOR.id, PENYETUJU.id, 'DIKIRIM'), KREATOR, 'hapus');
    expect(h.boleh).toBe(false);
  });

  it('orang lain tidak boleh menghapus konten siapa pun', () => {
    expect(bolehKonten(konten(KREATOR.id, null, 'DRAFT'), ORANG_LAIN, 'hapus').boleh).toBe(false);
  });
});
