import { prisma } from '@/lib/db';

export type FilterRekapIMT = { tahun: number; kodeCabang?: string | null; kodeJabatan?: string | null };
export type BarisRekapIMT = { nip: string; nama: string; jabatan: string; berat: number | null; imt: number | null; kategori: string | null };
export type SlideRekapIMT = { periode: string; mulai: Date; selesai: Date; unit: string; baris: BarisRekapIMT[] };

export async function tahunRekapIMT() {
  const periode = await prisma.periode.findMany({ orderBy: { tanggalMulai: 'desc' }, select: { tanggalMulai: true } });
  return [...new Set(periode.map((p) => p.tanggalMulai.getFullYear()))];
}

export async function susunRekapIMT(filter: FilterRekapIMT): Promise<SlideRekapIMT[]> {
  const mulaiTahun = new Date(Date.UTC(filter.tahun, 0, 1));
  const selesaiTahun = new Date(Date.UTC(filter.tahun, 11, 31, 23, 59, 59));
  const periode = await prisma.periode.findMany({
    where: { tanggalMulai: { gte: mulaiTahun, lte: selesaiTahun } },
    orderBy: { tanggalMulai: 'asc' },
    include: {
      pengukuranIMT: {
        where: {
          pegawai: {
            role: 'PEGAWAI',
            ...(filter.kodeCabang ? { cabang: { kode: filter.kodeCabang } } : {}),
            ...(filter.kodeJabatan ? { jabatan: { kode: filter.kodeJabatan } } : {}),
          },
        },
        orderBy: { tanggal: 'desc' },
        include: { pegawai: { select: { nip: true, nama: true, jabatan: { select: { nama: true } }, cabang: { select: { nama: true } } } } },
      },
    },
  });
  return periode.map((p) => {
    const terakhir = new Map<string, (typeof p.pengukuranIMT)[number]>();
    for (const x of p.pengukuranIMT) if (!terakhir.has(x.pegawaiId)) terakhir.set(x.pegawaiId, x);
    const baris = [...terakhir.values()].sort((a, b) => a.pegawai.nama.localeCompare(b.pegawai.nama)).map((x) => ({
      nip: x.pegawai.nip, nama: x.pegawai.nama, jabatan: x.pegawai.jabatan?.nama ?? '—', berat: x.beratBadan, imt: x.nilaiIMT, kategori: x.kategori,
    }));
    const unit = filter.kodeCabang ? baris.length ? (p.pengukuranIMT[0]?.pegawai.cabang.nama ?? filter.kodeCabang) : filter.kodeCabang : 'Semua unit';
    return { periode: p.nama, mulai: p.tanggalMulai, selesai: p.tanggalSelesai, unit, baris };
  });
}
