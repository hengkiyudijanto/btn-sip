/**
 * Mesin perhitungan periode penilaian SIP.
 *
 * ATURAN RESMI v3 (dikonfirmasi pemilik aplikasi, 3 Okt 2026) —
 * MENGGANTIKAN aturan "tanggal 1 selalu awal pekan":
 *
 *   A. Satu pekan = MINGGU sampai SABTU (7 hari).
 *   B. Sisa 1-3 hari di ujung bulan (berakhir Minggu/Senin/Selasa) DIBUANG ke
 *      pekan sebelumnya, sehingga bulan berakhir tepat di Sabtu.
 *      Sisa 4-6 hari menjadi pekan TERSENDIRI.
 *   C. Bagian awal bulan, menurut hari tanggal 1:
 *        - KAMIS/JUMAT/SABTU (hari setelah hari penilaian Rabu)
 *          → digabung ke pekan BERIKUTNYA, karena pekan berikutnya punya
 *            hari penilaian Rabu sendiri
 *        - RABU → pekan TERSENDIRI (Rabu-Sabtu), alasan sama
 *        - SENIN/SELASA → pekan-1 = tgl 1 sampai Sabtu
 *        - MINGGU → pekan-1 tepat 7 hari
 *
 * Konsekuensi yang harus dipahami (dan disebut ke user kalau ia bertanya):
 *   - Periode TIDAK selalu mulai tanggal 1; beberapa bulan mulai tanggal 2
 *     atau 3 karena bagian awalnya digabung ke pekan berikutnya.
 *   - Panjang pekan bervariasi 4-7 hari; pekan 4 hari hanya pada kasus Rabu
 *     di awal bulan dan sisa ujung bulan.
 *   - Beberapa hari di ujung/bulan sebelumnya tidak masuk pekan mana pun
 *     (sisa 1-3 hari yang dibuang, dan bagian awal yang digabung ke depan).
 *     Itu disengaja, bukan salah hitung.
 *
 * Penamaan: "Minggu ke-N <Bulan> <Tahun>", N = nomor urut dalam bulan itu.
 * BUKAN nomor minggu ISO.
 */

export const NAMA_HARI = [
  'Minggu',
  'Senin',
  'Selasa',
  'Rabu',
  'Kamis',
  'Jumat',
  'Sabtu',
] as const;

/** Senin = 1 ... Minggu = 0 (mengikuti Date.getDay()) */
export const HARI_PENILAIAN_DEFAULT = 3; // Rabu

/**
 * Sisa hari di ujung bulan yang lebih pendek dari ini akan DIBUANG ke pekan
 * sebelumnya (bulan ditutup tepat di Sabtu). Sisa yang sama atau lebih besar
 * menjadi pekan tersendiri.
 *
 * Nilai 4 berarti: sisa 1-3 hari dibuang; sisa 4-6 hari jadi pekan sendiri.
 * Dipilih pemilik aplikasi: sisa yang berakhir Minggu/Senin/Selasa dianggap
 * terlalu pendek untuk dinilai secara wajar.
 */
export const AMBANG_BUANG_SISA = 4;

export type HariPeriode = {
  /** nomor urut dalam bulan, mulai 1 */
  nomor: number;
  /** tanggal mulai (pukul 00:00 waktu lokal) */
  mulai: Date;
  /** tanggal akhir, inklusif (pukul 00:00 waktu lokal) */
  selesai: Date;
  /** jumlah hari dalam periode (inklusif) */
  jumlahHari: number;
  /** nama periode, mis. "Minggu ke-1 Oktober 2026" */
  nama: string;
  /** kode unik, mis. "2026-10-W1" */
  kode: string;
  /** true bila periode ini hasil penggabungan periode pendek */
  digabung?: boolean;
};

const NAMA_BULAN = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

/** Tanggal 1 bulan tersebut, waktu lokal */
function tanggalSatu(tahun: number, bulan: number): Date {
  return new Date(tahun, bulan - 1, 1);
}

/** Jumlah hari dalam bulan (bulan 1-12) */
export function jumlahHariBulan(tahun: number, bulan: number): number {
  return new Date(tahun, bulan, 0).getDate();
}

/**
 * Sabtu pada minggu yang memuat tanggal tersebut (Minggu=0 … Sabtu=6).
 *
 * Aturan B: pekan berjalan Minggu–Sabtu, jadi akhir pekan adalah SABTU,
 * bukan Minggu seperti aturan lama. Jarak ke Sabtu adalah (6 − getDay() + 7) % 7.
 */
