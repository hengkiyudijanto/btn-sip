/**
 * Data & perhitungan laporan SIP.
 * Menyusun struktur laporan persis seperti dokumen resmi "SIP REPORT":
 *   IDENTITAS KARYAWAN → A/B/C → TOTAL PENILAIAN → KATEGORI → LEMBAR KOMITMEN
 */

import { KATEGORI, PERFORMANCE_RATING, type PerformanceBand } from './penilaian';
import { rubrikAspek } from './rubrik';

export const LABEL_KATEGORI_TAMPIL: Record<string, string> = {
  A: 'PENAMPILAN',
  B: 'KEMAMPUAN',
  C: 'SIKAP',
};

export const LABEL_KATEGORI_EN: Record<string, string> = {
  A: 'APPEARANCE',
  B: 'SKILL',
  C: 'ATTITUDE',
};

/** Ubah angka jadi format Indonesia: 4,75 (koma sebagai desimal). */
export function angkaID(n: number | null | undefined, desimal = 2): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return '-';
  return n.toFixed(desimal).replace('.', ',');
}

/** Label rating dwibahasa, mis. "Istimewa / Outstanding". */
export function labelRatingDwibahasa(rating: string): string {
  const band = PERFORMANCE_RATING.find((b) => b.label === rating);
  return band ? `${band.label} / ${band.labelEn}` : rating;
}

export type BarisDetail = {
  nomor: number;
  aspek: string;
  aspekEn: string;
  /**
   * Angka mentah yang dipakai penilai:
   * - aspek biasa: skor 1-5 (sama dengan `skor`)
   * - aspek berbasis nilai (Quiz): nilai 0-100 sebelum dikonversi
   */
  angka: string;
  /** Skor hasil konversi ke skala 1-5 — inilah yang dipakai menghitung. */
  skor: number;
  bobot: string;
  nilai: number;
  catatan: string;
  /** kriteria rubrik untuk skor yang dipilih — dipindah ke kolom Catatan */
  kriteria?: string;
};

export type BlokKategori = {
  kode: 'A' | 'B' | 'C';
  judul: string;
  judulEn: string;
  bobotKategori: string;
  baris: BarisDetail[];
  total: number;
};

export type DataLaporan = {
  // identitas
  nama: string;
  nip: string;
  jabatan: string;
  jabatanEn: string;
  cabang: string;
  kodeCabang: string;
  periode: string;
  fotoUrl: string | null;

  // penilaian
  blok: BlokKategori[];
  nilaiPenampilan: number;
  nilaiKemampuan: number;
  nilaiSikap: number;
  nilaiAkhir: number;
  rating: string;
  ratingDwibahasa: string;
  band: PerformanceBand | null;
  catatanUmum: string | null;

  // tanda tangan
  penilai: string;
  penilaiJabatan: string;

  // metadata
  tanggalCetak: string;
  status: string;
};

/** Susun baris detail per kategori dari data penilaian yang tersimpan. */
export function susunBlok(
  detail: { kodeAspek: string; nilaiMentah: number; skor: number; catatan: string | null }[]
): BlokKategori[] {
  const peta = new Map(detail.map((d) => [d.kodeAspek, d]));

  return KATEGORI.map((kat) => {
    let total = 0;

    const baris: BarisDetail[] = kat.aspek.map((asp, i) => {
      const d = peta.get(asp.kode);
      const skor = d?.skor ?? 0;
      const mentah = d?.nilaiMentah ?? 0;
      const nilai = skor * asp.bobot;
      total += nilai;

      // Kolom Angka = angka 0-100 yang diinput atasan (apa adanya, untuk audit).
      // Kolom Skor = hasil konversi angka tersebut ke skala 1-5.
      const angka = d ? String(mentah) : '-';

      return {
        nomor: i + 1,
        aspek: asp.nama,
        aspekEn: asp.nama,
        angka,
        skor,
        bobot: `${Math.round(asp.bobot * 100)}%`,
        nilai: Math.round(nilai * 100) / 100,
        catatan: d?.catatan ?? '',
        kriteria: rubrikAspek(asp.kode).find((l) => l.skor === skor)?.kriteria,
      };
    });

    return {
      kode: kat.kode,
      judul: LABEL_KATEGORI_TAMPIL[kat.kode],
      judulEn: LABEL_KATEGORI_EN[kat.kode],
      bobotKategori: `${Math.round(kat.bobot * 100)}%`,
      baris,
      total: Math.round(total * 100) / 100,
    };
  });
}

/** Nama bulan Indonesia untuk header laporan. */
export function tanggalID(d: Date): string {
  return d.toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

/** Rentang periode dalam format ringkas, mis. "29 Sep – 05 Okt 2026". */
export function rentangPeriode(mulai: Date, selesai: Date): string {
  const opt: Intl.DateTimeFormatOptions = { day: '2-digit', month: 'short' };
  const optTahun: Intl.DateTimeFormatOptions = {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  };
  return `${mulai.toLocaleDateString('id-ID', opt)} – ${selesai.toLocaleDateString('id-ID', optTahun)}`;
}
