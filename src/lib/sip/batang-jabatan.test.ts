import { describe, it, expect } from 'vitest';
import { denganJabatanTerpilih } from './batang-jabatan';

/**
 * Kontrak: jabatan yang dipilih di filter HARUS tetap muncul sebagai batang
 * walau belum ada penilaian di periode itu — kalau hilang, layar terlihat
 * seperti aplikasi rusak padahal datanya memang belum diisi.
 */

const KANDIDAT = [
  { kode: 'SECURITY', nama: 'Security' },
  { kode: 'TELLER', nama: 'Teller Service' },
  { kode: 'CS', nama: 'Customer Service' },
];

const batangCs = { kunci: 'jab-CS', label: 'Customer Service', keterangan: '2 dinilai dari 3 petugas', nilai: 3.97, jumlah: 2, jabatanKode: 'CS' };

describe('denganJabatanTerpilih', () => {
  it('menambahkan batang kosong untuk jabatan terpilih yang belum dinilai', () => {
    const hasil = denganJabatanTerpilih([batangCs], 'SECURITY', KANDIDAT);
    expect(hasil).toHaveLength(2);
    const sec = hasil.find((b) => b.jabatanKode === 'SECURITY');
    expect(sec).toBeDefined();
    expect(sec!.label).toBe('Security');
    expect(sec!.jumlah).toBe(0);
    expect(sec!.nilai).toBe(0);
    expect(sec!.keterangan).toBe('belum ada nilai');
  });

  it('tidak menggandakan jabatan yang sudah ada di daftar', () => {
    const hasil = denganJabatanTerpilih([batangCs], 'CS', KANDIDAT);
    expect(hasil).toHaveLength(1);
    expect(hasil[0]).toEqual(batangCs);
  });

  it('membiarkan daftar apa adanya saat filter kosong (semua jabatan)', () => {
    const asli = [batangCs];
    expect(denganJabatanTerpilih(asli, '', KANDIDAT)).toBe(asli);
  });

  it('tidak menambah apa pun untuk kode jabatan yang tidak dikenal', () => {
    const asli = [batangCs];
    expect(denganJabatanTerpilih(asli, 'TIDAK_ADA', KANDIDAT)).toBe(asli);
  });

  it('tetap bekerja saat periode belum punya penilaian sama sekali', () => {
    const hasil = denganJabatanTerpilih<{ jabatanKode?: string; jumlah: number; keterangan: string }>(
      [],
      'SECURITY',
      KANDIDAT
    );
    expect(hasil).toHaveLength(1);
    expect(hasil[0].jabatanKode).toBe('SECURITY');
    expect(hasil[0].jumlah).toBe(0);
    expect(hasil[0].keterangan).toBe('belum ada nilai');
  });
});
