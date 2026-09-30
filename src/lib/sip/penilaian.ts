/**
 * Mesin penilaian SIP — Bank BTN
 * ---------------------------------
 * Semua konstanta bisnis terpusat di sini supaya mudah diaudit dan diubah
 * tanpa menyentuh logika perhitungan.
 */

// ============================================================================
// 1. SKALA SKOR 1-100 -> SKALA 1-5
// ============================================================================
// Tabel konversi resmi. Dipakai untuk aspek yang nilainya berbasis angka
// 0-100 (mis. hasil quiz), bukan untuk aspek yang langsung dinilai 1-5.
//
// Catatan: "Istimewa 99-100" disetujui sebagai acuan TUNGGAL untuk semua aspek.
// Meskipun sebagian tabel sumber tertulis 93-100, keputusan final: 99-100.

export const SKALA_KONVERSI = [
  { skor: 5, min: 99, max: 100, label: 'Istimewa' },
  { skor: 4, min: 92, max: 98, label: 'Sangat Baik' },
  { skor: 3, min: 81, max: 91, label: 'Baik' },
  { skor: 2, min: 76, max: 80, label: 'Cukup' },
  { skor: 1, min: 0, max: 75, label: 'Kurang' },
] as const;

/**
 * Konversi nilai mentah 0-100 ke skor 1-5.
 * @param nilai nilai 0-100 (mis. hasil quiz)
 */
export function nilaiKeSkala(nilai: number): number {
  if (nilai < 0 || nilai > 100) {
    throw new RangeError(`Nilai harus 0-100, diterima: ${nilai}`);
  }
  const band = SKALA_KONVERSI.find((b) => nilai >= b.min && nilai <= b.max);
  if (!band) throw new RangeError(`Nilai ${nilai} tidak masuk band manapun`);
  return band.skor;
}

// ============================================================================
// 2. STRUKTUR PENILAIAN: 3 KATEGORI, 13 ASPEK
// ============================================================================

export type AspekDef = {
  kode: string;
  nama: string;
  /** bobot dalam persen (desimal), total per kategori = 1 */
  bobot: number;
  /** true kalau input berupa nilai 0-100 lalu dikonversi ke skor 1-5 */
  inputMentah?: boolean;
};

export type KategoriDef = {
  kode: 'A' | 'B' | 'C';
  nama: string;
  namaEn: string;
  /** bobot kategori dalam persen (desimal), total = 1 */
  bobot: number;
  aspek: AspekDef[];
};

export const KATEGORI: KategoriDef[] = [
  {
    kode: 'A',
    nama: 'Penampilan',
    namaEn: 'Appearance',
    bobot: 0.2,
    aspek: [
      { kode: 'A1', nama: 'Kerapihan Seragam & Kelengkapan Atribut', bobot: 0.4 },
      { kode: 'A2', nama: 'Kebersihan Diri (Grooming)', bobot: 0.3 },
      { kode: 'A3', nama: 'Sikap Tubuh & Ekspresi', bobot: 0.2 },
      { kode: 'A4', nama: 'Kelengkapan & Kebersihan Area Kerja', bobot: 0.1 },
    ],
  },
  {
    kode: 'B',
    nama: 'Kemampuan',
    namaEn: 'Skill',
    bobot: 0.5,
    aspek: [
      { kode: 'B1', nama: 'Tes Kemampuan - Quiz', bobot: 0.2, inputMentah: true },
      { kode: 'B2', nama: 'Kesesuaian Alur Pelayanan', bobot: 0.25 },
      { kode: 'B3', nama: 'Pengetahuan Produk & Solusi', bobot: 0.25 },
      { kode: 'B4', nama: 'Ketelitian', bobot: 0.15 },
      { kode: 'B5', nama: 'Kemampuan Berkomunikasi', bobot: 0.15 },
    ],
  },
  {
    kode: 'C',
    nama: 'Sikap',
    namaEn: 'Attitude',
    bobot: 0.3,
    aspek: [
      { kode: 'C1', nama: 'Keramahan & Sopan Santun', bobot: 0.3 },
      { kode: 'C2', nama: 'Inisiatif', bobot: 0.3 },
      { kode: 'C3', nama: 'Tata Bahasa & Intonasi', bobot: 0.2 },
      { kode: 'C4', nama: 'Body Language', bobot: 0.2 },
    ],
  },
];

