/**
 * Data ranking GABUNGAN (satu peringkat) untuk tampilan 1 halaman.
 *
 * Beda dengan susunRanking() di ranking.ts yang mengelompokkan per unit+posisi
 * (satu slide per kelompok), fungsi di sini menggabungkan SEMUA petugas yang
 * cocok filter menjadi satu daftar berurutan dari nilai tertinggi.
 *
 * Diperlukan karena permintaan pemilik aplikasi: tampilan ranking yang bisa
 * dimuat dalam SATU halaman. Versi berkelompok menghasilkan satu slide per
 * unit+posisi, sehingga jumlah halaman ikut jumlah kelompok — tidak bisa
 * dipastikan satu halaman.
 *
 * Foto diambil dari foto penilaian (kondisi petugas pada periode itu), lalu
 * cadangan ke foto pegawai.
 */

import { prisma } from '@/lib/db';
import { kumpulkanTurunan } from './hierarki';
import { labelPosisi } from './label-posisi';
import { kategoriDariNilai } from './ranking';
import { rapikanHasil } from '@/lib/rapikan-data';
import { batasiCakupanCabangRanking } from './ranking-cakupan';
import type { JenisCabang } from '@prisma/client';

export type FilterRankingGabungan = {
  periodeId: string;
  jenis?: JenisCabang | null;
  kodeCabang?: string | null;
  kodeJabatan?: string | null;
  semuaPegawai?: boolean;
  /** Authorized branch scope derived server-side from the authenticated user. */
  cabangDiizinkanIds?: string[];
};

export type BarisRankingGabungan = {
  peringkat: number;
  nama: string;
  nip: string;
  jabatan: string;
  unit: string;
  nilai: number | null;
  kategori: string;
  /** Data URL JPEG foto petugas (foto penilaian, cadangan foto pegawai). */
  foto: string | null;
};

export type DataRankingGabungan = {
  unit: string;
  posisi: string;
  periode: string;
  jenisKantor: string;
  jumlahPeserta: number;
  baris: BarisRankingGabungan[];
};

