import { describe, it, expect } from 'vitest';
import {
  periodeBulan,
  periodeTahun,
  periodeDariTanggal,
  jumlahHariBulan,
  selisihHari,
  rentangSingkat,
  labelLaporan,
  AMBANG_BUANG_SISA,
  NAMA_HARI,
} from './periode';

const MINGGU = 0;
const SENIN = 1;
const SELASA = 2;
const RABU = 3;
const KAMIS = 4;
const JUMAT = 5;
const SABTU = 6;

/**
 * ATURAN v3 (dikonfirmasi pemilik aplikasi 3 Okt 2026):
 *
 *   A. satu pekan = MINGGU–SABTU
 *   B. sisa 1-3 hari di ujung bulan DIBUANG ke pekan sebelumnya
 *      (sisa 4-6 hari jadi pekan tersendiri)
 *   C. bagian awal bulan menurut hari tanggal 1:
 *        - SESUDAH hari penilaian (Kamis/Jumat/Sabtu, untuk Rabu)
 *          → digabung ke pekan berikutnya
 *        - TEPAT hari penilaian (Rabu) → pekan tersendiri Rabu–Sabtu
 *        - SEBELUM hari penilaian (Senin/Selasa) → tgl 1 sampai Sabtu
 *        - MINGGU → pekan-1 tepat 7 hari
 *
 * Konsekuensi: beberapa tanggal di awal bulan dan 1-3 hari di ujung bulan
 * TIDAK masuk pekan mana pun. Itu disengaja, bukan bug.
 */

