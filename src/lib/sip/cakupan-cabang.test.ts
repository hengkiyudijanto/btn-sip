import { describe, expect, it } from 'vitest';
import { cakupanCabangHierarkis } from './cakupan-cabang';

const pohon = [
  { id: 'kanwil', indukId: null },
  { id: 'kc-a', indukId: 'kanwil' },
  { id: 'kcp-a1', indukId: 'kc-a' },
  { id: 'kc-b', indukId: 'kanwil' },
];

describe('cakupan cabang hierarkis role Manager/Supervisor', () => {
  it('mencakup cabang sendiri dan semua turunannya', () => {
    expect(cakupanCabangHierarkis('kc-a', pohon)).toEqual(['kc-a', 'kcp-a1']);
  });

  it('tidak mencakup saudara atau cabang induk', () => {
    expect(cakupanCabangHierarkis('kc-a', pohon)).not.toContain('kc-b');
    expect(cakupanCabangHierarkis('kc-a', pohon)).not.toContain('kanwil');
  });
});