/** Susun satu peringkat gabungan, urut dari nilai tertinggi. */
export async function susunRankingGabungan(
  filter: FilterRankingGabungan
): Promise<DataRankingGabungan> {
  const periode = await prisma.periode.findUnique({ where: { id: filter.periodeId } });
  if (!periode) throw new Error('Periode tidak ditemukan.');

  // ---- tentukan cabang yang ikut (mengikuti hierarki) ----
  let cabangIds: string[] | undefined;
  let unitLabel = 'Semua unit';

  if (filter.kodeCabang) {
    const cabang = await prisma.cabang.findUnique({ where: { kode: filter.kodeCabang } });
    if (cabang) {
      const semua = await prisma.cabang.findMany({
        select: { id: true, kode: true, nama: true, indukId: true, jenis: true },
      });
      const turunan = kumpulkanTurunan(cabang.id, semua);
      cabangIds = [cabang.id, ...turunan];
      unitLabel = cabang.nama;
    } else cabangIds = [];
  } else if (filter.jenis) {
    const daftar = await prisma.cabang.findMany({
      where: { jenis: filter.jenis },
      select: { id: true },
    });
    cabangIds = daftar.map((c) => c.id);
    const label: Record<string, string> = {
      KANWIL: 'Semua Kanwil', KC: 'Semua KC', KCP: 'Semua KCP',
    };
    unitLabel = label[filter.jenis] ?? `Jenis ${filter.jenis}`;
  }

  cabangIds = batasiCakupanCabangRanking(cabangIds, filter.cabangDiizinkanIds);

  // Ambil semua Pegawai agar yang belum punya baris Penilaian tetap muncul.
  if (filter.semuaPegawai) {
    const pegawai = await prisma.pegawai.findMany({
      where: {
        role: 'PEGAWAI', aktif: true,
        ...(cabangIds ? { cabangId: { in: cabangIds } } : {}),
        ...(filter.kodeJabatan ? { jabatan: { kode: filter.kodeJabatan } } : {}),
      },
      orderBy: { nama: 'asc' },
      select: {
        nama: true, nip: true, fotoData: true,
        jabatan: { select: { kode: true, nama: true } }, cabang: { select: { nama: true } },
        penilaianku: { where: { periodeId: filter.periodeId }, select: { nilaiAkhir: true, fotoData: true }, take: 1 },
      },
    });
    const baris = pegawai.map((p) => {
      const nilai = p.penilaianku[0]?.nilaiAkhir == null ? null : Number(p.penilaianku[0].nilaiAkhir);
      return { peringkat: 0, nama: p.nama, nip: p.nip, jabatan: labelPosisi(p.jabatan?.kode ?? null, p.jabatan?.nama ?? 'Tanpa jabatan'), unit: p.cabang.nama, nilai, kategori: nilai == null ? 'Belum dinilai' : kategoriDariNilai(nilai), foto: p.penilaianku[0]?.fotoData ?? p.fotoData ?? null };
    }).sort((a, b) => ((b.nilai ?? -1) - (a.nilai ?? -1)) || a.nip.localeCompare(b.nip)).map((b, i) => ({ ...b, peringkat: i + 1 }));
    return { unit: unitLabel, posisi: filter.kodeJabatan ? (baris[0]?.jabatan ?? filter.kodeJabatan) : 'Semua posisi', periode: periode.nama, jenisKantor: filter.jenis ? `Jenis ${filter.jenis}` : 'Semua jenis', jumlahPeserta: baris.length, baris };
  }

  const penilaian = await prisma.penilaian.findMany({
    where: {
      periodeId: filter.periodeId,
      ...(filter.semuaPegawai ? {} : { nilaiAkhir: { not: null } }),
      pegawai: {
        ...(cabangIds ? { cabangId: { in: cabangIds } } : {}),
        ...(filter.kodeJabatan ? { jabatan: { kode: filter.kodeJabatan } } : {}),
      },
    },
    select: {
      nilaiAkhir: true,
      fotoData: true,
      fotoMime: true,
      pegawai: {
        select: {
          nama: true,
          nip: true,
          fotoData: true,
          fotoMime: true,
          jabatan: { select: { kode: true, nama: true } },
          cabang: { select: { kode: true, nama: true } },
        },
      },
    },
  });

  const baris: BarisRankingGabungan[] = penilaian
    .map((p) => {
      const nilai = p.nilaiAkhir == null ? null : Number(p.nilaiAkhir);
      // foto penilaian lebih relevan (kondisi petugas periode itu);
      // foto pegawai jadi cadangan
      //
      // PENTING: kolom fotoData di database menyimpan DATA URL LENGKAP
      // ("data:image/jpeg;base64,..."), bukan base64 telanjang. Jadi di sini
      // TIDAK boleh menambahkan awalan lagi — pernah ditambahkan dan hasilnya
      // awalan dobel, sehingga SEMUA foto gagal tampil. Dibiarkan apa adanya.
      const foto = p.fotoData ?? p.pegawai.fotoData ?? null;
      return {
        peringkat: 0, // diisi setelah pengurutan
        nama: p.pegawai.nama,
        nip: p.pegawai.nip,
        jabatan: labelPosisi(
          p.pegawai.jabatan?.kode ?? null,
          p.pegawai.jabatan?.nama ?? 'Tanpa jabatan'
        ),
        unit: p.pegawai.cabang.nama,
        nilai,
        kategori: nilai == null ? 'Belum dinilai' : kategoriDariNilai(nilai),
        foto,
      };
    })
    // nilai tertinggi di atas; NIP sebagai pemutus supaya urutannya stabil
    .sort((a, b) => ((b.nilai ?? -1) - (a.nilai ?? -1)) || a.nip.localeCompare(b.nip))
    .map((b, i) => ({ ...b, peringkat: i + 1 }));

  return {
    unit: unitLabel,
    posisi: filter.kodeJabatan ? (baris[0]?.jabatan ?? filter.kodeJabatan) : 'Semua posisi',
    periode: periode.nama,
    jenisKantor: filter.jenis ? `Jenis ${filter.jenis}` : 'Semua jenis',
    jumlahPeserta: baris.length,
    baris,
  };
}