// ============================================================================
// 3. PERFORMANCE RATING (BATAS NILAI AKHIR, SKALA 0-5)
// ============================================================================

export type PerformanceBand = {
  label: string;
  labelEn: string;
  min: number;
  max: number;
};

// Diurut dari tertinggi. Batas min/max bersifat inklusif dan kontinu.
export const PERFORMANCE_RATING: PerformanceBand[] = [
  { label: 'Istimewa',    labelEn: 'Outstanding', min: 4.8,  max: 5.0  },
  { label: 'Sangat Baik', labelEn: 'Very Good',   min: 4.6,  max: 4.79 },
  { label: 'Baik',        labelEn: 'Good',        min: 4.0,  max: 4.59 },
  { label: 'Cukup',       labelEn: 'Fair',        min: 3.6,  max: 3.99 },
  { label: 'Kurang',      labelEn: 'Poor',        min: 0.0,  max: 3.59 },
];

export function ratingDariNilai(nilaiAkhir: number): PerformanceBand {
  const v = Math.round(nilaiAkhir * 100) / 100; // buang galat floating point
  const band = PERFORMANCE_RATING.find((b) => v >= b.min && v <= b.max);
  if (!band) throw new RangeError(`Nilai akhir ${nilaiAkhir} di luar rentang 0-5`);
  return band;
}

// ============================================================================
// 4. PERHITUNGAN
// ============================================================================

export type InputAspek = {
  kode: string;
  /** skor 1-5, ATAU nilai 0-100 kalau aspek bertanda inputMentah */
  nilai: number;
};

export type HasilKategori = {
  kode: 'A' | 'B' | 'C';
  nama: string;
  /** nilai kategori pada skala 0-5 */
  nilai: number;
  bobot: number;
  /** kontribusi ke nilai akhir */
  kontribusi: number;
};

export type HasilPenilaian = {
  kategori: HasilKategori[];
  nilaiAkhir: number;
  rating: PerformanceBand;
};

/**
 * Menghitung nilai akhir penilaian SIP.
 *
 * Rumus:
 *   nilai_aspek      = skor 1-5 (atau konversi dari nilai 0-100)
 *   nilai_kategori   = Σ (nilai_aspek × bobot_aspek)          -> skala 1-5
 *   nilai_akhir      = Σ (nilai_kategori × bobot_kategori)    -> skala 0-5
 *
 * @throws kalau ada aspek yang belum diisi atau nilainya tidak valid
 */
export function hitungPenilaian(input: InputAspek[]): HasilPenilaian {
  const map = new Map(input.map((i) => [i.kode, i.nilai]));

  const kategori: HasilKategori[] = KATEGORI.map((kat) => {
    let nilaiKategori = 0;

    for (const asp of kat.aspek) {
      const raw = map.get(asp.kode);
      if (raw === undefined) {
        throw new Error(`Aspek ${asp.kode} (${asp.nama}) belum dinilai`);
      }

      // Aspek bertanda inputMentah menerima 0-100 lalu dikonversi;
      // sisanya menerima skor 1-5 langsung.
      const skor = asp.inputMentah ? nilaiKeSkala(raw) : raw;

      if (!asp.inputMentah && (skor < 1 || skor > 5)) {
        throw new RangeError(`Skor ${asp.kode} harus 1-5, diterima: ${skor}`);
      }

      nilaiKategori += skor * asp.bobot;
    }

    const bulat = Math.round(nilaiKategori * 100) / 100;
    return {
      kode: kat.kode,
      nama: kat.nama,
      nilai: bulat,
      bobot: kat.bobot,
      kontribusi: Math.round(bulat * kat.bobot * 100) / 100,
    };
  });

  const nilaiAkhir = Math.round(
    kategori.reduce((acc, k) => acc + k.nilai * k.bobot, 0) * 100
  ) / 100;

  return { kategori, nilaiAkhir, rating: ratingDariNilai(nilaiAkhir) };
}
