import { describe, expect, it } from 'vitest';
import { cakupanCabangRekapIMT } from './imt-rekap-cakupan';

const pohon = [
  { id: 'pusat', kode: 'PST', nama: 'Pusat', jenis: 'KANWIL' as const, indukId: null, aktif: true },
  { id: 'cabang-a', kode: 'A', nama: 'Cabang A', jenis: 'KC' as const, indukId: 'pusat', aktif: true },
  { id: 'cabang-b', kode: 'B', nama: 'Cabang B', jenis: 'KC' as const, indukId: 'pusat', aktif: true },
  { id: 'kcp-b', kode: 'KB', nama: 'KCP B', jenis: 'KCP' as const, indukId: 'cabang-b', aktif: true },
];

describe('cakupan cabang rekap IMT', () => {
  it('selalu membatasi pengguna tanpa akses lintas cabang ke cabangnya sendiri', () => {
    expect(cakupanCabangRekapIMT({ bolehSemua: false, cabangPenggunaId: 'cabang-a', cabangDimintaId: 'cabang-b', pohon })).toEqual(['cabang-a']);
  });

  it('mengizinkan pemilih cabang hanya bila role berwenang melihat lintas cabang', () => {
    expect(cakupanCabangRekapIMT({ bolehSemua: true, cabangPenggunaId: 'cabang-a', cabangDimintaId: 'cabang-b', pohon })).toEqual(['cabang-b', 'kcp-b']);
  });

  it('mempertahankan cakupan semua unit untuk role lintas cabang tanpa filter', () => {
    expect(cakupanCabangRekapIMT({ bolehSemua: true, cabangPenggunaId: 'cabang-a', cabangDimintaId: null, pohon })).toBeNull();
  });

  it('menolak ID cabang tidak dikenal dengan cakupan kosong, bukan membuka semua data', () => {
    expect(cakupanCabangRekapIMT({ bolehSemua: true, cabangPenggunaId: 'cabang-a', cabangDimintaId: 'asing', pohon })).toEqual([]);
  });
});
