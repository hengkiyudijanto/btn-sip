/**
 * Data ranking untuk laporan PPTX — logika bersama dipakai halaman & ekspor.
 *
 * Mengumpulkan penilaian pada satu periode menurut filter (jenis kantor,
 * unit/cabang, posisi), lalu mengelompokkannya menjadi slide-slide ranking:
 * satu slide per kombinasi unit + posisi.
 *
 * Foto diambil dari foto penilaian (kondisi petugas pada periode itu), lalu
 * cadangan ke foto pegawai. Yang dikirim ke pembuat PPTX hanya isi base64
 * tanpa awalan data URL.
 */

import { prisma } from '@/lib/db';
import { kumpulkanTurunan } from './hierarki';
import { labelPosisi } from './label-posisi';
import type { JenisCabang } from '@prisma/client';

export type FilterRanking = {
  periodeId: string;
  jenis?: JenisCabang | null;
  kodeCabang?: string | null;
  kodeJabatan?: string | null;
};

export type BarisRanking = {
  nama: string;
  nip: string;
  nilai: number;
  kategori: string;
};

export type KelompokRanking = {
  unit: string;
  posisi: string;
  baris: BarisRanking[];
};

export type DataRanking = {
  unit: string;
  posisi: string;
  periode: string;
  jenisKantor: string;
  jumlahPeserta: number;
  kelompok: KelompokRanking[];
};

/** Kategori dari nilai akhir 0-5 — ambang rubrik BTN, satu sumber kebenaran. */
export function kategoriDariNilai(nilai: number): string {
  if (nilai >= 4.8) return 'Istimewa';
  if (nilai >= 4.6) return 'Sangat Baik';
  if (nilai >= 4.0) return 'Baik';
  if (nilai >= 3.6) return 'Cukup';
  return 'Kurang';
}

/** Daftar periode yang punya penilaian — untuk pemilih di halaman. */
export async function periodeUntukRanking() {
  return prisma.periode.findMany({
    where: { penilaian: { some: { nilaiAkhir: { not: null } } } },
    orderBy: { tanggalMulai: 'desc' },
    select: { id: true, nama: true, tanggalMulai: true, tanggalSelesai: true },
  });
}

/** Daftar jabatan yang punya penilaian — untuk pemilih posisi. */
export async function jabatanUntukRanking() {
  return prisma.jabatan.findMany({
    where: { pegawai: { some: { penilaianku: { some: { nilaiAkhir: { not: null } } } } } },
    orderBy: { nama: 'asc' },
    select: { kode: true, nama: true },
  });
}

/** Daftar cabang yang punya penilaian — untuk pemilih unit. */
export async function cabangUntukRanking() {
  return prisma.cabang.findMany({
    where: { pegawai: { some: { penilaianku: { some: { nilaiAkhir: { not: null } } } } } },
    orderBy: { kode: 'asc' },
    select: { kode: true, nama: true, jenis: true },
  });
}

/**
 * Susun data ranking dari database. Foto tidak diikutkan di sini supaya
 * pemanggil bisa memilih mau membawa fotonya atau tidak (halaman web hanya
 * butuh nama dan nilai; ekspor PPTX butuh fotonya).
 */
export async function susunRanking(filter: FilterRanking): Promise<DataRanking> {
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
      // laporan mencakup turunan: Kanwil mencakup KC, KC mencakup KCP
      const turunan = kumpulkanTurunan(cabang.id, semua);
      cabangIds = [cabang.id, ...turunan];
      unitLabel = `${cabang.kode} ${cabang.nama}`;
    }
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

  const penilaian = await prisma.penilaian.findMany({
    where: {
      periodeId: filter.periodeId,
      nilaiAkhir: { not: null },
      pegawai: {
        ...(cabangIds ? { cabangId: { in: cabangIds } } : {}),
        ...(filter.kodeJabatan ? { jabatan: { kode: filter.kodeJabatan } } : {}),
      },
    },
    select: {
      nilaiAkhir: true,
      pegawai: {
        select: {
          nama: true, nip: true,
          jabatan: { select: { kode: true, nama: true } },
          cabang: { select: { kode: true, nama: true } },
        },
      },
    },
  });

  // ---- kelompokkan per unit + jabatan (satu slide per kelompok) ----
  const peta = new Map<string, KelompokRanking>();

  for (const p of penilaian) {
    if (p.nilaiAkhir === null) continue;
    // Label posisi untuk slide (mis. "Teller" -> "Teller Service").
    // Lihat src/lib/sip/label-posisi.ts — nama jabatan di database tidak diubah.
    const posisi = labelPosisi(
      p.pegawai.jabatan?.kode ?? null,
      p.pegawai.jabatan?.nama ?? 'Tanpa jabatan'
    );
    const kunci = `${p.pegawai.cabang.kode}|${posisi}`;
    if (!peta.has(kunci)) {
      peta.set(kunci, {
        unit: `${p.pegawai.cabang.kode} ${p.pegawai.cabang.nama}`,
        posisi,
        baris: [],
      });
    }
    const nilai = Number(p.nilaiAkhir);
    peta.get(kunci)!.baris.push({
      nama: p.pegawai.nama,
      nip: p.pegawai.nip,
      nilai,
      kategori: kategoriDariNilai(nilai),
    });
  }

  const kelompok = [...peta.values()]
    .map((k) => ({ ...k, baris: k.baris.sort((a, b) => b.nilai - a.nilai) }))
    .sort((a, b) =>
      a.unit === b.unit ? a.posisi.localeCompare(b.posisi) : a.unit.localeCompare(b.unit)
    );

  return {
    unit: unitLabel,
    posisi: filter.kodeJabatan
      ? (kelompok[0]?.posisi ?? filter.kodeJabatan)
      : 'Semua posisi',
    periode: periode.nama,
    jenisKantor: filter.jenis ? `Jenis ${filter.jenis}` : 'Semua jenis',
    jumlahPeserta: penilaian.filter((p) => p.nilaiAkhir !== null).length,
    kelompok,
  };
}