function sabtuDiMingguItu(tgl: Date): Date {
  const salinan = new Date(tgl);
  const jarakKeSabtu = (6 - salinan.getDay() + 7) % 7;
  salinan.setDate(salinan.getDate() + jarakKeSabtu);
  return salinan;
}

/** Selisih hari (b - a), mengabaikan jam */
export function selisihHari(a: Date, b: Date): number {
  const A = new Date(a.getFullYear(), a.getMonth(), a.getDate()).getTime();
  const B = new Date(b.getFullYear(), b.getMonth(), b.getDate()).getTime();
  return Math.round((B - A) / 86_400_000);
}

/**
 * Susun daftar periode untuk satu bulan.
 *
 * @param tahun          tahun (mis. 2026)
 * @param bulan          bulan 1-12
 * @param hariPenilaian  0=Minggu, 1=Senin, ... 6=Sabtu
 */
export function periodeBulan(
  tahun: number,
  bulan: number,
  hariPenilaian: number = HARI_PENILAIAN_DEFAULT
): HariPeriode[] {
  if (bulan < 1 || bulan > 12) throw new Error(`Bulan tidak valid: ${bulan}`);
  if (hariPenilaian < 0 || hariPenilaian > 6) {
    throw new Error(`Hari penilaian tidak valid: ${hariPenilaian}`);
  }

  const namaBulan = NAMA_BULAN[bulan - 1];
  const akhirBulan = new Date(tahun, bulan - 1, jumlahHariBulan(tahun, bulan));
  const awal = tanggalSatu(tahun, bulan);
  const posisi = awal.getDay(); // 0=Minggu, 1=Senin, ... 6=Sabtu

  // ===== B: sisa di ujung bulan =====
  // Sabtu terakhir yang masih di dalam bulan ini. Sisa = hari sesudahnya (0-6).
  //
  // Aturan buang sisa:
  //   - sisa 1-3 hari (berakhir Minggu/Senin/Selasa) → DIBUANG ke pekan sebelumnya
  //   - **KECUALI kalau di dalam sisa itu ada hari penilaian (Rabu)** → sisa itu
  //     TETAP menjadi pekan tersendiri, karena hari penilaian harus punya pekan
  //     (keputusan pemilik aplikasi, 3 Okt 2026)
  //   - sisa 4-6 hari → pekan tersendiri sampai akhir bulan
  const geserKeSabtu = akhirBulan.getDay() === 6 ? 0 : (akhirBulan.getDay() + 1) % 7;
  const sabtuTerakhir = new Date(akhirBulan);
  sabtuTerakhir.setDate(sabtuTerakhir.getDate() - geserKeSabtu);
  const sisaUjung = selisihHari(sabtuTerakhir, akhirBulan); // 0..6

  // apakah ada hari penilaian di dalam sisa itu?
  let adaHariPenilaianDiSisa = false;
  for (let i = 1; i <= sisaUjung; i++) {
    const t = new Date(sabtuTerakhir);
    t.setDate(t.getDate() + i);
    if (t.getDay() === hariPenilaian) adaHariPenilaianDiSisa = true;
  }

  const buangSisa =
    sisaUjung >= 1 && sisaUjung < AMBANG_BUANG_SISA && !adaHariPenilaianDiSisa;
  const akhirEfektif = buangSisa ? sabtuTerakhir : new Date(akhirBulan);

  // ===== C: bagian awal bulan =====
  // "Hari setelah hari penilaian" dihitung dari HARI PENILAIAN yang berlaku,
  // bukan selalu Rabu — kalau admin mengganti hari penilaian, aturannya ikut.
  const potongan: { mulai: Date; selesai: Date }[] = [];
  const hariSetelahPenilaian = new Set([0, 1, 2, 4, 5, 6].filter((h) => h > hariPenilaian));
  const awalMasukPekanBerikutnya = hariSetelahPenilaian.has(posisi);
  const awalJadiPekanSendiri = posisi === hariPenilaian;

  if (awalMasukPekanBerikutnya) {
    // KAMIS/JUMAT/SABTU (hari setelah hari penilaian): digabung ke pekan
    // berikutnya, karena pekan berikutnya punya hari penilaian sendiri.
    const sabtuPertama = new Date(awal);
    sabtuPertama.setDate(sabtuPertama.getDate() + (6 - posisi));
    // mulai dari Minggu berikutnya; kalau sudah melewati akhir bulan,
    // tidak ada pekan sama sekali (bulan sangat pendek) — dijaga di bawah
    if (sabtuPertama < akhirEfektif) {
      const mingguDepan = new Date(sabtuPertama);
      mingguDepan.setDate(mingguDepan.getDate() + 1);
      potongan.push({ mulai: mingguDepan, selesai: sabtuDiMingguItu(mingguDepan) });
    }
  } else if (awalJadiPekanSendiri) {
    // RABU (hari penilaian): pekan tersendiri Rabu-Sabtu.
    const sabtuPertama = new Date(awal);
    sabtuPertama.setDate(sabtuPertama.getDate() + (6 - posisi));
    potongan.push({ mulai: new Date(awal), selesai: sabtuPertama });
  } else {
    // Minggu/Senin/Selasa: pekan-1 = tgl 1 sampai Sabtu.
    const sabtuPertama = new Date(awal);
    sabtuPertama.setDate(sabtuPertama.getDate() + (6 - posisi));
    potongan.push({ mulai: new Date(awal), selesai: sabtuPertama });
  }

  // ===== pekan lanjutan (Minggu–Sabtu penuh) =====
  let mulai = potongan.length
    ? new Date(potongan[potongan.length - 1].selesai)
    : new Date(awal);
  if (potongan.length) mulai.setDate(mulai.getDate() + 1);

  let penjaga = 0;
  while (mulai <= akhirEfektif && penjaga++ < 10) {
    const sabtu = sabtuDiMingguItu(mulai);
    let selesai: Date;
    if (sabtu <= akhirBulan) {
      // pekan normal Minggu–Sabtu (boleh melewati `akhirEfektif`, karena
      // akhirEfektif hanya menandai sampai mana pekan dihitung)
      selesai = sabtu;
    } else {
      // Pekan ini akan melewati akhir bulan.
      // Baca `akhirEfektif`, JANGAN hitung ulang dari keAkhirBulan: keputusan
      // buang/tidak-buang sisa sudah dibuat di langkah B, dan menghitung ulang
      // di sini membatalkannya (bug: September 2026 punya Rabu di sisanya
      // tetapi tetap dibuang).
      selesai = new Date(akhirEfektif);
    }
    if (selisihHari(mulai, selesai) < 0) break; // pekan kosong, jangan dibuat
    potongan.push({ mulai: new Date(mulai), selesai });
    const berikutnya = new Date(selesai);
    berikutnya.setDate(berikutnya.getDate() + 1);
    if (berikutnya > akhirEfektif) break;
    mulai = berikutnya;
  }

  // ===== beri nama =====
  return potongan.map((p, i) => ({
    nomor: i + 1,
    mulai: p.mulai,
    selesai: p.selesai,
    jumlahHari: selisihHari(p.mulai, p.selesai) + 1,
    nama: `Minggu ke-${i + 1} ${namaBulan} ${tahun}`,
    kode: `${tahun}-${String(bulan).padStart(2, '0')}-W${i + 1}`,
  }));
}

