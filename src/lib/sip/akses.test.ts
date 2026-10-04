import { describe, it, expect } from 'vitest';
import {
  boleh,
  bolehBukaHalaman,
  wajibKemampuan,
  SEMUA_PERAN,
  KETERANGAN_PERAN,
  type Kemampuan,
  type Peran,
} from './akses';

/**
 * Hak akses peran — kontrak, bukan preferensi.
 *
 * Yang diuji terutama PENGAMAT (peran "hanya melihat", ditambahkan 4 Okt 2026):
 * ia harus bisa MELIHAT dasbor/laporan/ranking, dan TIDAK BOLEH melakukan
 * satu pun tindakan yang mengubah data. Kalau ada yang lolos di sini,
 * itu berarti ada celah di server action.
 */

const SEMUA_KEMAMPUAN: Kemampuan[] = [
  'menilai',
  'mengetahui',
  'kelola_penilaian',
  'lihat_pegawai',
  'usul_pegawai',
  'setujui_pegawai',
  'kelola_pegawai',
  'kelola_induk',
  'lihat_audit',
];

describe('PENGAMAT — hanya melihat', () => {
  it('TIDAK punya satu pun kemampuan mengubah data', () => {
    for (const k of SEMUA_KEMAMPUAN) {
      expect(boleh('PENGAMAT', k), `PENGAMAT tidak boleh punya '${k}'`).toBe(false);
    }
  });

  it('BISA membuka dasbor, laporan, dan ranking', () => {
    expect(bolehBukaHalaman('PENGAMAT', '/dasbor')).toBe(true);
    expect(bolehBukaHalaman('PENGAMAT', '/laporan')).toBe(true);
    expect(bolehBukaHalaman('PENGAMAT', '/laporan/ranking')).toBe(true);
  });

  it('TIDAK bisa membuka halaman kerja & data sensitif', () => {
    for (const jalur of [
      '/penilaian',
      '/persetujuan',
      '/pegawai',
      '/pengajuan-pegawai',
      '/parameter/cabang',
      '/parameter/jabatan',
      '/parameter/peran',
      '/parameter/periode',
      '/parameter/audit',
    ]) {
      expect(bolehBukaHalaman('PENGAMAT', jalur), `PENGAMAT tidak boleh buka ${jalur}`).toBe(false);
    }
  });

  it('TIDAK bisa mengunduh rekap Excel', () => {
    expect(bolehBukaHalaman('PENGAMAT', '/laporan/ekspor')).toBe(false);
  });

  it('wajibKemampuan menolak dengan pesan yang menyebut perannya', () => {
    const tolak = wajibKemampuan({ role: 'PENGAMAT' }, 'menilai');
    expect(tolak).toContain('PENGAMAT');
    expect(tolak).toContain('hanya bisa melihat');
  });

  it('tidak bisa menembus halaman penilaian per petugas (jalur tak terdaftar)', () => {
    expect(bolehBukaHalaman('PENGAMAT', '/penilaian/cmux123')).toBe(false);
  });
});

describe('peran lama tidak berubah perilakunya', () => {
  it('PEGAWAI: tanpa kemampuan, hanya halaman umum', () => {
    for (const k of SEMUA_KEMAMPUAN) {
      expect(boleh('PEGAWAI', k), `PEGAWAI tidak boleh punya '${k}'`).toBe(false);
    }
    expect(bolehBukaHalaman('PEGAWAI', '/dasbor')).toBe(true);
    expect(bolehBukaHalaman('PEGAWAI', '/laporan')).toBe(true);
    expect(bolehBukaHalaman('PEGAWAI', '/penilaian')).toBe(false);
  });

  it('SUPERVISOR: boleh menilai & mengusulkan, tidak boleh mengesahkan', () => {
    expect(boleh('SUPERVISOR', 'menilai')).toBe(true);
    expect(boleh('SUPERVISOR', 'usul_pegawai')).toBe(true);
    expect(boleh('SUPERVISOR', 'mengetahui')).toBe(false);
    expect(boleh('SUPERVISOR', 'lihat_pegawai')).toBe(false);
    expect(boleh('SUPERVISOR', 'kelola_induk')).toBe(false);
    expect(boleh('SUPERVISOR', 'lihat_audit')).toBe(false);
  });

  it('MANAGER: menilai + mengetahui + lihat pegawai, TIDAK kelola induk', () => {
    expect(boleh('MANAGER', 'menilai')).toBe(true);
    expect(boleh('MANAGER', 'mengetahui')).toBe(true);
    expect(boleh('MANAGER', 'lihat_pegawai')).toBe(true);
    expect(boleh('MANAGER', 'setujui_pegawai')).toBe(true);
    expect(boleh('MANAGER', 'kelola_induk')).toBe(false);
    expect(boleh('MANAGER', 'lihat_audit')).toBe(false);
    expect(bolehBukaHalaman('MANAGER', '/parameter/periode')).toBe(false);
  });

  it('ADMIN: punya semua kemampuan', () => {
    for (const k of SEMUA_KEMAMPUAN) {
      expect(boleh('ADMIN', k), `ADMIN harus punya '${k}'`).toBe(true);
    }
    for (const jalur of Object.keys({ a: 1 })) void jalur;
    expect(bolehBukaHalaman('ADMIN', '/parameter/audit')).toBe(true);
    expect(bolehBukaHalaman('ADMIN', '/laporan/ekspor')).toBe(true);
  });
});

