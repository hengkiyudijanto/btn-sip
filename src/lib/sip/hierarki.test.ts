import { describe, it, expect } from 'vitest';
import {
  kumpulkanTurunan,
  akanMembuatSiklus,
  susunPohon,
  LABEL_JENIS,
  type CabangRingkas,
} from './hierarki';

// Struktur uji: 1 Kanwil > 2 KC > 3 KCP (salah satunya di bawah KC kedua)
const CABANG: CabangRingkas[] = [
  { id: 'kanwil', kode: 'KW-06', nama: 'Kanwil VI', jenis: 'KANWIL', indukId: null, aktif: true },
  { id: 'kc-mamuju', kode: '244', nama: 'KC Mamuju', jenis: 'KC', indukId: 'kanwil', aktif: true },
  { id: 'kc-palu', kode: '245', nama: 'KC Palu', jenis: 'KC', indukId: 'kanwil', aktif: true },
  { id: 'kcp-a', kode: '2441', nama: 'KCP A', jenis: 'KCP', indukId: 'kc-mamuju', aktif: true },
  { id: 'kcp-b', kode: '2442', nama: 'KCP B', jenis: 'KCP', indukId: 'kc-mamuju', aktif: true },
  { id: 'kcp-c', kode: '2451', nama: 'KCP C', jenis: 'KCP', indukId: 'kc-palu', aktif: true },
  { id: 'mandiri', kode: '999', nama: 'Cabang Mandiri', jenis: 'KC', indukId: null, aktif: true },
];

describe('kumpulkanTurunan', () => {
  it('kanwil mencakup dirinya + semua KC + semua KCP', () => {
    const hasil = kumpulkanTurunan('kanwil', CABANG);
    expect(hasil).toHaveLength(6); // kanwil + 2 KC + 3 KCP
    expect(hasil).toContain('kanwil');
    expect(hasil).toContain('kc-mamuju');
    expect(hasil).toContain('kcp-c');
  });

  it('KC mencakup dirinya + KCP di bawahnya saja', () => {
    const hasil = kumpulkanTurunan('kc-mamuju', CABANG);
    expect(hasil.sort()).toEqual(['kc-mamuju', 'kcp-a', 'kcp-b'].sort());
    expect(hasil).not.toContain('kc-palu');
    expect(hasil).not.toContain('kcp-c');
  });

  it('KCP hanya dirinya sendiri', () => {
    const hasil = kumpulkanTurunan('kcp-a', CABANG);
    expect(hasil).toEqual(['kcp-a']);
  });

  it('cabang tanpa turunan mengembalikan dirinya saja', () => {
    expect(kumpulkanTurunan('mandiri', CABANG)).toEqual(['mandiri']);
  });

  it('mengembalikan tepat 1 elemen untuk id yang tidak ada', () => {
    expect(kumpulkanTurunan('tidak-ada', CABANG)).toEqual(['tidak-ada']);
  });

  it('tidak infinite loop walau data punya siklus', () => {
    const siklik: CabangRingkas[] = [
      { id: 'a', kode: 'A', nama: 'A', jenis: 'KC', indukId: 'b', aktif: true },
      { id: 'b', kode: 'B', nama: 'B', jenis: 'KC', indukId: 'a', aktif: true },
    ];
    const hasil = kumpulkanTurunan('a', siklik);
    expect(hasil.sort()).toEqual(['a', 'b']);
  });
});

describe('akanMembuatSiklus', () => {
  it('menolak kalau induk adalah dirinya sendiri', () => {
    expect(akanMembuatSiklus('kc-mamuju', 'kc-mamuju', CABANG)).toBe(true);
  });

  it('menolak kalau kandidat induk adalah turunan sendiri', () => {
    // Kanwil tidak boleh jadi anak dari KCP di bawahnya
    expect(akanMembuatSiklus('kc-mamuju', 'kcp-a', CABANG)).toBe(true);
  });

  it('mengizinkan induk yang sah (di luar rantai turunan)', () => {
    expect(akanMembuatSiklus('kc-mamuju', 'kanwil', CABANG)).toBe(false);
    expect(akanMembuatSiklus('kc-mamuju', null, CABANG)).toBe(false);
  });
});

describe('susunPohon', () => {
  it('menempatkan induk sebelum anak', () => {
    const pohon = susunPohon(CABANG);
    const pos = (id: string) => pohon.findIndex((c) => c.id === id);

    expect(pos('kanwil')).toBeLessThan(pos('kc-mamuju'));
    expect(pos('kc-mamuju')).toBeLessThan(pos('kcp-a'));
    expect(pos('kc-palu')).toBeLessThan(pos('kcp-c'));
  });

  it('kedalaman bertambah sesuai level', () => {
    const pohon = susunPohon(CABANG);
    const cari = (id: string) => pohon.find((c) => c.id === id)!;

    expect(cari('kanwil').kedalaman).toBe(0);
    expect(cari('kc-mamuju').kedalaman).toBe(1);
    expect(cari('kcp-a').kedalaman).toBe(2);
  });

  it('menghitung jumlah turunan dengan benar', () => {
    const pohon = susunPohon(CABANG);
    const cari = (id: string) => pohon.find((c) => c.id === id)!;

    expect(cari('kanwil').jumlahTurunan).toBe(5); // 2 KC + 3 KCP
    expect(cari('kc-mamuju').jumlahTurunan).toBe(2); // 2 KCP
    expect(cari('kcp-a').jumlahTurunan).toBe(0);
  });

  it('semua cabang muncul tepat satu kali', () => {
    const pohon = susunPohon(CABANG);
    expect(pohon).toHaveLength(CABANG.length);
    expect(new Set(pohon.map((c) => c.id)).size).toBe(CABANG.length);
  });

  it('menangani daftar kosong', () => {
    expect(susunPohon([])).toEqual([]);
  });
});

describe('label jenis', () => {
  it('punya label untuk semua jenis', () => {
    expect(LABEL_JENIS.KANWIL).toBe('Kanwil');
    expect(LABEL_JENIS.KC).toBe('KC');
    expect(LABEL_JENIS.KCP).toBe('KCP');
  });
});
