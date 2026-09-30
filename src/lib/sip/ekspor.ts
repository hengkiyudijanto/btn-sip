/**
 * Penyusun berkas CSV untuk ekspor rekap penilaian.
 *
 * Dipisah dari halaman supaya bisa diuji tanpa peramban. Memakai pemisah
 * titik-koma (;) dan awalan BOM, karena Excel di Indonesia dengan setelan
 * regional Indonesia memakai koma sebagai pemisah desimal — kalau memakai
 * koma sebagai pemisah kolom, angkanya jadi rusak saat dibuka.
 */

export type BarisRekap = {
  rank: number;
  nama: string;
  nip: string;
  jabatan: string;
  cabang: string;
  penampilan: number | null;
  kemampuan: number | null;
  sikap: number | null;
  nilaiAkhir: number | null;
  rating: string;
  status: string;
};

/** Bungkus nilai dalam tanda kutip bila mengandung karakter pemisah */
function sel(nilai: string | number | null | undefined): string {
  if (nilai === null || nilai === undefined) return '';
  const s = String(nilai);
  if (s.includes(';') || s.includes('"') || s.includes('\n') || s.includes('\r')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

/** Angka desimal dengan koma (format Indonesia), dua angka di belakang koma */
function angkaID(nilai: number | null | undefined): string {
  if (nilai === null || nilai === undefined || !Number.isFinite(nilai)) return '';
  return nilai.toFixed(2).replace('.', ',');
}

export type InfoRekap = {
  periode: string;
  cakupan: string;
  jumlahDinilai: number;
  rataRata: number;
  tertinggi: { nama: string; nilai: number } | null;
  terendah: { nama: string; nilai: number } | null;
  sebaran: Record<string, number>;
};

/**
 * Susun berkas CSV berisi dua bagian:
 *   1. ringkasan (periode, cakupan, rata-rata, tertinggi/terendah, sebaran)
 *   2. tabel peringkat petugas
 */
export function susunCsvRekap(info: InfoRekap, baris: BarisRekap[]): string {
  const L: string[] = [];

  // ===== bagian 1: ringkasan =====
  L.push('REKAP PENILAIAN PETUGAS FRONTLINER');
  L.push('Bank BTN - Sistem Informasi Penilaian (SIP)');
  L.push('');
  L.push(`Periode;${sel(info.periode)}`);
  L.push(`Cakupan;${sel(info.cakupan)}`);
  L.push(`Jumlah petugas dinilai;${info.jumlahDinilai}`);
  L.push(`Rata-rata nilai;${angkaID(info.rataRata)}`);
  L.push(
    `Nilai tertinggi;${angkaID(info.tertinggi?.nilai)};${sel(info.tertinggi?.nama ?? '')}`
  );
  L.push(
    `Nilai terendah;${angkaID(info.terendah?.nilai)};${sel(info.terendah?.nama ?? '')}`
  );
  L.push('');
  L.push('Sebaran kategori');
  L.push('Kategori;Jumlah');
  for (const [kategori, jumlah] of Object.entries(info.sebaran)) {
    L.push(`${sel(kategori)};${jumlah}`);
  }
  L.push('');

  // ===== bagian 2: tabel peringkat =====
  L.push('DAFTAR PERINGKAT');
  L.push(
    [
      'Rank',
      'Nama',
      'NIP',
      'Jabatan',
      'Cabang',
      'Penampilan',
      'Kemampuan',
      'Sikap',
      'Nilai Akhir',
      'Rating',
      'Status',
    ].join(';')
  );

  for (const b of baris) {
    L.push(
      [
        b.rank,
        sel(b.nama),
        sel(b.nip),
        sel(b.jabatan),
        sel(b.cabang),
        angkaID(b.penampilan),
        angkaID(b.kemampuan),
        angkaID(b.sikap),
        angkaID(b.nilaiAkhir),
        sel(b.rating),
        sel(b.status),
      ].join(';')
    );
  }

  // BOM supaya Excel membaca UTF-8 dengan benar (huruf beraksen tidak rusak)
  return '\ufeff' + L.join('\r\n') + '\r\n';
}

/** Nama berkas ekspor, mis. "rekap-sip-2026-10-W1-2026-09-30.csv" */
export function namaBerkasRekap(kodePeriode: string, tanggal: Date = new Date()): string {
  const t = [
    tanggal.getFullYear(),
    String(tanggal.getMonth() + 1).padStart(2, '0'),
    String(tanggal.getDate()).padStart(2, '0'),
  ].join('-');
  const kode = kodePeriode.replace(/[^a-zA-Z0-9-]/g, '-');
  return `rekap-sip-${kode}-${t}.csv`;
}
