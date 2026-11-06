import { describe, expect, it } from 'vitest';
import { validasiDataFisikPegawai } from './data-fisik';

describe('data fisik pegawai', () => {
  it('mewajibkan tanggal lahir dan tinggi badan untuk peran PEGAWAI', () => {
    expect(validasiDataFisikPegawai('PEGAWAI', '', '')).toBe('Tanggal lahir wajib diisi untuk peran Pegawai.');
    expect(validasiDataFisikPegawai('PEGAWAI', '1990-01-02', '')).toBe('Tinggi badan wajib diisi untuk peran Pegawai.');
    expect(validasiDataFisikPegawai('PEGAWAI', '1990-01-02', '170')).toBeNull();
  });

  it('membolehkan data kosong untuk peran selain PEGAWAI', () => {
    expect(validasiDataFisikPegawai('SUPERVISOR', '', '')).toBeNull();
  });

  it('menolak nilai tanggal atau tinggi badan yang tidak valid', () => {
    expect(validasiDataFisikPegawai('PEGAWAI', 'tanggal-salah', '170')).toBe('Tanggal lahir tidak valid.');
    expect(validasiDataFisikPegawai('PEGAWAI', '1990-01-02', '0')).toBe('Tinggi badan harus lebih besar dari 0.');
  });
});