describe('periodeBulan — aturan v3', () => {
  it('A: pekan lanjutan selalu Minggu–Sabtu, tepat 7 hari', () => {
    const p = periodeBulan(2026, 11, RABU); // November 2026 seluruhnya rapi
    for (const pekan of p) {
      expect(pekan.mulai.getDay()).toBe(MINGGU);
      expect(pekan.selesai.getDay()).toBe(SABTU);
      expect(pekan.jumlahHari).toBe(7);
    }
  });

  it('B: sisa yang memuat hari penilaian TIDAK dibuang (September 2026)', () => {
    // 30 Sep 2026 = Rabu = hari penilaian. Sabtu terakhir 26 Sep, sisa
    // 27-30 Sep (Minggu, Senin, Selasa, RABU) → ada hari penilaian, jadi
    // TIDAK dibuang melainkan jadi pekan ke-5 (keputusan pemilik 3 Okt 2026).
    const sep = periodeBulan(2026, 9, RABU);
    expect(sep).toHaveLength(5);
    expect(sep[4].nama).toBe('Minggu ke-5 September 2026');
    expect(sep[4].mulai.getDate()).toBe(27);
    expect(sep[4].selesai.getDate()).toBe(30);
    expect(sep[4].selesai.getDay()).toBe(RABU);
  });

  it('B: sisa TANPA hari penilaian tetap dibuang (Maret 2026)', () => {
    // 31 Mar 2026 = Selasa. Sisa 29-31 Mar (Minggu, Senin, Selasa) tidak
    // memuat Rabu → dibuang, bulan ditutup Sabtu 28 Mar.
    const mar = periodeBulan(2026, 3, RABU);
    expect(mar).toHaveLength(4);
    expect(mar[mar.length - 1].selesai.getDate()).toBe(28);
    expect(mar[mar.length - 1].selesai.getDay()).toBe(SABTU);
  });

  it('B: sisa 5-6 hari jadi pekan terakhir yang berhenti di akhir bulan', () => {
    // Desember 2026: 31 Des = Kamis. Pekan 27-31 Des (5 hari) → jadi pekan
    // terakhir karena Sabtu berikutnya (2 Jan) sudah lewat batas bulan.
    const des = periodeBulan(2026, 12, RABU);
    expect(des[des.length - 1].mulai.getDate()).toBe(27);
    expect(des[des.length - 1].selesai.getDate()).toBe(31);
    expect(des[des.length - 1].jumlahHari).toBe(5);
  });

  it('B: sisa 1-3 hari dibuang — 31 Des 2026 tetap di pekan terakhir Desember', () => {
    const des = periodeBulan(2026, 12, RABU);
    expect(des[des.length - 1].selesai.getDate()).toBe(31);
    expect(des[des.length - 1].selesai.getMonth()).toBe(11);
  });

  it('C: tgl 1 Kamis → digabung ke pekan berikutnya (Oktober 2026)', () => {
    expect(new Date(2026, 9, 1).getDay()).toBe(KAMIS);
    const p = periodeBulan(2026, 10, RABU);
    expect(p).toHaveLength(4);
    expect(p.map((x) => `${x.mulai.getDate()}-${x.selesai.getDate()}`)).toEqual([
      '4-10',
      '11-17',
      '18-24',
      '25-31',
    ]);
    expect(p[0].mulai.getDay()).toBe(MINGGU);
  });

  it('C: tgl 1 Jumat → digabung ke pekan berikutnya (Mei 2026)', () => {
    expect(new Date(2026, 4, 1).getDay()).toBe(JUMAT);
    const p = periodeBulan(2026, 5, RABU);
    expect(p.map((x) => `${x.mulai.getDate()}-${x.selesai.getDate()}`)).toEqual([
      '3-9',
      '10-16',
      '17-23',
      '24-30',
    ]);
  });

  it('C: tgl 1 Sabtu → digabung ke pekan berikutnya (Agustus 2026)', () => {
    expect(new Date(2026, 7, 1).getDay()).toBe(SABTU);
    const p = periodeBulan(2026, 8, RABU);
    expect(p.map((x) => `${x.mulai.getDate()}-${x.selesai.getDate()}`)).toEqual([
      '2-8',
      '9-15',
      '16-22',
      '23-29',
    ]);
  });

  it('C: tgl 1 tepat hari penilaian (Rabu) → pekan tersendiri Rabu–Sabtu', () => {
    expect(new Date(2026, 3, 1).getDay()).toBe(RABU); // 1 April 2026
    const p = periodeBulan(2026, 4, RABU);
    expect(p[0].mulai.getDate()).toBe(1);
    expect(p[0].mulai.getDay()).toBe(RABU);
    expect(p[0].selesai.getDate()).toBe(4);
    expect(p[0].jumlahHari).toBe(4);
    expect(p[1].mulai.getDate()).toBe(5);
    expect(p[1].mulai.getDay()).toBe(MINGGU);
  });

  it('C: tgl 1 Senin/Selasa → pekan-1 = tgl 1 sampai Sabtu', () => {
    expect(new Date(2026, 5, 1).getDay()).toBe(SENIN); // 1 Juni 2026
    const jun = periodeBulan(2026, 6, RABU);
    expect(jun[0].mulai.getDate()).toBe(1);
    expect(jun[0].selesai.getDate()).toBe(6); // Sabtu
    expect(jun[0].jumlahHari).toBe(6);

    expect(new Date(2026, 8, 1).getDay()).toBe(SELASA); // 1 September 2026
    const sep = periodeBulan(2026, 9, RABU);
    expect(sep[0].mulai.getDate()).toBe(1);
    expect(sep[0].selesai.getDate()).toBe(5);
    expect(sep[0].jumlahHari).toBe(5);
  });

  it('C: tgl 1 Minggu → pekan-1 tepat 7 hari', () => {
    expect(new Date(2026, 1, 1).getDay()).toBe(MINGGU); // 1 Feb 2026
    const feb = periodeBulan(2026, 2, RABU);
    expect(feb[0].mulai.getDate()).toBe(1);
    expect(feb[0].selesai.getDate()).toBe(7);
    expect(feb[0].jumlahHari).toBe(7);
  });

  it('aturan inti: TIDAK ADA pekan yang menyeberang bulan', () => {
    for (const tahun of [2025, 2026, 2027]) {
      for (let b = 1; b <= 12; b++) {
        for (const pekan of periodeBulan(tahun, b, RABU)) {
          expect(pekan.mulai.getMonth(), `${pekan.nama} mulai`).toBe(b - 1);
          expect(pekan.selesai.getMonth(), `${pekan.nama} selesai`).toBe(b - 1);
        }
      }
    }
  });

  it('tidak ada pekan di bawah 4 hari', () => {
    for (let b = 1; b <= 12; b++) {
      for (const pekan of periodeBulan(2026, b, RABU)) {
        expect(
          pekan.jumlahHari,
          `${pekan.nama} = ${pekan.jumlahHari} hari`
        ).toBeGreaterThanOrEqual(4);
      }
    }
  });

  it('pekan-1 mulai antara tanggal 1 dan 4', () => {
    // Batas atasnya 4 hari, bukan 3: kalau tgl 1 jatuh Sabtu, bagian awal
    // (1 hari) digabung ke pekan berikutnya sehingga pekan-1 mulai tgl 2.
    // Kalau sisa ujung bulan sebelumnya 4-6 hari, pekan-1 bisa mulai tgl 4.
    for (const tahun of [2025, 2026, 2027]) {
      for (let b = 1; b <= 12; b++) {
        const p = periodeBulan(tahun, b, RABU);
        const tgl = p[0].mulai.getDate();
        expect(tgl, `${p[0].nama} mulai tgl ${tgl}`).toBeGreaterThanOrEqual(1);
        expect(tgl, `${p[0].nama} mulai tgl ${tgl}`).toBeLessThanOrEqual(4);
      }
    }
  });

  it('pekan terakhir berakhir di Sabtu ATAU di akhir bulan, tidak pernah di tengah', () => {
    // Kalau sisa ujung bulan 1-3 hari → dibuang, bulan tutup di Sabtu.
    // Kalau sisa 4-6 hari → pekan terakhir berhenti di akhir bulan
    // (bisa Rabu/Kamis/Jumat — hari apa pun, karena tidak menyeberang bulan).
    for (const tahun of [2025, 2026, 2027]) {
      for (let b = 1; b <= 12; b++) {
        const p = periodeBulan(tahun, b, RABU);
        const terakhir = p[p.length - 1];
        const akhirBulan = jumlahHariBulan(tahun, b);
        const diAkhirBulan = terakhir.selesai.getDate() === akhirBulan;
        const diSabtu = terakhir.selesai.getDay() === SABTU;
        expect(
          diAkhirBulan || diSabtu,
          `${terakhir.nama} berakhir ${terakhir.selesai.getDate()} (${NAMA_HARI[terakhir.selesai.getDay()]})`
        ).toBe(true);
      }
    }
  });

  it('nomor & kode pekan berurutan', () => {
    const p = periodeBulan(2026, 10, RABU);
    p.forEach((pekan, i) => {
      expect(pekan.nomor).toBe(i + 1);
      expect(pekan.nama).toBe(`Minggu ke-${i + 1} Oktober 2026`);
      expect(pekan.kode).toBe(`2026-10-W${i + 1}`);
    });
  });

  it('aturan mengikuti hari penilaian yang berlaku, bukan selalu Rabu', () => {
    // 1 Juni 2026 = Senin. Kalau hari penilaian juga Senin, tgl 1 TEPAT hari
    // penilaian → pekan tersendiri Senin–Sabtu (6 hari).
    const senin = periodeBulan(2026, 6, SENIN);
    expect(senin[0].mulai.getDate()).toBe(1);
    expect(senin[0].selesai.getDate()).toBe(6);
    expect(senin[0].jumlahHari).toBe(6);

    // Kalau hari penilaian Minggu, setiap hari lain ada "setelah" hari
    // penilaian → tgl 1 Senin digabung ke pekan berikutnya.
    const minggu = periodeBulan(2026, 6, MINGGU);
    expect(minggu[0].mulai.getDate()).toBe(7);
    expect(minggu[0].mulai.getDay()).toBe(MINGGU);
  });
});

