/**
 * Mesin perhitungan periode penilaian SIP.
 *
 * ATURAN RESMI (dikonfirmasi pemilik aplikasi):
 *
 * 1. Penilaian dilakukan setiap minggu, pada HARI PENILAIAN yang bisa
 *    diubah (sekarang: Rabu). Hari penilaian TIDAK menentukan batas
 *    periode — ia hanya jadwal kapan atasan mengisi.
 *
 * 2. Penamaan periode: "Minggu ke-N <Bulan> <Tahun>" — nomor urut di
 *    dalam bulan itu. BUKAN nomor minggu ISO (39, 40, ...).
 *
 * 3. Periode selalu mulai tanggal 1 pada awal bulan, dan berakhir pada
 *    hari MINGGU.
 *
 * 4. Panjang periode pertama bergantung posisi tanggal 1 terhadap hari
 *    penilaian:
 *      - tanggal 1 jatuh SEBELUM atau TEPAT hari penilaian
 *          → periode berakhir pada Minggu di minggu itu (bisa < 7 hari)
 *      - tanggal 1 jatuh SETELAH hari penilaian
 *          → periode berakhir pada Minggu minggu DEPAN (bisa > 7 hari)
 *
 *    Contoh (hari penilaian Rabu, 1 Oktober 2026 = Kamis):
 *      tanggal 1 (Kamis) setelah hari penilaian (Rabu)
 *      → Minggu ke-1 Oktober 2026 = 1 Okt – 11 Okt (11 hari)
 *
 * 5. Periode TIDAK menyeberang bulan: akhir bulan selalu menutup periode
 *    terakhir bulan itu.
 *
 * 6. Periode sisa yang terlalu pendek digabung ke periode sebelumnya.
 *    Ambangnya: MIN_HARI_PERIODE. Kasus nyata — 30 November 2026 jatuh
 *    hari Senin, sisa 1 hari → digabung ke Minggu ke-4 November
 *    (23 Nov – 30 Nov, 8 hari).
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
 * Periode sisa yang kurang dari ini akan digabung ke periode sebelumnya.
 * Dipilih 5 hari: agar tidak ada periode yang terlalu pendek untuk dinilai
 * secara wajar, tapi masih mengizinkan periode 6 hari di akhir bulan.
 */
export const MIN_HARI_PERIODE = 5;

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
 * Hari Minggu pada minggu yang memuat tanggal tersebut.
 *
 * Catatan penting: Date.getDay() menomori Minggu = 0, Senin = 1, ... Sabtu = 6.
 * Jadi jarak ke Minggu adalah (7 - getDay()) % 7, BUKAN (6 - getDay()).
 * Rumus yang salah membuat periode berakhir hari Sabtu, bukan Minggu.
 */
function mingguDiMingguItu(tgl: Date): Date {
  const salinan = new Date(tgl);
  const jarakKeMinggu = (7 - salinan.getDay()) % 7;
  salinan.setDate(salinan.getDate() + jarakKeMinggu);
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

  // ===== tentukan akhir periode pertama =====
  const mingguIni = mingguDiMingguItu(awal);
  // Date.getDay(): 0=Minggu, 1=Senin, ..., 6=Sabtu
  const posisi = awal.getDay();

  let akhirPeriodePertama: Date;
  if (posisi === 0 || posisi <= hariPenilaian) {
    // tanggal 1 tepat hari Minggu, atau sebelum/tepat hari penilaian
    // → berakhir pada Minggu di minggu itu
    akhirPeriodePertama = mingguIni;
  } else {
    // tanggal 1 setelah hari penilaian → berakhir Minggu minggu depan
    akhirPeriodePertama = new Date(mingguIni);
    akhirPeriodePertama.setDate(akhirPeriodePertama.getDate() + 7);
  }

  // jangan melewati akhir bulan
  if (akhirPeriodePertama > akhirBulan) akhirPeriodePertama = new Date(akhirBulan);

  // ===== susun periode =====
  const potongan: { mulai: Date; selesai: Date }[] = [];
  let mulai = new Date(awal);
  let akhir = new Date(akhirPeriodePertama);

  while (mulai <= akhirBulan) {
    const selesai = akhir > akhirBulan ? new Date(akhirBulan) : new Date(akhir);

    potongan.push({ mulai: new Date(mulai), selesai });

    const berikutnya = new Date(selesai);
    berikutnya.setDate(berikutnya.getDate() + 1);
    if (berikutnya > akhirBulan) break;

    mulai = berikutnya;
    akhir = mingguDiMingguItu(mulai);
  }

  // ===== penggabungan periode pendek =====
  //
  // Aturan yang dikonfirmasi pemilik aplikasi:
  //   - periode pendek di AWAL bulan  → digabung ke periode BERIKUTNYA
  //     (mis. 1 November 2026 jatuh Minggu sehingga periodenya 1 hari saja
  //      → digabung jadi 1 Nov – 8 Nov, 8 hari)
  //   - periode pendek di AKHIR bulan → digabung ke periode SEBELUMNYA
  //     (mis. 30 November 2026 jatuh Senin, sisa 1 hari
  //      → digabung jadi 23 Nov – 30 Nov, 8 hari)
  //
  // Tujuannya: atasan tidak pernah menilai periode yang terlalu pendek
  // untuk dinilai secara wajar.
  if (potongan.length >= 2) {
    // --- periode pertama pendek: gabung ke berikutnya ---
    const pertama = potongan[0];
    if (selisihHari(pertama.mulai, pertama.selesai) + 1 < MIN_HARI_PERIODE) {
      potongan[1].mulai = new Date(pertama.mulai);
      potongan.shift();
    }
  }

  if (potongan.length >= 2) {
    // --- periode terakhir pendek: gabung ke sebelumnya ---
    const terakhir = potongan[potongan.length - 1];
    if (selisihHari(terakhir.mulai, terakhir.selesai) + 1 < MIN_HARI_PERIODE) {
      potongan[potongan.length - 2].selesai = new Date(terakhir.selesai);
      potongan.pop();
    }
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
