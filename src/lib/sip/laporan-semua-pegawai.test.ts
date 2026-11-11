import { describe, expect, it } from 'vitest';
import { gabungkanPegawaiBelumDinilai, hitungRingkasanPenilaian } from './laporan-semua-pegawai';
import type { BarisRekap } from './ekspor';

const dinilai: BarisRekap[] = [{ rank: 1, nama: 'Ayu', nip: '100', jabatan: 'Teller', cabang: 'KC A', penampilan: 4, kemampuan: 4, sikap: 4, nilaiAkhir: 4, rating: 'Baik', status: 'Final' }];
const semua = [
  { nama: 'Ayu', nip: '100', jabatan: 'Teller', cabang: 'KC A' },
  { nama: 'Bima', nip: '200', jabatan: 'CS', cabang: 'KC A' },
];

describe('ekspor laporan dengan semua pegawai', () => {
  it('menambahkan pegawai yang belum memiliki baris penilaian tanpa menduplikasi yang sudah ada', () => {
    const rows = gabungkanPegawaiBelumDinilai(dinilai, semua);
    expect(rows.map((r) => r.nip)).toEqual(['100', '200']);
    expect(rows[1]).toMatchObject({ nama: 'Bima', nilaiAkhir: null, status: 'BELUM DINILAI', rating: '-' });
  });

  it('menghitung statistik hanya dari pegawai yang benar-benar punya nilai akhir', () => {
    const rows = gabungkanPegawaiBelumDinilai(dinilai, semua);
    expect(hitungRingkasanPenilaian(rows)).toEqual({
      jumlahDinilai: 1,
      rataRata: 4,
      tertinggi: { nama: 'Ayu', nilai: 4 },
      terendah: { nama: 'Ayu', nilai: 4 },
      sebaran: { Baik: 1 },
    });
  });
});