describe('periodeTahun', () => {
  it('menggabungkan hasil 12 bulan', () => {
    const t = periodeTahun(2026, RABU);
    const jumlahManual = Array.from({ length: 12 }, (_, i) =>
      periodeBulan(2026, i + 1, RABU).length
    ).reduce((a, b) => a + b, 0);
    expect(t).toHaveLength(jumlahManual);
  });

  it('2026 = 52 pekan (hasil aturan v3, bukan target)', () => {
    // Angka ini hasil mesin. Kalau mesin berubah, angka ini harus berubah
    // SADAR — bukan disesuaikan supaya test lulus.
    expect(periodeTahun(2026, RABU)).toHaveLength(52);
  });

  it('tidak ada pekan lintas bulan sepanjang tahun', () => {
    const nyebrang = periodeTahun(2026, RABU).filter(
      (p) => p.mulai.getMonth() !== p.selesai.getMonth()
    );
    expect(nyebrang).toEqual([]);
  });

  it('kode pekan unik', () => {
    const t = periodeTahun(2026, RABU);
    const kode = t.map((p) => p.kode);
    expect(new Set(kode).size).toBe(kode.length);
    expect(kode[0]).toBe('2026-01-W1');
  });

  it('setiap bulan punya tepat satu pekan bernomor 1', () => {
    const t = periodeTahun(2026, RABU);
    for (let b = 1; b <= 12; b++) {
      expect(
        t.filter((p) => p.mulai.getMonth() === b - 1 && p.nomor === 1),
        `bulan ${b}`
      ).toHaveLength(1);
    }
  });
});

