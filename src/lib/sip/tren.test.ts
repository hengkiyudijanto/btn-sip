import { describe, it, expect } from 'vitest';
import {
  labelPeriode,
  rataRata,
  susunTitik,
  selisihTerakhir,
  arahTren,
  AMBANG_TREN,
} from './tren';

describe('label periode di sumbu grafik', () => {
  it('meringkas rentang dalam bulan yang sama', () => {
    expect(labelPeriode(new Date(2026, 9, 1), new Date(2026, 9, 11))).toBe('1–11 Okt');
  });

  it('menyebut kedua bulan kalau periode menyeberang bulan', () => {
    expect(labelPeriode(new Date(2026, 8, 29), new Date(2026, 9, 5))).toBe('29 Sep – 5 Okt');
  });
});

describe('rata-rata nilai', () => {
  it('membuang baris yang belum punya nilai akhir', () => {
    expect(rataRata([{ nilaiAkhir: 4 }, { nilaiAkhir: null }, { nilaiAkhir: 3 }])).toBe(3.5);
  });

  it('mengembalikan null kalau tidak ada nilai sama sekali', () => {
    expect(rataRata([{ nilaiAkhir: null }])).toBeNull();
    expect(rataRata([])).toBeNull();
  });

  it('memperlakukan nilai 0 sebagai data, bukan sebagai kosong', () => {
    expect(rataRata([{ nilaiAkhir: 0 }])).toBe(0);
  });
});

describe('titik tren', () => {
  const periode = [
    { id: 'p1', nama: 'Minggu ke-1', tanggalMulai: new Date(2026, 9, 1), tanggalSelesai: new Date(2026, 9, 7) },
    { id: 'p2', nama: 'Minggu ke-2', tanggalMulai: new Date(2026, 9, 8), tanggalSelesai: new Date(2026, 9, 14) },
    { id: 'p3', nama: 'Minggu ke-3', tanggalMulai: new Date(2026, 9, 15), tanggalSelesai: new Date(2026, 9, 21) },
  ];

  it('menandai periode tanpa penilaian sebagai null, BUKAN nol', () => {
    const peta = new Map([
      ['p1', [{ nilaiAkhir: 4.2 }]],
      ['p3', [{ nilaiAkhir: 3.8 }]],
    ]);
    const titik = susunTitik(periode, peta);
    expect(titik[0].nilai).toBe(4.2);
    expect(titik[1].nilai).toBeNull();
    expect(titik[1].jumlah).toBe(0);
    expect(titik[2].nilai).toBe(3.8);
  });

  it('membulatkan rata-rata ke dua desimal', () => {
    const peta = new Map([['p1', [{ nilaiAkhir: 4.111 }, { nilaiAkhir: 3.222 }]]]);
    expect(susunTitik(periode, peta)[0].nilai).toBe(3.67);
  });
});

describe('perubahan antar periode', () => {
  const titik = (nilai: (number | null)[]) =>
    nilai.map((n, i) => ({ label: `p${i}`, nama: `p${i}`, nilai: n, jumlah: n === null ? 0 : 1 }));

  it('menghitung selisih dari titik berdata terakhir, melewati periode kosong', () => {
    // 4,00 → (kosong) → 4,30 : selisih harus 0,30, bukan dibandingkan dengan nol
    const s = selisihTerakhir(titik([4.0, null, 4.3]));
    expect(s).toBe(0.3);
    expect(arahTren(s)).toBe('naik');
  });

  it('tidak menyimpulkan apa-apa kalau hanya ada satu periode berdata', () => {
    expect(selisihTerakhir(titik([4.0, null, null]))).toBeNull();
    expect(arahTren(null)).toBeNull();
  });

  it('menandai perubahan kecil sebagai datar, bukan naik/turun', () => {
    const kecil = AMBANG_TREN / 2;
    expect(arahTren(kecil)).toBe('datar');
    expect(arahTren(-kecil)).toBe('datar');
  });

  it('mengenali penurunan', () => {
    expect(arahTren(selisihTerakhir(titik([4.3, 3.9])))).toBe('turun');
  });
});
