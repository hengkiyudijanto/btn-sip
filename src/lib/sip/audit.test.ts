import { describe, it, expect } from 'vitest';
import {
  INFO_AKSI,
  infoAksi,
  aksiBelumBerlabel,
  ringkasAudit,
  angkaID,
  NamaHari,
} from './audit';

describe('label aksi audit', () => {
  it('memberi label manusia untuk aksi yang dipakai aplikasi', () => {
    expect(infoAksi('LOGIN').label).toBe('Masuk');
    expect(infoAksi('UBAH_LALU_KIRIM_PENILAIAN').label.toLowerCase()).toContain('kirim');
    expect(infoAksi('KUNCI_PENILAIAN').label.toLowerCase()).toContain('final');
  });

  it('menandai aksi gagal dengan penanda merah', () => {
    expect(infoAksi('LOGIN_GAGAL').gagal).toBe(true);
    expect(infoAksi('GANTI_PASSWORD_GAGAL').gagal).toBe(true);
    expect(infoAksi('LOGIN').gagal).toBeUndefined();
  });

  it('aksi tak dikenal tetap tampil apa adanya, tidak disembunyikan', () => {
    expect(infoAksi('AKSI_BARU_NANTI').label).toBe('AKSI_BARU_NANTI');
    expect(infoAksi('AKSI_BARU_NANTI').kelompok).toBe('lain');
    expect(aksiBelumBerlabel('AKSI_BARU_NANTI')).toBe(true);
    expect(aksiBelumBerlabel('LOGIN')).toBe(false);
  });

  it('semua aksi yang tercatat di kode punya kelompok yang sah', () => {
    const kelompokSah = new Set([
      'masuk', 'penilaian', 'persetujuan', 'periode', 'pegawai',
      'cabang', 'jabatan', 'pengajuan', 'foto', 'berkas', 'lain',
    ]);
    for (const [aksi, info] of Object.entries(INFO_AKSI)) {
      expect(kelompokSah.has(info.kelompok), `${aksi} → ${info.kelompok}`).toBe(true);
      expect(info.label.length, aksi).toBeGreaterThan(2);
    }
  });
});

describe('ringkasan audit — nilai lama vs baru', () => {
  it('menyebut nilai lama dan baru saat penilaian diubah', () => {
    const teks = ringkasAudit(
      'UBAH_DRAFT_PENILAIAN',
      { status: 'DRAFT', nilaiAkhir: 2.8, rating: 'Cukup' },
      { pegawaiDinilai: '14551', status: 'DRAFT', nilaiAkhir: 3.7, rating: 'Baik' }
    );
    expect(teks).toContain('14551');
    expect(teks).toContain('2,80');
    expect(teks).toContain('3,70');
    expect(teks).toContain('Baik');
  });

  it('tidak menyebut nilai lama saat penilaian pertama kali dibuat', () => {
    const teks = ringkasAudit(
      'KIRIM_PENILAIAN',
      undefined,
      { pegawaiDinilai: '14551', nilaiAkhir: 4.6, rating: 'Sangat Baik' }
    );
    expect(teks).toContain('4,60');
    expect(teks).not.toContain('→');
  });

  it('menyusun ringkasan pengembalian revisi beserta alasannya', () => {
    const teks = ringkasAudit(
      'KEMBALIKAN_PENILAIAN',
      { status: 'DIKETAHUI' },
      { status: 'DRAFT', alasan: 'Foto tidak jelas' }
    );
    expect(teks).toContain('DIKETAHUI → DRAFT');
    expect(teks).toContain('Foto tidak jelas');
  });

  it('menerjemahkan angka hari penilaian jadi nama hari', () => {
    expect(ringkasAudit('UBAH_HARI_PENILAIAN', { hariPenilaian: 3 }, { hariPenilaian: 1 }))
      .toBe('Rabu → Senin');
    expect(NamaHari('0')).toBe('Minggu');
    expect(NamaHari('bukan-angka')).toBe('bukan-angka');
  });

  it('mengembalikan null kalau bentuk data tidak dikenal (halaman tampilkan data mentah)', () => {
    expect(ringkasAudit('UBAH_PEGAWAI', null, null)).toBeNull();
    expect(ringkasAudit('UBAH_PEGAWAI', 'bukan objek', 42)).toBeNull();
  });

  it('tidak meledak saat kolom Json berisi nilai yang tidak terduga', () => {
    expect(() => ringkasAudit('KIRIM_PENILAIAN', [], { nilaiAkhir: {} })).not.toThrow();
    expect(ringkasAudit('KIRIM_PENILAIAN', [], { nilaiAkhir: {} })).toBeNull();
  });

  it('memformat angka gaya Indonesia', () => {
    expect(angkaID(4.6)).toBe('4,60');
    expect(angkaID(0)).toBe('0,00');
  });

  it('membaca metadata unduhan dari sisi mana pun (ranking memakai dataLama)', () => {
    // route ranking PPTX mencatat datanya di dataLama, ekspor CSV di dataBaru —
    // ringkasan harus muncul untuk keduanya.
    const ranking = ringkasAudit('UNDUH_RANKING_PPTX', {
      periode: 'Minggu ke-1 Oktober 2026',
      unit: 'KC Polewali Mandar',
      posisi: 'Teller',
      peserta: 4,
    }, undefined);
    expect(ranking).toContain('Minggu ke-1 Oktober 2026');
    expect(ranking).toContain('KC Polewali Mandar');
    expect(ranking).toContain('Teller');

    const ekspor = ringkasAudit('EKSPOR_REKAP', undefined, {
      periode: '2026-M40',
      cakupan: 'KC 244',
      jumlahBaris: 12,
    });
    expect(ekspor).toContain('2026-M40');
    expect(ekspor).toContain("12 baris");
  });
});
