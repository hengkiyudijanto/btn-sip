import { describe, expect, it } from 'vitest';
import { batasiCakupanCabangRanking } from './ranking-cakupan';

describe('cakupan cabang ranking', () => {
  it('menggunakan seluruh cabang di cakupan pengguna jika filter unit kosong', () => {
    expect(batasiCakupanCabangRanking(undefined, ['KC-A', 'KCP-A1'])).toEqual(['KC-A', 'KCP-A1']);
  });

  it('mengiriskan filter yang diminta dengan cakupan pengguna', () => {
    expect(batasiCakupanCabangRanking(['KC-A', 'KC-B'], ['KC-A', 'KCP-A1'])).toEqual(['KC-A']);
  });

  it('menghasilkan cakupan kosong jika filter meminta cabang di luar cakupan', () => {
    expect(batasiCakupanCabangRanking(['KC-B'], ['KC-A', 'KCP-A1'])).toEqual([]);
  });

  it('membiarkan filter tanpa batas untuk role yang memang lintas cabang', () => {
    expect(batasiCakupanCabangRanking(undefined, undefined)).toBeUndefined();
    expect(batasiCakupanCabangRanking(['KC-B'], undefined)).toEqual(['KC-B']);
  });
});
