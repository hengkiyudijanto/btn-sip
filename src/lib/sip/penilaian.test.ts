import { describe, it, expect } from 'vitest';
import {
  nilaiKeSkala,
  hitungPenilaian,
  ratingDariNilai,
  KATEGORI,
  PERFORMANCE_RATING,
  type InputAspek,
} from './penilaian';

// ---------------------------------------------------------------------------
// Konversi 1-100 -> 1-5
// ---------------------------------------------------------------------------
describe('nilaiKeSkala', () => {
  it('memetakan tiap batas band dengan benar', () => {
    expect(nilaiKeSkala(100)).toBe(5);
    expect(nilaiKeSkala(99)).toBe(5);
    expect(nilaiKeSkala(98)).toBe(4);
    expect(nilaiKeSkala(92)).toBe(4);
    expect(nilaiKeSkala(91)).toBe(3);
    expect(nilaiKeSkala(81)).toBe(3);
    expect(nilaiKeSkala(80)).toBe(2);
    expect(nilaiKeSkala(76)).toBe(2);
    expect(nilaiKeSkala(75)).toBe(1);
    expect(nilaiKeSkala(0)).toBe(1);
  });

  it('menolak nilai di luar 0-100', () => {
    expect(() => nilaiKeSkala(-1)).toThrow(RangeError);
    expect(() => nilaiKeSkala(101)).toThrow(RangeError);
  });
});

// ---------------------------------------------------------------------------
// Rating akhir
// ---------------------------------------------------------------------------
describe('ratingDariNilai', () => {
  it('menempatkan nilai tepat di batas dengan benar', () => {
    expect(ratingDariNilai(5.0).label).toBe('Istimewa');
    expect(ratingDariNilai(4.8).label).toBe('Istimewa');
    expect(ratingDariNilai(4.79).label).toBe('Sangat Baik');
    expect(ratingDariNilai(4.6).label).toBe('Sangat Baik');
    expect(ratingDariNilai(4.59).label).toBe('Baik');
    expect(ratingDariNilai(4.0).label).toBe('Baik');
    expect(ratingDariNilai(3.99).label).toBe('Cukup');
    expect(ratingDariNilai(3.6).label).toBe('Cukup');
    expect(ratingDariNilai(3.59).label).toBe('Kurang');
    expect(ratingDariNilai(0).label).toBe('Kurang');
  });

  it('tidak ada lubang di rentang 0-5', () => {
    // uji setiap kenaikan 0.01
    for (let v = 0; v <= 5.0001; v += 0.01) {
      const val = Math.round(v * 100) / 100;
      expect(() => ratingDariNilai(val)).not.toThrow();
    }
  });
});

// ---------------------------------------------------------------------------
// Struktur bobot
// ---------------------------------------------------------------------------
describe('struktur bobot', () => {
  it('bobot aspek tiap kategori berjumlah 1', () => {
    for (const kat of KATEGORI) {
      const total = kat.aspek.reduce((a, b) => a + b.bobot, 0);
      expect(total).toBeCloseTo(1, 10);
    }
  });

  it('bobot kategori berjumlah 1', () => {
    const total = KATEGORI.reduce((a, b) => a + b.bobot, 0);
    expect(total).toBeCloseTo(1, 10);
  });

  it('ada 13 aspek', () => {
    const total = KATEGORI.reduce((a, k) => a + k.aspek.length, 0);
    expect(total).toBe(13);
  });

  it('band performance rating kontinu dan menutup 0-5', () => {
    const sorted = [...PERFORMANCE_RATING].sort((a, b) => a.min - b.min);
    expect(sorted[0].min).toBe(0);
    expect(sorted[sorted.length - 1].max).toBe(5);
    for (let i = 1; i < sorted.length; i++) {
      // batas atas band sebelumnya + 0.01 == batas bawah band berikutnya
      expect(Math.round((sorted[i - 1].max + 0.01) * 100) / 100).toBe(
        Math.round(sorted[i].min * 100) / 100
      );
    }
  });
});

// ---------------------------------------------------------------------------
// Skenario penilaian
// ---------------------------------------------------------------------------
const semuaAspek = KATEGORI.flatMap((k) => k.aspek);

/** Bangun input: semua aspek dapat skor sama (quiz pakai nilai mentah). */
function inputSeragam(skor: number, nilaiQuiz = 99): InputAspek[] {
  return semuaAspek.map((a) => ({
    kode: a.kode,
    nilai: a.inputMentah ? nilaiQuiz : skor,
  }));
}

describe('hitungPenilaian', () => {
  it('skor sempurna (5 semua) -> 5.00 Istimewa', () => {
    const hasil = hitungPenilaian(inputSeragam(5, 99));
    expect(hasil.nilaiAkhir).toBe(5);
    expect(hasil.rating.label).toBe('Istimewa');
  });

  it('skor 1 semua -> 1.00 Kurang', () => {
    const hasil = hitungPenilaian(inputSeragam(1, 75));
    expect(hasil.nilaiAkhir).toBe(1);
    expect(hasil.rating.label).toBe('Kurang');
  });

  it('quiz pakai nilai mentah 0-100 dan dikonversi', () => {
    // quiz 99 -> skor 5 ; quiz 75 -> skor 1
    const tinggi = hitungPenilaian(inputSeragam(5, 99));
    const rendah = hitungPenilaian(inputSeragam(5, 75));
    expect(tinggi.nilaiAkhir).toBe(5);
    // B1 turun dari 5 ke 1: selisih 4 x bobot 0.2 x kategori 0.5 = 0.4
    expect(rendah.nilaiAkhir).toBeCloseTo(4.6, 2);
    expect(rendah.rating.label).toBe('Sangat Baik');
  });

  it('menghitung nilai kategori sesuai bobotnya', () => {
    const hasil = hitungPenilaian(inputSeragam(5, 99));
    const A = hasil.kategori.find((k) => k.kode === 'A')!;
    const B = hasil.kategori.find((k) => k.kode === 'B')!;
    const C = hasil.kategori.find((k) => k.kode === 'C')!;

    expect(A.nilai).toBe(5);
    expect(B.nilai).toBe(5);
    expect(C.nilai).toBe(5);
    expect(A.kontribusi).toBe(1); // 5 x 20%
    expect(B.kontribusi).toBe(2.5); // 5 x 50%
    expect(C.kontribusi).toBe(1.5); // 5 x 30%
    expect(A.kontribusi + B.kontribusi + C.kontribusi).toBe(5);
  });

  it('skor campuran menghasilkan nilai di antaranya', () => {
    const input = semuaAspek.map((a) => ({
      kode: a.kode,
      nilai: a.inputMentah ? 90 : 4,
    }));
    const hasil = hitungPenilaian(input);
    expect(hasil.nilaiAkhir).toBeGreaterThan(3.5);
    expect(hasil.nilaiAkhir).toBeLessThan(4.5);
  });

  it('menolak aspek yang belum dinilai', () => {
    const input = inputSeragam(5).filter((i) => i.kode !== 'C4');
    expect(() => hitungPenilaian(input)).toThrow(/C4/);
  });

  it('menolak skor di luar 1-5', () => {
    const input = inputSeragam(5).map((i) =>
      i.kode === 'A1' ? { ...i, nilai: 6 } : i
    );
    expect(() => hitungPenilaian(input)).toThrow(RangeError);
  });

  it('nilai akhir maksimum tidak pernah melebihi 5', () => {
    const hasil = hitungPenilaian(inputSeragam(5, 100));
    expect(hasil.nilaiAkhir).toBeLessThanOrEqual(5);
  });
});
