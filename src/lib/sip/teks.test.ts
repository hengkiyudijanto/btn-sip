/**
 * Uji aturan penyeragaman huruf data dari database.
 *
 * Aturan user:
 *   1. Umum: huruf pertama tiap kata kapital, sisanya kecil.
 *   2. Nama cabang: kalau kata pertamanya KC/KCP -> kata itu kapital semua.
 */

import { describe, expect, it } from 'vitest';
import { kapitalkan, kapitalkanCabang } from './teks';

describe('kapitalkan (aturan umum)', () => {
  it('nama huruf besar semua jadi kapital di awal', () => {
    expect(kapitalkan('IRWAN ALLO')).toBe('Irwan Allo');
  });

  it('huruf kecil semua juga dirapikan', () => {
    expect(kapitalkan('irwan allo')).toBe('Irwan Allo');
  });

  it('huruf campur dirapikan', () => {
    expect(kapitalkan('iRwAn aLLo')).toBe('Irwan Allo');
  });

  it('satu kata', () => {
    expect(kapitalkan('TELLER')).toBe('Teller');
  });

  it('spasi berlebih dirapikan', () => {
    expect(kapitalkan('  IRWAN   ALLO  ')).toBe('Irwan Allo');
  });

  it('nilai kosong aman', () => {
    expect(kapitalkan('')).toBe('');
    expect(kapitalkan(null)).toBe('');
    expect(kapitalkan(undefined)).toBe('');
  });

  it('tanda hubung: tiap bagian dikapitalkan', () => {
    expect(kapitalkan('BAJO-BARAT')).toBe('Bajo-Barat');
  });

  it('angka dan tanda baca tidak rusak', () => {
    expect(kapitalkan('UNIT 2 B')).toBe('Unit 2 B');
    // singkatan dalam kurung dibiarkan kapital
    expect(kapitalkan('PRIORITY BANKING (PB)')).toBe('Priority Banking (PB)');
  });

  it('singkatan dalam kurung tetap kapital', () => {
    expect(kapitalkan('PRIORITY BANKING CS (PB CS)')).toBe('Priority Banking Cs (PB CS)');
    expect(kapitalkan('TELLER (TELLER)')).toBe('Teller (Teller)');
  });
});

describe('kapitalkanCabang (khusus nama cabang)', () => {
  it('kata pertama KC ditulis kapital semua', () => {
    expect(kapitalkanCabang('KC MAMUJU')).toBe('KC Mamuju');
  });

  it('kata pertama KCP ditulis kapital semua', () => {
    expect(kapitalkanCabang('KCP POLEWALI MANDAR')).toBe('KCP Polewali Mandar');
  });

  it('KC/KCP di tengah TIDAK dikapitalkan semua', () => {
    expect(kapitalkanCabang('CABANG KC JAKARTA')).toBe('Cabang Kc Jakarta');
  });

  it('kata pertama bukan KC/KCP: pakai aturan umum', () => {
    expect(kapitalkanCabang('KANWIL SULAMPUA')).toBe('Kanwil Sulampua');
  });

  it('KC sudah huruf kecil pun tetap dijadikan kapital semua', () => {
    expect(kapitalkanCabang('kc mamuju')).toBe('KC Mamuju');
    expect(kapitalkanCabang('kcp polewali')).toBe('KCP Polewali');
  });

  it('KC dengan tanda baca tetap dikenali', () => {
    expect(kapitalkanCabang('KC. MAMUJU')).toBe('KC Mamuju');
  });

  it('nilai kosong aman', () => {
    expect(kapitalkanCabang('')).toBe('');
    expect(kapitalkanCabang(null)).toBe('');
    expect(kapitalkanCabang(undefined)).toBe('');
  });

  it('satu kata KC saja', () => {
    expect(kapitalkanCabang('KC')).toBe('KC');
  });

  it('tidak mengubah data asli (fungsi murni)', () => {
    const asli = 'KC MAMUJU';
    kapitalkanCabang(asli);
    expect(asli).toBe('KC MAMUJU');
  });
});