describe('periodeDariTanggal', () => {
  it('menemukan pekan yang memuat tanggal tertentu', () => {
    const p = periodeDariTanggal(new Date(2026, 9, 5), RABU);
    expect(p?.nama).toBe('Minggu ke-1 Oktober 2026');
  });

  it('tanggal 1-3 Oktober 2026 tidak masuk pekan mana pun (digabung ke depan)', () => {
    // Konsekuensi aturan: 1-3 Okt (Kamis-Sabtu) digabung ke pekan 4-10 Okt
    // sehingga tanggal itu tidak punya pekan sendiri.
    expect(periodeDariTanggal(new Date(2026, 9, 1), RABU)).toBeNull();
    expect(periodeDariTanggal(new Date(2026, 9, 3), RABU)).toBeNull();
    expect(periodeDariTanggal(new Date(2026, 9, 4), RABU)?.nama).toBe('Minggu ke-1 Oktober 2026');
  });

  it('melempar untuk hari penilaian yang tidak valid', () => {
    expect(() => periodeDariTanggal(new Date(2026, 9, 15), 99 as unknown as number)).toThrow();
  });
});

describe('format tampilan', () => {
  it('rentangSingkat & labelLaporan mengikuti tanggal pekan yang berlaku', () => {
    const p = periodeBulan(2026, 10, RABU)[0];
    expect(rentangSingkat(p)).toBe('4 Okt – 10 Okt 2026');
    expect(labelLaporan(p)).toBe('Minggu ke-1 Oktober 2026 (4 Okt – 10 Okt 2026)');
  });
});

describe('utilitas', () => {
  it('NAMA_HARI menomori Minggu = 0 (jebakan getDay)', () => {
    expect(NAMA_HARI[0]).toBe('Minggu');
    expect(NAMA_HARI[3]).toBe('Rabu');
    expect(NAMA_HARI[6]).toBe('Sabtu');
  });

  it('AMBANG_BUANG_SISA = 4 (sisa 1-3 hari dibuang)', () => {
    expect(AMBANG_BUANG_SISA).toBe(4);
  });

  it('selisihHari mengabaikan jam', () => {
    expect(selisihHari(new Date(2026, 9, 1, 23, 59), new Date(2026, 9, 11, 0, 1))).toBe(10);
  });
});

describe('validasi masukan', () => {
  it('menolak bulan tidak valid', () => {
    expect(() => periodeBulan(2026, 0, RABU)).toThrow();
    expect(() => periodeBulan(2026, 13, RABU)).toThrow();
  });

  it('menolak hari penilaian tidak valid', () => {
    expect(() => periodeBulan(2026, 10, -1)).toThrow();
    expect(() => periodeBulan(2026, 10, 7)).toThrow();
  });
});

describe('tahun kabisat', () => {
  it('Februari 2028 (kabisat, 29 hari) — 27-29 Feb dibuang karena cuma 3 hari', () => {
    expect(jumlahHariBulan(2028, 2)).toBe(29);
    const p = periodeBulan(2028, 2, RABU);
    // 29 Feb 2028 = Selasa, Sabtu terakhir = 26 Feb, sisa 3 hari → dibuang.
    expect(p[p.length - 1].selesai.getDate()).toBe(26);
    expect(p[p.length - 1].selesai.getDay()).toBe(SABTU);
  });
});
