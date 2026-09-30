import { describe, it, expect } from 'vitest';
import { susunBlok } from './laporan';

const detail = [
  { kodeAspek: 'A1', nilaiMentah: 92, skor: 4, catatan: 'seragam rapi, name tag lengkap' },
  { kodeAspek: 'A2', nilaiMentah: 88, skor: 3, catatan: '' },
  { kodeAspek: 'B1', nilaiMentah: 95, skor: 4, catatan: 'menguasai produk dengan baik' },
];

describe('susunBlok — versi lengkap', () => {
  it('menyertakan dasar penilaian (kriteria rubrik)', () => {
    const blok = susunBlok(detail, 'lengkap');
    const b = blok[0].baris[0];
    expect(b.kriteria).toBeDefined();
    expect(b.kriteria!.length).toBeGreaterThan(0);
  });

  it('tetap menampilkan catatan atasan', () => {
    const blok = susunBlok(detail, 'lengkap');
    expect(blok[0].baris[0].catatan).toBe('seragam rapi, name tag lengkap');
  });

  it('default tanpa argumen = lengkap (kompatibel ke belakang)', () => {
    const tanpaArg = susunBlok(detail);
    const eksplisit = susunBlok(detail, 'lengkap');
    expect(tanpaArg[0].baris[0].kriteria).toBe(eksplisit[0].baris[0].kriteria);
  });
});

describe('susunBlok — versi lite', () => {
  it('MEMBUANG dasar penilaian', () => {
    const blok = susunBlok(detail, 'lite');
    expect(blok[0].baris[0].kriteria).toBeUndefined();
    expect(blok[0].baris[1].kriteria).toBeUndefined();
    expect(blok[1].baris[0].kriteria).toBeUndefined();
  });

  it('TETAP menampilkan catatan yang ditulis atasan', () => {
    const blok = susunBlok(detail, 'lite');
    expect(blok[0].baris[0].catatan).toBe('seragam rapi, name tag lengkap');
    expect(blok[1].baris[0].catatan).toBe('menguasai produk dengan baik');
  });

  it('tidak mengubah angka, skor, bobot, dan nilai', () => {
    const lengkap = susunBlok(detail, 'lengkap');
    const lite = susunBlok(detail, 'lite');
    for (let k = 0; k < lengkap.length; k++) {
      expect(lite[k].total).toBe(lengkap[k].total);
      for (let i = 0; i < lengkap[k].baris.length; i++) {
        expect(lite[k].baris[i].angka).toBe(lengkap[k].baris[i].angka);
        expect(lite[k].baris[i].skor).toBe(lengkap[k].baris[i].skor);
        expect(lite[k].baris[i].bobot).toBe(lengkap[k].baris[i].bobot);
        expect(lite[k].baris[i].nilai).toBe(lengkap[k].baris[i].nilai);
      }
    }
  });

  it('struktur kategori tetap sama', () => {
    const lite = susunBlok(detail, 'lite');
    expect(lite.map((b) => b.kode)).toEqual(['A', 'B', 'C']);
    expect(lite[0].judul).toBeTruthy();
    expect(lite[0].bobotKategori).toBeTruthy();
  });
});
