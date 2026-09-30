import { describe, it, expect } from 'vitest';
import { susunCsvRekap, namaBerkasRekap, type InfoRekap, type BarisRekap } from './ekspor';

const info: InfoRekap = {
  periode: 'Minggu ke-1 Oktober 2026',
  cakupan: 'KC 244 — KC MAMUJU (2 unit turunan)',
  jumlahDinilai: 2,
  rataRata: 3.5123,
  tertinggi: { nama: 'Andi Pratama', nilai: 5.0 },
  terendah: { nama: 'Budi Santoso', nilai: 2.99 },
  sebaran: { Istimewa: 1, Kurang: 1 },
};

const baris: BarisRekap[] = [
  {
    rank: 1, nama: 'Andi Pratama', nip: '80000001', jabatan: 'Teller',
    cabang: '0001 - Kantor Pusat', penampilan: 5.0, kemampuan: 5.0, sikap: 5.0,
    nilaiAkhir: 5.0, rating: 'Istimewa', status: 'Final',
  },
  {
    rank: 2, nama: 'Siti Nurhaliza', nip: '80000002', jabatan: 'Customer Service',
    cabang: '0001 - Kantor Pusat', penampilan: 3.9, kemampuan: 3.8, sikap: 3.9,
    nilaiAkhir: 3.88, rating: 'Cukup', status: 'Draft',
  },
];

describe('susunCsvRekap', () => {
  it('diawali BOM supaya Excel membaca UTF-8 dengan benar', () => {
    const csv = susunCsvRekap(info, baris);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
  });

  it('memuat judul dan identitas aplikasi', () => {
    const csv = susunCsvRekap(info, baris);
    expect(csv).toContain('REKAP PENILAIAN PETUGAS FRONTLINER');
    expect(csv).toContain('Bank BTN');
  });

  it('memuat periode dan cakupan', () => {
    const csv = susunCsvRekap(info, baris);
    expect(csv).toContain('Minggu ke-1 Oktober 2026');
    expect(csv).toContain('KC MAMUJU');
  });

  it('memuat ringkasan statistik', () => {
    const csv = susunCsvRekap(info, baris);
    expect(csv).toContain('Jumlah petugas dinilai;2');
    expect(csv).toContain('Andi Pratama');
    expect(csv).toContain('Budi Santoso');
  });

  it('memakai koma sebagai desimal (format Indonesia)', () => {
    const csv = susunCsvRekap(info, baris);
    // rata-rata 3.5123 -> 3,51
    expect(csv).toContain('3,51');
    expect(csv).not.toContain('3.51');
  });

  it('memakai titik-koma sebagai pemisah kolom', () => {
    const csv = susunCsvRekap(info, baris);
    const barisData = csv.split('\r\n').find((l) => l.startsWith('1;Andi'));
    expect(barisData).toBeDefined();
  });

  it('memuat header tabel peringkat', () => {
    const csv = susunCsvRekap(info, baris);
    expect(csv).toContain('Rank;Nama;NIP;Jabatan;Cabang');
  });

  it('memuat seluruh baris petugas', () => {
    const csv = susunCsvRekap(info, baris);
    expect(csv).toContain('Andi Pratama;80000001;Teller');
    expect(csv).toContain('Siti Nurhaliza;80000002;Customer Service');
  });

  it('mengosongkan nilai yang tidak ada (bukan NaN)', () => {
    const kosong: BarisRekap[] = [
      { ...baris[0], penampilan: null, nilaiAkhir: null },
    ];
    const csv = susunCsvRekap(info, kosong);
    expect(csv).not.toContain('NaN');
    expect(csv).not.toContain('null');
  });

  it('mengapit nilai yang mengandung titik-koma', () => {
    const aneh: BarisRekap[] = [{ ...baris[0], nama: 'Nama; dengan titik koma' }];
    const csv = susunCsvRekap(info, aneh);
    expect(csv).toContain('"Nama; dengan titik koma"');
  });

  it('menggandakan tanda kutip di dalam nilai', () => {
    const aneh: BarisRekap[] = [{ ...baris[0], nama: 'Nama "Penting"' }];
    const csv = susunCsvRekap(info, aneh);
    expect(csv).toContain('"Nama ""Penting"""');
  });

  it('memakai akhir baris CRLF (kompatibel Excel)', () => {
    const csv = susunCsvRekap(info, baris);
    expect(csv).toContain('\r\n');
  });
});

describe('namaBerkasRekap', () => {
  it('memuat kode periode dan tanggal', () => {
    const nama = namaBerkasRekap('2026-10-W1', new Date(2026, 8, 30));
    expect(nama).toBe('rekap-sip-2026-10-W1-2026-09-30.csv');
  });

  it('membersihkan karakter yang tidak aman untuk nama berkas', () => {
    const nama = namaBerkasRekap('2026/W40 test', new Date(2026, 0, 5));
    expect(nama).not.toContain('/');
    expect(nama).not.toContain(' ');
    expect(nama.endsWith('.csv')).toBe(true);
  });
});