describe('bolehBukaHalaman — pencocokan jalur', () => {
  it('aturan terpanjang yang menang (/laporan/ranking bukan /laporan)', () => {
    // /laporan untuk semua, tapi /laporan/ekspor dibatasi
    expect(bolehBukaHalaman('PEGAWAI', '/laporan')).toBe(true);
    expect(bolehBukaHalaman('PEGAWAI', '/laporan/ekspor')).toBe(false);
    expect(bolehBukaHalaman('SUPERVISOR', '/laporan/ekspor')).toBe(true);
  });

  it('mengabaikan query string dan garis miring di ujung', () => {
    expect(bolehBukaHalaman('PENGAMAT', '/dasbor?periode=abc')).toBe(true);
    expect(bolehBukaHalaman('PENGAMAT', '/laporan/')).toBe(true);
    expect(bolehBukaHalaman('PENGAMAT', '/penilaian?periode=x')).toBe(false);
  });

  it('jalur tak terdaftar: hanya yang boleh menilai (halaman penilaian per petugas)', () => {
    expect(bolehBukaHalaman('SUPERVISOR', '/penilaian/cmux123')).toBe(true);
    expect(bolehBukaHalaman('MANAGER', '/penilaian/cmux123')).toBe(true);
    expect(bolehBukaHalaman('PEGAWAI', '/penilaian/cmux123')).toBe(false);
    expect(bolehBukaHalaman('PENGAMAT', '/penilaian/cmux123')).toBe(false);
  });
});

describe('wajibKemampuan', () => {
  it('menolak sesi kosong', () => {
    expect(wajibKemampuan(null, 'menilai')).toContain('Sesi habis');
  });

  it('mengizinkan yang berhak', () => {
    expect(wajibKemampuan({ role: 'ADMIN' }, 'kelola_induk')).toBeNull();
    expect(wajibKemampuan({ role: 'SUPERVISOR' }, 'menilai')).toBeNull();
  });

  it('menolak peran tak dikenal (jangan pernah loloskan default)', () => {
    expect(wajibKemampuan({ role: 'PERAN_ASING' }, 'menilai')).not.toBeNull();
    expect(boleh('PERAN_ASING', 'menilai')).toBe(false);
  });
});

describe('daftar & keterangan peran', () => {
  it('PENGAMAT terdaftar di SEMUA_PERAN dan punya keterangan', () => {
    expect(SEMUA_PERAN).toContain('PENGAMAT');
    expect(KETERANGAN_PERAN.PENGAMAT.length).toBeGreaterThan(10);
  });

  it('setiap peran di SEMUA_PERAN punya keterangan (tidak ada yang kosong)', () => {
    for (const p of SEMUA_PERAN) {
      expect(KETERANGAN_PERAN[p as Peran], `keterangan ${p} kosong`).toBeTruthy();
    }
  });

  it('urutan SEMUA_PERAN dari tersempit ke terluas (dipakai halaman /parameter/peran)', () => {
    expect(SEMUA_PERAN[0]).toBe('PEGAWAI');
    expect(SEMUA_PERAN[SEMUA_PERAN.length - 1]).toBe('ADMIN');
  });

  it('tidak ada peran ganda di daftar', () => {
    expect(new Set(SEMUA_PERAN).size).toBe(SEMUA_PERAN.length);
  });
});
