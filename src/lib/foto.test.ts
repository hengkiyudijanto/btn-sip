import { describe, it, expect } from 'vitest';
import { ukuranDataUrl, formatUkuran, UKURAN_FOTO } from './foto';

describe('ukuranDataUrl', () => {
  it('menghitung ukuran base64 dengan benar', () => {
    // "AAAA" base64 = 3 byte
    expect(ukuranDataUrl('data:image/jpeg;base64,AAAA')).toBe(3);
  });

  it('memperhitungkan padding', () => {
    // "AAA=" = 2 byte
    expect(ukuranDataUrl('data:image/jpeg;base64,AAA=')).toBe(2);
    // "AA==" = 1 byte
    expect(ukuranDataUrl('data:image/jpeg;base64,AA==')).toBe(1);
  });

  it('mengembalikan 0 untuk data tidak valid', () => {
    expect(ukuranDataUrl('bukan-data-url')).toBe(0);
    expect(ukuranDataUrl('')).toBe(0);
  });

  it('konsisten dengan Buffer untuk data acak', () => {
    const asli = Buffer.from('foto pegawai uji coba');
    const b64 = asli.toString('base64');
    expect(ukuranDataUrl(`data:image/jpeg;base64,${b64}`)).toBe(asli.length);
  });
});

describe('formatUkuran', () => {
  it('menampilkan byte untuk ukuran kecil', () => {
    expect(formatUkuran(512)).toBe('512 B');
  });

  it('menampilkan KB', () => {
    expect(formatUkuran(45 * 1024)).toBe('45 KB');
  });

  it('menampilkan MB', () => {
    expect(formatUkuran(2.5 * 1024 * 1024)).toBe('2.5 MB');
  });
});

describe('konstanta foto', () => {
  it('memakai rasio 3:4', () => {
    expect(UKURAN_FOTO.lebar / UKURAN_FOTO.tinggi).toBeCloseTo(0.75, 5);
  });

  it('batas ukuran 80 KB', () => {
    expect(UKURAN_FOTO.maksByte).toBe(80 * 1024);
  });
});
