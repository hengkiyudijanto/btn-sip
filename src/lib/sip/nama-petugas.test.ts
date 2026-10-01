/**
 * Uji penulisan nama petugas untuk slide.
 *
 * Aturan lama: kata kedua dan seterusnya SELALU jadi inisial.
 * Aturan baru (permintaan user): kata kedua ditulis penuh KALAU muat —
 * jadi yang menentukan bukan jumlah kata, melainkan lebarnya.
 *
 * Uji `ringkasNama` tetap dipertahankan karena fungsi itu masih dipakai di
 * tempat yang tidak punya batas lebar.
 */

import { describe, expect, it } from 'vitest';
import {
  ringkasNama,
  namaSelebarMungkin,
  perkiraanLebar,
  LEBAR_NAMA_MAKS,
} from './nama-petugas';

describe('ringkasNama (aturan lama, tetap berlaku di tempat tanpa batas lebar)', () => {
  it('dua kata: kata pertama penuh, kata kedua jadi inisial', () => {
    expect(ringkasNama('Irwan Allo')).toBe('Irwan A.');
  });

  it('tiga kata: dua kata terakhir jadi inisial', () => {
    expect(ringkasNama('Ahmad Budi Santoso')).toBe('Ahmad B. S.');
  });

  it('empat kata', () => {
    expect(ringkasNama('Rudi Hartono Wijaya Kusuma')).toBe('Rudi H. W. K.');
  });

  it('satu kata dikembalikan apa adanya', () => {
    expect(ringkasNama('Benny')).toBe('Benny');
  });

  it('inisial selalu huruf besar', () => {
    expect(ringkasNama('irwan allo')).toBe('irwan A.');
    expect(ringkasNama('Irwan allo')).toBe('Irwan A.');
  });

  it('spasi berlebih dirapikan', () => {
    expect(ringkasNama('  Irwan   Allo  ')).toBe('Irwan A.');
  });

  it('nama kosong tidak error', () => {
    expect(ringkasNama('')).toBe('');
    expect(ringkasNama('   ')).toBe('');
  });

  it('nama sudah berinisial tidak digandakan titiknya', () => {
    expect(ringkasNama('Deborah C')).toBe('Deborah C.');
  });

  it('tidak mengubah data asli (fungsi murni)', () => {
    const asli = 'Irwan Allo';
    ringkasNama(asli);
    expect(asli).toBe('Irwan Allo');
  });
});

describe('namaSelebarMungkin (aturan baru)', () => {
  it('nama dua kata yang muat ditulis penuh', () => {
    expect(namaSelebarMungkin('Irwan Allo')).toBe('Irwan Allo');
    expect(namaSelebarMungkin('Marina Kadir')).toBe('Marina Kadir');
    expect(namaSelebarMungkin('Andi Aswar')).toBe('Andi Aswar');
    expect(namaSelebarMungkin('Husnia Paraditha')).toBe('Husnia Paraditha');
  });

  it('nama tiga kata yang muat ditulis penuh', () => {
    // 1,287 inci pada pengukuran nyata, batasnya 1,663
    expect(namaSelebarMungkin('Fitria Nur Jaya')).toBe('Fitria Nur Jaya');
  });

  it('satu kata dikembalikan apa adanya', () => {
    expect(namaSelebarMungkin('Rahmat')).toBe('Rahmat');
    expect(namaSelebarMungkin('Ardiansah')).toBe('Ardiansah');
  });

  it('nama yang terlalu panjang diringkas, bukan dipotong sembarangan', () => {
    const hasil = namaSelebarMungkin('Muhammad Rizky Ramadhan Pratama');
    // tetap mulai dari awal nama, bukan dipotong dari tengah
    expect(hasil.startsWith('Muhammad')).toBe(true);
    // dan muat
    expect(perkiraanLebar(hasil)).toBeLessThanOrEqual(LEBAR_NAMA_MAKS);
    // karena dua kata awal saja masih terlalu panjang, hasilnya dipotong
    // dengan elipsis — bukan diringkas jadi inisial
    expect(hasil).toContain('…');
  });

  it('kalau inisial pun tidak muat, dipotong dengan elipsis', () => {
    const hasil = namaSelebarMungkin('Bartholomeus Wiyonoputro Kusumanegara');
    expect(perkiraanLebar(hasil)).toBeLessThanOrEqual(LEBAR_NAMA_MAKS);
    expect(hasil).toContain('…');
  });

  it('ringkasan inisial dipakai kalau MUAT', () => {
    // "Fitria Nur Jaya" -> inisialnya "Fitria N. J." (1,224) muat di 1,663,
    // tapi nama lengkapnya juga muat, jadi yang dipakai nama lengkap
    expect(namaSelebarMungkin('Fitria Nur Jaya')).toBe('Fitria Nur Jaya');
    // dengan ruang sedikit lebih sempit, inisialnya yang dipakai
    expect(namaSelebarMungkin('Fitria Nur Jaya', 1.3)).toBe('Fitria N. J.');
  });

  it('hasilnya SELALU muat, untuk nama apa pun', () => {
    const contoh = [
      'A B',
      'Irwan Allo',
      'Fitria Nur Jaya',
      'Muh Ilham',
      'Muhammad Rizky Ramadhan Pratama',
      'Bartholomeus Wiyonoputro Kusumanegara',
      'Ahmad Budi Santoso Wijaya Kusuma',
    ];
    for (const nama of contoh) {
      const hasil = namaSelebarMungkin(nama);
      expect(perkiraanLebar(hasil)).toBeLessThanOrEqual(LEBAR_NAMA_MAKS);
    }
  });

  it('batas lebar bisa diatur', () => {
    // ruang lega: nama panjang ditulis penuh
    expect(namaSelebarMungkin('Muhammad Rizky Ramadhan', 5)).toBe(
      'Muhammad Rizky Ramadhan'
    );
    // ruang sedang: diringkas jadi inisial
    expect(namaSelebarMungkin('Irwan Allo', 0.9)).toBe('Irwan A.');
    // ruang sangat sempit: dipotong dengan elipsis
    expect(namaSelebarMungkin('Irwan Allo', 0.5)).toContain('…');
  });

  it('nama kosong aman', () => {
    expect(namaSelebarMungkin('')).toBe('');
    expect(namaSelebarMungkin('   ')).toBe('');
  });

  it('tidak mengubah data asli (fungsi murni)', () => {
    const asli = 'Irwan Allo';
    namaSelebarMungkin(asli);
    expect(asli).toBe('Irwan Allo');
  });
});

describe('perkiraanLebar', () => {
  it('makin panjang teks makin lebar', () => {
    expect(perkiraanLebar('Irwan')).toBeLessThan(perkiraanLebar('Irwan Allo'));
  });

  it('sedikit lebih lebar dari pengukuran nyata (margin aman)', () => {
    // pengukuran nyata: "Irwan Allo" 0,920 inci
    expect(perkiraanLebar('Irwan Allo')).toBeGreaterThan(0.92);
    // pengukuran nyata: "Husnia Paraditha" 1,540 inci
    expect(perkiraanLebar('Husnia Paraditha')).toBeGreaterThan(1.54);
  });
});
