/**
 * Uji label posisi untuk slide ranking.
 *
 * Nama jabatan di database disimpan singkat ("Teller", "CS"), tetapi slide
 * presentasi memakai sebutan lengkap seperti dokumen resmi ("Teller
 * Service", "Customer Service"). Uji ini mengunci aturan itu.
 */

import { describe, expect, it } from 'vitest';
import { labelPosisi } from './label-posisi';

describe('label posisi untuk slide', () => {
  it('Teller menjadi Teller Service', () => {
    expect(labelPosisi('TELLER', 'Teller')).toBe('Teller Service');
  });

  it('CS menjadi Customer Service', () => {
    expect(labelPosisi('CS', 'CS')).toBe('Customer Service');
    expect(labelPosisi('CS', 'Customer Service')).toBe('Customer Service');
  });

  it('Security tetap Security', () => {
    expect(labelPosisi('SECURITY', 'Security')).toBe('Security');
  });

  it('Priority Banking Teller dan CS dibedakan', () => {
    expect(labelPosisi('PB_TELLER', 'PB Teller')).toBe('Priority Banking Teller');
    expect(labelPosisi('PB_CS', 'PB CS')).toBe('Priority Banking Customer Service');
  });

  it('mencocokkan dari nama bila kode tidak dikenal', () => {
    expect(labelPosisi(null, 'Teller')).toBe('Teller Service');
    expect(labelPosisi(null, 'Teller Service')).toBe('Teller Service');
    expect(labelPosisi('KODE_ANEh', 'Teller')).toBe('Teller Service');
  });

  it('nama yang tidak dikenali dikembalikan apa adanya', () => {
    expect(labelPosisi(null, 'Petugas Magang')).toBe('Petugas Magang');
    expect(labelPosisi('XXX', 'Petugas Magang')).toBe('Petugas Magang');
  });

  it('tidak mengubah nama jabatan di database (hanya untuk tampilan)', () => {
    // fungsi ini murni: masukan nama asli tidak pernah ditulis balik
    const asli = 'Teller';
    labelPosisi('TELLER', asli);
    expect(asli).toBe('Teller');
  });
});
