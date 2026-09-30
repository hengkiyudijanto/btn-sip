import { describe, it, expect } from 'vitest';
import {
  susunBlok,
  angkaID,
  labelRatingDwibahasa,
  rentangPeriode,
} from './laporan';
import { KATEGORI } from './penilaian';

const detailSempurna = KATEGORI.flatMap((k) =>
  k.aspek.map((a) => ({
    kodeAspek: a.kode,
    nilaiMentah: a.inputMentah ? 100 : 5,
    skor: 5,
    catatan: null,
  }))
);

describe('susunBlok', () => {
  it('menghasilkan 3 blok kategori', () => {
    const blok = susunBlok(detailSempurna);
    expect(blok.map((b) => b.kode)).toEqual(['A', 'B', 'C']);
  });

  it('jumlah baris sesuai jumlah aspek tiap kategori', () => {
    const blok = susunBlok(detailSempurna);
    expect(blok[0].baris).toHaveLength(4); // A
    expect(blok[1].baris).toHaveLength(5); // B
    expect(blok[2].baris).toHaveLength(4); // C
  });

  it('total kategori = 5 saat semua skor 5', () => {
    const blok = susunBlok(detailSempurna);
    for (const b of blok) {
      expect(b.total, `kategori ${b.kode}`).toBeCloseTo(5, 2);
    }
  });

  it('bobot baris dinyatakan dalam persen', () => {
    const blok = susunBlok(detailSempurna);
    expect(blok[0].baris[0].bobot).toBe('40%');
    expect(blok[1].baris[0].bobot).toBe('20%');
    expect(blok[2].baris[0].bobot).toBe('30%');
  });

  it('nomor baris berurutan mulai 1 di tiap kategori', () => {
    const blok = susunBlok(detailSempurna);
    expect(blok[0].baris.map((b) => b.nomor)).toEqual([1, 2, 3, 4]);
    expect(blok[1].baris.map((b) => b.nomor)).toEqual([1, 2, 3, 4, 5]);
  });

  it('menghitung nilai baris = skor x bobot aspek', () => {
    const blok = susunBlok(detailSempurna);
    // A1: skor 5 x 40% = 2.00
    expect(blok[0].baris[0].nilai).toBe(2);
    // A4: skor 5 x 10% = 0.50
    expect(blok[0].baris[3].nilai).toBe(0.5);
  });

  it('menyertakan kriteria rubrik untuk skor terpilih', () => {
    const blok = susunBlok(detailSempurna);
    expect(blok[0].baris[0].kriteria).toBeTruthy();
    expect(blok[0].baris[0].kriteria!.length).toBeGreaterThan(10);
  });

  it('data kosong tidak melempar, nilai jadi 0', () => {
    const blok = susunBlok([]);
    expect(blok[0].total).toBe(0);
    expect(blok[1].baris[0].angka).toBe('-');
  });

  it('kolom ANGKA menampilkan angka 0-100 yang diinput atasan', () => {
    const blok = susunBlok([
      { kodeAspek: 'A1', nilaiMentah: 92, skor: 4, catatan: null },
    ]);
    const barisA1 = blok[0].baris[0];
    expect(barisA1.angka).toBe('92'); // angka asli atasan
    expect(barisA1.skor).toBe(4); // hasil konversi
  });

  it('kolom ANGKA untuk Quiz juga menampilkan angka 0-100', () => {
    const blok = susunBlok([
      { kodeAspek: 'B1', nilaiMentah: 88, skor: 3, catatan: null },
    ]);
    const quiz = blok[1].baris.find((b) => b.aspek.includes('Quiz'))!;
    expect(quiz.angka).toBe('88');
    expect(quiz.skor).toBe(3);
  });

  it('catatan per aspek diteruskan ke baris', () => {
    const blok = susunBlok([
      { kodeAspek: 'A1', nilaiMentah: 4, skor: 4, catatan: 'perlu perbaikan dasi' },
    ]);
    const barisA1 = blok[0].baris.find((b) => b.aspek.includes('Kerapihan'));
    expect(barisA1?.catatan).toBe('perlu perbaikan dasi');
  });
});

describe('angkaID', () => {
  it('memakai koma sebagai pemisah desimal', () => {
    expect(angkaID(4.75)).toBe('4,75');
    expect(angkaID(5)).toBe('5,00');
    expect(angkaID(3.9)).toBe('3,90');
  });

  it('menangani nilai kosong', () => {
    expect(angkaID(null)).toBe('-');
    expect(angkaID(undefined)).toBe('-');
    expect(angkaID(NaN)).toBe('-');
  });
});

describe('labelRatingDwibahasa', () => {
  it('menampilkan label Indonesia dan Inggris', () => {
    expect(labelRatingDwibahasa('Istimewa')).toBe('Istimewa / Outstanding');
    expect(labelRatingDwibahasa('Kurang')).toBe('Kurang / Poor');
  });

  it('label tak dikenal dikembalikan apa adanya', () => {
    expect(labelRatingDwibahasa('Entah')).toBe('Entah');
  });
});

describe('rentangPeriode', () => {
  it('memformat rentang tanggal dalam bahasa Indonesia', () => {
    const t = rentangPeriode(
      new Date('2026-09-29T00:00:00Z'),
      new Date('2026-10-05T00:00:00Z')
    );
    expect(t).toContain('29');
    expect(t).toContain('2026');
    expect(t).toContain('–');
  });
});
