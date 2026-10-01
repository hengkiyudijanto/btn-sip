/**
 * Uji struktur menu & penyaringan per role.
 *
 * Yang dijaga:
 *   - Admin melihat menu Parameter berisi Cabang + Periode
 *   - Role yang tidak berhak TIDAK melihat menu Parameter sama sekali
 *     (bukan cuma anaknya yang hilang, karena cabang/periode memang
 *      khusus admin)
 *   - Supervisor hanya melihat menu yang relevan untuknya
 */

import { describe, expect, it } from 'vitest';
import { saringMenu, MENU as MENU_UNTUK_UJI } from './menu';

function label(menu: ReturnType<typeof saringMenu>): string[] {
  return menu.map((m) => m.label);
}

describe('struktur menu', () => {
  it('tidak ada href ganda (satu halaman satu pintu)', () => {
    const semuaHref: string[] = [];
    for (const m of MENU_UNTUK_UJI) {
      if (m.href) semuaHref.push(m.href);
      for (const a of m.anak ?? []) semuaHref.push(a.href);
    }
    const unik = new Set(semuaHref);
    expect(unik.size).toBe(semuaHref.length);
  });

  it('setiap submenu punya induk yang berupa grup (tanpa href sendiri)', () => {
    for (const m of MENU_UNTUK_UJI) {
      if (!m.anak) continue;
      // grup seperti Parameter/Pegawai tidak punya halaman sendiri;
      // Laporan punya karena ada halaman /laporan
      if (m.label === 'Laporan') continue;
      expect(m.href).toBeUndefined();
    }
  });
});

describe('menu Parameter', () => {
  it('admin melihat Parameter berisi Cabang dan Periode', () => {
    const menu = saringMenu('ADMIN');
    const parameter = menu.find((m) => m.label === 'Parameter');
    expect(parameter).toBeDefined();
    const anak = parameter!.anak!.map((a) => a.label);
    expect(anak).toContain('Cabang');
    expect(anak).toContain('Periode');
  });

  it('Cabang dan Periode tidak lagi jadi menu terpisah di tingkat atas', () => {
    const menu = saringMenu('ADMIN');
    expect(label(menu)).not.toContain('Cabang');
    expect(label(menu)).not.toContain('Periode');
  });

  it('manager tidak melihat Parameter (bukan admin)', () => {
    const menu = saringMenu('MANAGER');
    expect(label(menu)).not.toContain('Parameter');
  });

  it('supervisor tidak melihat Parameter', () => {
    const menu = saringMenu('SUPERVISOR');
    expect(label(menu)).not.toContain('Parameter');
  });

  it('pegawai tidak melihat Parameter', () => {
    const menu = saringMenu('PEGAWAI');
    expect(label(menu)).not.toContain('Parameter');
  });

  it('grup tanpa anak yang boleh diakses tidak ditampilkan', () => {
    // Pegawai: supervisor hanya berhak "Usul Pegawai", dan grupnya tetap
    // tampil karena masih ada anak yang boleh
    const menu = saringMenu('SUPERVISOR');
    const pegawai = menu.find((m) => m.label === 'Pegawai');
    expect(pegawai).toBeDefined();
    expect(pegawai!.anak!.map((a) => a.label)).toEqual(['Usul Pegawai']);
  });
});
