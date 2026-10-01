/**
 * Uji peringkas nama petugas untuk slide.
 *
 * Aturan user: kata pertama penuh, kata kedua dan seterusnya diambil huruf
 * depannya saja.
 */

import { describe, expect, it } from 'vitest';
import { ringkasNama } from './nama-petugas';

describe('ringkasNama', () => {
  it('dua kata: kata pertama penuh, kata kedua jadi inisial', () => {
    expect(ringkasNama('Irwan Allo')).toBe('Irwan A.');
  });

  it('tiga kata: dua kata terakhir jadi inisial', () => {
    expect(ringkasNama('Ahmad Budi Santoso')).toBe('Ahmad B. S.');
  });

  it('empat kata', () => {
    expect(ringkasNama('Rudi Hartono Wijaya Kusuma')).toBe('Rudi H. W. K.');
  });

  it('satu kata dikembalikan apa adanya', () => {
    expect(ringkasNama('Benny')).toBe('Benny');
  });

  it('inisial selalu huruf besar', () => {
    expect(ringkasNama('irwan allo')).toBe('irwan A.');
    expect(ringkasNama('Irwan allo')).toBe('Irwan A.');
  });

  it('spasi berlebih dirapikan', () => {
    expect(ringkasNama('  Irwan   Allo  ')).toBe('Irwan A.');
  });

  it('nama kosong tidak error', () => {
    expect(ringkasNama('')).toBe('');
    expect(ringkasNama('   ')).toBe('');
  });

  it('nama sudah berinisial tidak digandakan titiknya', () => {
    // "Deborah C" -> kata kedua "C" -> jadi "C."
    expect(ringkasNama('Deborah C')).toBe('Deborah C.');
  });

  it('tidak mengubah data asli (fungsi murni)', () => {
    const asli = 'Irwan Allo';
    ringkasNama(asli);
    expect(asli).toBe('Irwan Allo');
  });
});
