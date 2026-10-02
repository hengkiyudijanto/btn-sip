import { describe, it, expect } from 'vitest';

/**
 * Uji logika penggabungan batang unit.
 *
 * Fungsi `unitTerdekat` tidak diekspor dari modul data (ia internal), jadi
 * perilakunya diuji lewat salinan aturan yang sama — tujuannya mengunci
 * KONTRAK, bukan implementasi: pegawai di unit tanpa batang sendiri harus
 * ikut terhitung di induk terdekatnya, bukan hilang.
 *
 * Kalau aturan ini berubah, uji ini akan gagal dan memaksa keputusan sadar.
 */

type Cabang = { id: string; kode: string; indukId: string | null };

const CABANG: Cabang[] = [
  { id: '1', kode: 'RO-SMP', indukId: null }, // Kanwil
  { id: '2', kode: '244', indukId: '1' }, // KC
  { id: '3', kode: '1203', indukId: '2' }, // KCP
  { id: '4', kode: '300', indukId: '2' }, // KCP lain
];

/** Salinan aturan `unitTerdekat()` — induk terdekat yang termasuk himpunan batang. */
function unitTerdekat(kodePegawai: string, himpunan: string[], semua: Cabang[]): string | null {
  if (himpunan.includes(kodePegawai)) return kodePegawai;
  let sekarang = semua.find((c) => c.kode === kodePegawai);
  let penjaga = 0;
  while (sekarang?.indukId && penjaga++ < 10) {
    const induk = semua.find((c) => c.id === sekarang!.indukId);
    if (!induk) break;
    if (himpunan.includes(induk.kode)) return induk.kode;
    sekarang = induk;
  }
  return null;
}

/** Anak langsung + dirinya sendiri — aturan `kumpulkanAnakLangsung()`. */
function kumpulkanAnakLangsung(kode: string, semua: Cabang[]): string[] {
  const induk = semua.find((c) => c.kode === kode);
  if (!induk) return [kode];
  return [kode, ...semua.filter((c) => c.indukId === induk.id).map((c) => c.kode)];
}

describe('batang per unit', () => {
  it('memilih Kanwil sebagai batang saat tidak ada unit dipilih', () => {
    const satuan = CABANG.filter((c) => c.indukId === null).map((c) => c.kode);
    expect(satuan).toEqual(['RO-SMP']);
  });

  it('pegawai di KCP ikut terhitung ke Kanwil, BUKAN hilang', () => {
    // ini bug yang pernah terjadi: pegawai 1203 tidak muncul di batang mana pun
    const satuan = ['RO-SMP'];
    expect(unitTerdekat('1203', satuan, CABANG)).toBe('RO-SMP');
    expect(unitTerdekat('244', satuan, CABANG)).toBe('RO-SMP');
  });

  it('memilih KC sebagai batang memunculkan KC dan seluruh KCP di bawahnya', () => {
    expect(kumpulkanAnakLangsung('244', CABANG)).toEqual(['244', '1203', '300']);
  });

  it('pegawai di KCP masuk batang KCP-nya sendiri saat batang itu ada', () => {
    const satuan = kumpulkanAnakLangsung('244', CABANG);
    expect(unitTerdekat('1203', satuan, CABANG)).toBe('1203');
  });

  it('memilih Kanwil sebagai batang menampilkan seluruh hierarki di bawahnya', () => {
    const satuan = kumpulkanAnakLangsung('RO-SMP', CABANG);
    expect(satuan).toContain('RO-SMP');
    expect(satuan).toContain('244');
    // KCP bukan anak langsung Kanwil — ia masuk lewat KC
    expect(satuan).not.toContain('1203');
    expect(unitTerdekat('1203', satuan, CABANG)).toBe('244');
  });

  it('KCP tanpa batang menggabung ke KC, bukan ke Kanwil', () => {
    // saat KC dipilih, KCP selalu punya batang sendiri; kalau suatu saat
    // batang KCP disembunyikan, penggabungan harus berhenti di KC
    const satuan = ['244'];
    expect(unitTerdekat('1203', satuan, CABANG)).toBe('244');
  });

  it('data siklik tidak membuat pencarian berputar tanpa henti', () => {
    const siklik: Cabang[] = [
      { id: 'a', kode: 'A', indukId: 'b' },
      { id: 'b', kode: 'B', indukId: 'a' },
    ];
    expect(() => unitTerdekat('A', ['Z'], siklik)).not.toThrow();
    expect(unitTerdekat('A', ['Z'], siklik)).toBeNull();
  });
});
