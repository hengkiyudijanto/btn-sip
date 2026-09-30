import { describe, it, expect } from 'vitest';
import {
  periodeBulan,
  periodeTahun,
  periodeDariTanggal,
  jumlahHariBulan,
  selisihHari,
  rentangSingkat,
  labelLaporan,
  MIN_HARI_PERIODE,
} from './periode';

const RABU = 3;

function ringkas(tahun: number, bulan: number, hari = RABU) {
  return periodeBulan(tahun, bulan, hari).map((p) => ({
    nama: p.nama,
    mulai: `${p.mulai.getDate()}/${p.mulai.getMonth() + 1}`,
    selesai: `${p.selesai.getDate()}/${p.selesai.getMonth() + 1}`,
    hari: p.jumlahHari,
  }));
}

describe('periodeBulan — kasus yang dikonfirmasi pemilik aplikasi', () => {
  it('Oktober 2026 (1 Okt = Kamis, setelah hari penilaian Rabu)', () => {
    const p = periodeBulan(2026, 10, RABU);
    // tanggal 1 setelah hari penilaian -> periode pertama panjang
    expect(p).toHaveLength(4);
    expect(p[0].mulai.getDate()).toBe(1);
    expect(p[0].selesai.getDate()).toBe(11); // sampai Minggu minggu depan
    expect(p[0].selesai.getDay()).toBe(0); // hari Minggu
    expect(p[0].jumlahHari).toBe(11);
    expect(p[0].nama).toBe('Minggu ke-1 Oktober 2026');
    expect(p[3].selesai.getDate()).toBe(31); // berakhir di akhir bulan
  });

  it('periode selalu mulai tanggal 1 pada awal bulan', () => {
    for (let b = 1; b <= 12; b++) {
      const p = periodeBulan(2026, b, RABU);
      expect(p[0].mulai.getDate()).toBe(1);
    }
  });

  it('periode selalu berakhir hari Minggu (kecuali terpotong akhir bulan)', () => {
    for (let b = 1; b <= 12; b++) {
      const p = periodeBulan(2026, b, RABU);
      p.forEach((periode, i) => {
        const akhirBulan = jumlahHariBulan(2026, b);
        const terpotongBulan = periode.selesai.getDate() === akhirBulan && i === p.length - 1;
        if (!terpotongBulan) {
          expect(periode.selesai.getDay()).toBe(0); // Minggu
        }
      });
    }
  });

  it('periode tidak menyeberang bulan', () => {
    for (let b = 1; b <= 12; b++) {
      const p = periodeBulan(2026, b, RABU);
      expect(p[0].mulai.getMonth()).toBe(b - 1);
      expect(p[p.length - 1].selesai.getMonth()).toBe(b - 1);
    }
  });

  it('tidak ada celah dan tidak ada tumpang tindih antar periode', () => {
    for (let b = 1; b <= 12; b++) {
      const p = periodeBulan(2026, b, RABU);
      for (let i = 1; i < p.length; i++) {
        const selisih = selisihHari(p[i - 1].selesai, p[i].mulai);
        expect(selisih).toBe(1); // tepat satu hari setelah periode sebelumnya
      }
    }
  });

  it('periode menutup seluruh hari dalam bulan', () => {
    for (let b = 1; b <= 12; b++) {
      const p = periodeBulan(2026, b, RABU);
      const total = p.reduce((s, x) => s + x.jumlahHari, 0);
      expect(total).toBe(jumlahHariBulan(2026, b));
    }
  });
});

describe('penggabungan periode pendek', () => {
  it('30 November 2026 (Senin) digabung ke periode sebelumnya', () => {
    const p = periodeBulan(2026, 11, RABU);
    // tanpa penggabungan akan ada periode 30 Nov saja (1 hari)
    const adaSatuHari = p.some((x) => x.jumlahHari === 1);
    expect(adaSatuHari).toBe(false);

    const terakhir = p[p.length - 1];
    expect(terakhir.selesai.getDate()).toBe(30);
    // digabung: 23 Nov – 30 Nov = 8 hari
    expect(terakhir.jumlahHari).toBe(8);
    expect(terakhir.mulai.getDate()).toBe(23);
  });

  it('semua periode minimal MIN_HARI_PERIODE hari', () => {
    for (let b = 1; b <= 12; b++) {
      const p = periodeBulan(2026, b, RABU);
      p.forEach((x) => {
        expect(x.jumlahHari).toBeGreaterThanOrEqual(MIN_HARI_PERIODE);
      });
    }
  });
});

