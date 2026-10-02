/**
 * Perhitungan tren penilaian untuk dasbor.
 *
 * Semua angka dihitung di server dari baris penilaian nyata — tidak ada
 * grafik yang digambar dari data contoh. Tren dihitung per periode (minggu),
 * bukan per bulan, karena periode penilaian memang mingguan.
 *
 * Aturan penting: **periode tanpa penilaian tidak digambar sebagai nol.**
 * Nilai 0 berarti "Kurang", dan menggambar minggu kosong sebagai 0 membuat
 * garis tren jatuh ke dasar padahal yang terjadi adalah tidak ada data.
 * Periode seperti itu dilewati (`null`) dan ditandai di grafik.
 */

export type TitikTren = {
  /** label pendek untuk sumbu — "1–7 Okt" */
  label: string;
  /** nama lengkap periode, untuk tooltip */
  nama: string;
  /** nilai rata-rata 0–5, null = tidak ada penilaian di periode itu */
  nilai: number | null;
  jumlah: number;
};

export type SeriTren = {
  judul: string;
  keterangan: string;
  titik: TitikTren[];
  /** rata-rata seluruh titik yang ada datanya */
  rataRata: number | null;
  /** perubahan dibanding titik berdata terakhir sebelumnya */
  selisih: number | null;
  /** ringkasan per kategori (hanya untuk seri gabungan) */
  kategori?: { kode: string; nama: string; nilai: number }[];
};

/** Format rentang tanggal periode secara ringkas: "1–7 Okt" atau "29 Sep – 5 Okt". */
export function labelPeriode(mulai: Date, selesai: Date): string {
  const bulanPendek = (d: Date) =>
    d.toLocaleDateString('id-ID', { month: 'short' }).replace('.', '');
  if (mulai.getMonth() === selesai.getMonth()) {
    return `${mulai.getDate()}–${selesai.getDate()} ${bulanPendek(selesai)}`;
  }
  return `${mulai.getDate()} ${bulanPendek(mulai)} – ${selesai.getDate()} ${bulanPendek(selesai)}`;
}

/** Rata-rata nilai akhir, membuang baris tanpa nilai (draft kosong). */
export function rataRata(daftar: { nilaiAkhir: number | null }[]): number | null {
  const isi = daftar.filter((p) => p.nilaiAkhir != null).map((p) => p.nilaiAkhir!);
  if (isi.length === 0) return null;
  return isi.reduce((a, b) => a + b, 0) / isi.length;
}

/**
 * Susun deret tren dari penilaian yang sudah dikelompokkan per periode.
 * `periodeUrut` menentukan urutan sumbu (terlama → terbaru).
 */
export function susunTitik(
  periodeUrut: { id: string; nama: string; tanggalMulai: Date; tanggalSelesai: Date }[],
  petaNilai: Map<string, { nilaiAkhir: number | null }[]>
): TitikTren[] {
  return periodeUrut.map((p) => {
    const daftar = petaNilai.get(p.id) ?? [];
    const nilai = rataRata(daftar);
    return {
      label: labelPeriode(p.tanggalMulai, p.tanggalSelesai),
      nama: p.nama,
      nilai: nilai === null ? null : Math.round(nilai * 100) / 100,
      jumlah: daftar.length,
    };
  });
}

/** Selisih antara titik berdata terakhir dan titik berdata sebelumnya. */
export function selisihTerakhir(titik: TitikTren[]): number | null {
  const berisi = titik.filter((t) => t.nilai !== null);
  if (berisi.length < 2) return null;
  const akhir = berisi[berisi.length - 1].nilai!;
  const sebelumnya = berisi[berisi.length - 2].nilai!;
  return Math.round((akhir - sebelumnya) * 100) / 100;
}

/** Ambang perubahan yang dianggap berarti saat menandai naik/turun di grafik. */
export const AMBANG_TREN = 0.05;

export function arahTren(selisih: number | null): 'naik' | 'turun' | 'datar' | null {
  if (selisih === null) return null;
  if (selisih > AMBANG_TREN) return 'naik';
  if (selisih < -AMBANG_TREN) return 'turun';
  return 'datar';
}