/** Susun periode untuk satu tahun penuh (Januari s/d Desember) */
export function periodeTahun(
  tahun: number,
  hariPenilaian: number = HARI_PENILAIAN_DEFAULT
): HariPeriode[] {
  const semua: HariPeriode[] = [];
  for (let b = 1; b <= 12; b++) semua.push(...periodeBulan(tahun, b, hariPenilaian));
  return semua;
}

/** Format tanggal Indonesia, mis. "1 Oktober 2026" */
export function tanggalIndonesia(tgl: Date): string {
  return `${tgl.getDate()} ${NAMA_BULAN[tgl.getMonth()]} ${tgl.getFullYear()}`;
}

/** Format rentang singkat, mis. "1 Okt – 11 Okt 2026" */
export function rentangSingkat(p: HariPeriode): string {
  const b1 = NAMA_BULAN[p.mulai.getMonth()].slice(0, 3);
  const b2 = NAMA_BULAN[p.selesai.getMonth()].slice(0, 3);
  const th = p.selesai.getFullYear();
  return `${p.mulai.getDate()} ${b1} – ${p.selesai.getDate()} ${b2} ${th}`;
}

/** Label lengkap untuk laporan, mis. "Minggu ke-1 Oktober 2026 (1 Okt – 11 Okt 2026)" */
export function labelLaporan(p: HariPeriode): string {
  return `${p.nama} (${rentangSingkat(p)})`;
}

/** Cari periode yang memuat tanggal tertentu */
export function periodeDariTanggal(
  tgl: Date,
  hariPenilaian: number = HARI_PENILAIAN_DEFAULT
): HariPeriode | null {
  const daftar = periodeBulan(tgl.getFullYear(), tgl.getMonth() + 1, hariPenilaian);
  const t = new Date(tgl.getFullYear(), tgl.getMonth(), tgl.getDate());
  return (
    daftar.find((p) => t >= p.mulai && t <= p.selesai) ?? null
  );
}
