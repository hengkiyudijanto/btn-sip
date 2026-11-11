import { prisma } from '@/lib/db';
import { kumpulkanTurunan, type CabangRingkas } from './hierarki';

export type FilterRekapIMT = { periodeId: string; cabangIds?: string[] | null; semuaPegawai?: boolean; tanggal?: Date };
export type BarisRekapIMT = { nip: string; nama: string; kantor: string; unitKerja: string; foto: string | null; beratAwal: number | null; berat: number | null; perubahan: number | null; imt: number | null; kategori: string | null };
export type SlideRekapIMT = { periode: string; mulai: Date; selesai: Date; tanggal: Date; unit: string; baris: BarisRekapIMT[] };
export type GrupRekapIMT = { kantor: string; unitKerja: string; baris: BarisRekapIMT[] };

export function kelompokkanBarisRekapIMT(baris: BarisRekapIMT[]): GrupRekapIMT[] {
  const kantor = new Map<string, Map<string, BarisRekapIMT[]>>();
  for (const b of baris) {
    const unit = kantor.get(b.kantor) ?? (kantor.set(b.kantor, new Map()), kantor.get(b.kantor)!);
    (unit.get(b.unitKerja) ?? (unit.set(b.unitKerja, []), unit.get(b.unitKerja)!)).push(b);
  }
  return [...kantor.entries()].flatMap(([namaKantor, unit]) => [...unit.entries()].map(([unitKerja, data]) => ({ kantor: namaKantor, unitKerja, baris: data })));
}

export async function daftarTanggalPengukuranIMT(periodeId: string, cabangIds?: string[] | null): Promise<Date[]> {
  const daftar = await prisma.pengukuranIMT.findMany({ where: { periodeId, ...(cabangIds ? { pegawai: { cabangId: { in: cabangIds } } } : {}) }, select: { tanggal: true }, distinct: ['tanggal'], orderBy: { tanggal: 'desc' } });
  return daftar.map((x) => x.tanggal);
}

export async function susunRekapIMT(filter: FilterRekapIMT): Promise<SlideRekapIMT[]> {
  const periode = await prisma.periode.findUnique({
    where: { id: filter.periodeId },
    include: {
      pengukuranIMT: {
        where: {
          ...(filter.tanggal ? { tanggal: filter.tanggal } : {}),
          pegawai: {
            role: 'PEGAWAI',
            ...(filter.cabangIds ? { cabangId: { in: filter.cabangIds } } : {}),
          },
        },
        orderBy: { tanggal: 'desc' },
        include: { pegawai: { select: { nip: true, nama: true, fotoData: true, fotoUrl: true, beratBadan: true, jabatan: { select: { nama: true } }, cabang: { select: { nama: true } }, penilaianku: { where: { fotoData: { not: null } }, orderBy: { periode: { tanggalMulai: 'desc' } }, select: { fotoData: true }, take: 1 } } } },
      },
    },
  });
  if (!periode) return [];
  if (filter.semuaPegawai) {
    const pegawai = await prisma.pegawai.findMany({
      where: { role: 'PEGAWAI', ...(filter.cabangIds ? { cabangId: { in: filter.cabangIds } } : {}) },
      orderBy: { nama: 'asc' },
      select: { nip: true, nama: true, beratBadan: true, fotoData: true, fotoUrl: true, jabatan: { select: { nama: true } }, cabang: { select: { nama: true } }, penilaianku: { where: { fotoData: { not: null } }, orderBy: { periode: { tanggalMulai: 'desc' } }, select: { fotoData: true }, take: 1 }, pengukuranIMT: { where: { periodeId: filter.periodeId, ...(filter.tanggal ? { tanggal: filter.tanggal } : {}) }, orderBy: { tanggal: 'desc' }, take: 1 } },
    });
    return [{ periode: periode.nama, mulai: periode.tanggalMulai, selesai: periode.tanggalSelesai, tanggal: filter.tanggal ?? periode.tanggalMulai, unit: filter.cabangIds ? (pegawai[0]?.cabang.nama ?? 'Unit terpilih') : 'Semua unit', baris: pegawai.map((p) => { const berat = p.pengukuranIMT[0]?.beratBadan ?? null; return { nip: p.nip, nama: p.nama, kantor: p.cabang.nama, unitKerja: p.jabatan?.nama ?? '—', foto: p.penilaianku[0]?.fotoData ?? p.fotoData ?? p.fotoUrl ?? null, beratAwal: p.beratBadan, berat, perubahan: berat != null && p.beratBadan != null ? berat - p.beratBadan : null, imt: p.pengukuranIMT[0]?.nilaiIMT ?? null, kategori: p.pengukuranIMT[0]?.kategori ?? null }; }) }];
  }
  const terakhir = new Map<string, (typeof periode.pengukuranIMT)[number]>();
  for (const x of periode.pengukuranIMT) if (!terakhir.has(x.pegawaiId)) terakhir.set(x.pegawaiId, x);
  const baris = [...terakhir.values()].sort((a, b) => a.pegawai.nama.localeCompare(b.pegawai.nama)).map((x) => ({
    nip: x.pegawai.nip, nama: x.pegawai.nama, kantor: x.pegawai.cabang.nama, unitKerja: x.pegawai.jabatan?.nama ?? '—', foto: x.pegawai.penilaianku[0]?.fotoData ?? x.pegawai.fotoData ?? x.pegawai.fotoUrl ?? null, beratAwal: x.pegawai.beratBadan, berat: x.beratBadan, perubahan: x.pegawai.beratBadan != null ? x.beratBadan - x.pegawai.beratBadan : null, imt: x.nilaiIMT, kategori: x.kategori,
  }));
  const unit = filter.cabangIds ? (periode.pengukuranIMT[0]?.pegawai.cabang.nama ?? 'Unit terpilih') : 'Semua unit';
  return [{ periode: periode.nama, mulai: periode.tanggalMulai, selesai: periode.tanggalSelesai, tanggal: filter.tanggal ?? periode.pengukuranIMT[0]?.tanggal ?? periode.tanggalMulai, unit, baris }];
}
