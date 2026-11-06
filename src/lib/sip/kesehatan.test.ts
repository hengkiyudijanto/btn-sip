import { describe, expect, it } from 'vitest';
import { hitungBMI, kategoriBMI } from './kesehatan';

describe('indikator kesehatan nonmedis', () => {
  it('menghitung BMI dari berat dan tinggi badan', () => {
    expect(hitungBMI(72, 180)).toBe(22.2);
  });

  it('mengembalikan kategori BMI', () => {
    expect(kategoriBMI(17.5)).toBe('Kurus');
    expect(kategoriBMI(22.2)).toBe('Normal');
    expect(kategoriBMI(27)).toBe('Berlebih');
    expect(kategoriBMI(31)).toBe('Obesitas');
  });

  it('mengembalikan null jika data belum lengkap', () => {
    expect(hitungBMI(null, 180)).toBeNull();
    expect(hitungBMI(72, null)).toBeNull();
  });
});
