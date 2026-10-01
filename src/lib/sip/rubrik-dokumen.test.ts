/**
 * Uji kesesuaian rubrik dengan dokumen sumber (foto yang dikirim user).
 *
 * Perbedaan yang SENGAJA dipertahankan sudah diputuskan user dan ditulis di
 * sini sebagai daftar yang disetujui — jadi perubahannya tidak akan
 * "diperbaiki" tanpa sadar oleh perubahan berikutnya.
 *
 * Jalankan: pnpm test
 */
import { describe, expect, it } from 'vitest';
import { RUBRIK } from './rubrik';

/** Ambil teks kriteria satu aspek pada skor tertentu. */
function kriteria(kode: string, skor: number): string {
  const l = RUBRIK[kode]?.find((x) => x.skor === skor);
  if (!l) throw new Error(`${kode} skor ${skor} tidak ada`);
  return l.kriteria;
}

describe('rubrik sesuai dokumen sumber (hasil penyesuaian)', () => {
  // Lima perbaikan yang diminta user setelah membandingkan dengan dokumen.
  it('A4 skor 4 menyebut "tidak mengganggu pelayanan"', () => {
    expect(kriteria('A4', 4)).toContain('tidak mengganggu pelayanan');
  });

  it('B3 skor 3 menyebut "pada detail/ketentuan"', () => {
    expect(kriteria('B3', 3)).toContain('pada detail/ketentuan');
  });

  it('B5 skor 1 berakhir "kebutuhan nasabah"', () => {
    expect(kriteria('B5', 1)).toMatch(/kebutuhan nasabah\.$/);
  });

  it('C4 skor 2 memakai "terlihat kurang fokus", bukan "terlalu kurang fokus"', () => {
    expect(kriteria('C4', 2)).toContain('terlihat kurang fokus');
    expect(kriteria('C4', 2)).not.toContain('terlalu kurang fokus');
  });

  it('C2 skor 3 memakai "permintaan" (sesuai dokumen), bukan "perintah"', () => {
    expect(kriteria('C2', 3)).toContain('menunggu permintaan');
    expect(kriteria('C2', 3)).not.toContain('menunggu perintah');
  });
});

describe('perbedaan yang SENGAJA dipertahankan (keputusan user)', () => {
  it('B1 skor 4 memakai 92-98, bukan 91-98 dari dokumen', () => {
    // Dokumen sumber tertulis 91-98 di teks kriteria, tetapi kolom Rentang
    // menulis 92-98. Dipakai 92-98 supaya angka 91 tetap milik skor 3 dan
    // tidak tumpang tindih dengan band Baik (81-91).
    expect(kriteria('B1', 4)).toContain('92-98');
    expect(kriteria('B1', 4)).not.toContain('91-98');
  });

  it('B5 skor 3 memakai "menggali" (memperbaiki salah ketik dokumen)', () => {
    expect(kriteria('B5', 3)).toContain('menggali');
    expect(kriteria('B5', 3)).not.toContain('menggeluarkan');
  });

  it('C1 skor 3 memakai "formal" (memperbaiki salah ketik dokumen)', () => {
    expect(kriteria('C1', 3)).toContain('formal/standar');
    expect(kriteria('C1', 3)).not.toContain('formalis/standar');
  });
});

describe('konversi angka ke skor tetap konsisten dengan rubrik', () => {
  it('angka 91 hanya masuk skor 3 (tidak tumpang tindih)', async () => {
    const { nilaiKeSkala } = await import('./penilaian');
    expect(nilaiKeSkala(91)).toBe(3);
    expect(nilaiKeSkala(92)).toBe(4);
  });

  it('batas tiap band sesuai tabel yang disetujui', async () => {
    const { nilaiKeSkala } = await import('./penilaian');
    expect(nilaiKeSkala(100)).toBe(5);
    expect(nilaiKeSkala(99)).toBe(5);
    expect(nilaiKeSkala(98)).toBe(4);
    expect(nilaiKeSkala(81)).toBe(3);
    expect(nilaiKeSkala(80)).toBe(2);
    expect(nilaiKeSkala(76)).toBe(2);
    expect(nilaiKeSkala(75)).toBe(1);
    expect(nilaiKeSkala(0)).toBe(1);
  });
});