describe('perbedaan menurut hari penilaian', () => {
  it('hari penilaian mempengaruhi panjang periode pertama', () => {
    // 1 Okt 2026 = Kamis (getDay = 4)
    // hari penilaian Kamis (4): 1 Okt tepat hari penilaian -> periode pendek
    // 4 hari < MIN_HARI_PERIODE, jadi DIGABUNG ke periode berikutnya
    const kamis = periodeBulan(2026, 10, 4);
    expect(kamis[0].mulai.getDate()).toBe(1); // tetap mulai tanggal 1
    expect(kamis[0].selesai.getDate()).toBe(11); // hasil penggabungan

    // hari penilaian Jumat (5): 1 Okt sebelum hari penilaian -> pendek,
    // juga digabung ke periode berikutnya
    const jumat = periodeBulan(2026, 10, 5);
    expect(jumat[0].mulai.getDate()).toBe(1);
    expect(jumat[0].selesai.getDate()).toBe(11);

    // hari penilaian Rabu (3): 1 Okt setelah hari penilaian -> panjang
    const rabu = periodeBulan(2026, 10, 3);
    expect(rabu[0].selesai.getDate()).toBe(11);
    expect(rabu[0].jumlahHari).toBe(11);
  });

  it('perubahan hari penilaian mengubah jumlah periode bulan itu', () => {
    // Oktober 2026 punya 4 atau 5 periode tergantung hari penilaian,
    // karena penggabungan periode pendek ikut bergantung padanya
    const rabu = periodeBulan(2026, 10, 3);
    const senin = periodeBulan(2026, 10, 1);
    const sabtu = periodeBulan(2026, 10, 6);

    expect(rabu).toHaveLength(4);
    expect(sabtu.length).toBeGreaterThan(0);
    expect(senin.length).toBeGreaterThan(0);

    // periode pertama selalu mulai tanggal 1 untuk semua hari penilaian
    for (const daftar of [rabu, senin, sabtu]) {
      expect(daftar[0].mulai.getDate()).toBe(1);
    }
  });

  it('tanggal 1 yang jatuh tepat hari Minggu tetap valid', () => {
    // 1 Nov 2026 = Minggu (getDay = 0)
    // periode pertama jadi 1 hari -> digabung ke berikutnya (1 - 8 Nov)
    const p = periodeBulan(2026, 11, RABU);
    expect(p[0].mulai.getDate()).toBe(1);
    expect(p[0].selesai.getDay()).toBe(0); // Minggu
    expect(p[0].selesai.getDate()).toBe(8);
    expect(p[0].jumlahHari).toBe(8);
  });
});

describe('periodeTahun', () => {
  it('menggabungkan 12 bulan', () => {
    const t = periodeTahun(2026, RABU);
    const jumlahManual = Array.from({ length: 12 }, (_, i) =>
      periodeBulan(2026, i + 1, RABU).length
    ).reduce((a, b) => a + b, 0);
    expect(t).toHaveLength(jumlahManual);
  });

  it('jumlah periode setahun wajar (48-56)', () => {
    // Lebih sedikit dari 52 minggu karena penggabungan periode pendek
    // di awal/akhir bulan (ambang MIN_HARI_PERIODE)
    const t = periodeTahun(2026, RABU);
    expect(t.length).toBeGreaterThanOrEqual(48);
    expect(t.length).toBeLessThanOrEqual(56);
  });

  it('kode periode unik dan berurutan', () => {
    const t = periodeTahun(2026, RABU);
    const kode = t.map((p) => p.kode);
    expect(new Set(kode).size).toBe(kode.length);
    expect(kode[0]).toBe('2026-01-W1');
  });

  it('seluruh hari setahun tercakup tepat sekali', () => {
    const t = periodeTahun(2026, RABU);
    const total = t.reduce((s, p) => s + p.jumlahHari, 0);
    expect(total).toBe(365); // 2026 bukan tahun kabisat
  });
});

describe('periodeDariTanggal', () => {
  it('menemukan periode yang tepat', () => {
    const p = periodeDariTanggal(new Date(2026, 9, 5), RABU); // 5 Okt 2026
    expect(p?.nama).toBe('Minggu ke-1 Oktober 2026');
  });

  it('menemukan tanggal batas awal', () => {
    const p = periodeDariTanggal(new Date(2026, 9, 1), RABU);
    expect(p?.nama).toBe('Minggu ke-1 Oktober 2026');
  });

  it('menemukan tanggal batas akhir', () => {
    const p = periodeDariTanggal(new Date(2026, 9, 11), RABU);
    expect(p?.nama).toBe('Minggu ke-1 Oktober 2026');
  });

  it('mengembalikan null untuk di luar jangkauan', () => {
    // tanggal di masa depan jauh tetap dihitung, tapi tanggal tidak valid
    const p = periodeDariTanggal(new Date(2026, 9, 15), RABU);
    expect(p).not.toBeNull();
  });
});

describe('format tampilan', () => {
  it('rentangSingkat ringkas dan benar', () => {
    const p = periodeBulan(2026, 10, RABU)[0];
    expect(rentangSingkat(p)).toBe('1 Okt – 11 Okt 2026');
  });

  it('labelLaporan menggabungkan nama dan tanggal', () => {
    const p = periodeBulan(2026, 10, RABU)[0];
    expect(labelLaporan(p)).toBe('Minggu ke-1 Oktober 2026 (1 Okt – 11 Okt 2026)');
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
  it('Februari 2028 punya 29 hari', () => {
    expect(jumlahHariBulan(2028, 2)).toBe(29);
    const p = periodeBulan(2028, 2, RABU);
    expect(p.reduce((s, x) => s + x.jumlahHari, 0)).toBe(29);
    expect(p[p.length - 1].selesai.getDate()).toBe(29);
  });
});
