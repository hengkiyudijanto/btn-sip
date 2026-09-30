import { describe, it, expect } from 'vitest';
import { RUBRIK, RENTANG_SKOR, kriteriaAspek, rubrikAspek } from './rubrik';
import { KATEGORI } from './penilaian';

const KODE_ASPEK = KATEGORI.flatMap((k) => k.aspek.map((a) => a.kode));

describe('rubrik penilaian', () => {
  it('punya rubrik untuk tepat 13 aspek', () => {
    expect(Object.keys(RUBRIK).sort()).toEqual([...KODE_ASPEK].sort());
    expect(KODE_ASPEK).toHaveLength(13);
  });

  it('setiap aspek punya 5 level skor lengkap 1-5', () => {
    for (const kode of KODE_ASPEK) {
      const level = rubrikAspek(kode);
      expect(level, `aspek ${kode}`).toHaveLength(5);
      expect(level.map((l) => l.skor).sort()).toEqual([1, 2, 3, 4, 5]);
    }
  });

  it('level terurut dari skor tertinggi agar mudah ditampilkan', () => {
    for (const kode of KODE_ASPEK) {
      const skor = rubrikAspek(kode).map((l) => l.skor);
      expect(skor, `aspek ${kode}`).toEqual([5, 4, 3, 2, 1]);
    }
  });

  it('setiap kriteria terisi dan bukan teks kosong', () => {
    for (const kode of KODE_ASPEK) {
      for (const l of rubrikAspek(kode)) {
        expect(l.kriteria.trim().length, `${kode} skor ${l.skor}`).toBeGreaterThan(10);
        expect(l.label.length).toBeGreaterThan(0);
      }
    }
  });

  it('label level sesuai urutan yang benar', () => {
    const labelDiharapkan = ['Istimewa', 'Sangat Baik', 'Baik', 'Cukup', 'Kurang'];
    for (const kode of KODE_ASPEK) {
      expect(rubrikAspek(kode).map((l) => l.label), `aspek ${kode}`).toEqual(
        labelDiharapkan
      );
    }
  });

  it('kriteriaAspek mengembalikan teks yang tepat', () => {
    expect(kriteriaAspek('B1', 5)).toContain('99-100');
    expect(kriteriaAspek('B1', 1)).toContain('0-75');
    expect(kriteriaAspek('C4', 3)).toContain('kontak mata');
  });

  it('kode aspek tak dikenal tidak melempar, mengembalikan kosong', () => {
    expect(kriteriaAspek('ZZ', 5)).toBe('');
    expect(rubrikAspek('ZZ')).toEqual([]);
  });

  it('rentang skor konsisten dengan tabel konversi', () => {
    expect(RENTANG_SKOR[5]).toBe('99-100');
    expect(RENTANG_SKOR[4]).toBe('92-98');
    expect(RENTANG_SKOR[3]).toBe('81-91');
    expect(RENTANG_SKOR[2]).toBe('76-80');
    expect(RENTANG_SKOR[1]).toBe('0-75');
  });

  it('semua aspek punya label bahasa Inggris', () => {
    for (const kode of KODE_ASPEK) {
      for (const l of rubrikAspek(kode)) {
        expect(l.labelEn.length, `${kode} skor ${l.skor}`).toBeGreaterThan(0);
      }
    }
  });
});
