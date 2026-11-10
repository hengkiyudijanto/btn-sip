import { prisma } from '@/lib/db';
import { kumpulkanTurunan, type CabangRingkas } from './hierarki';

export type FilterRekapIMT = { periodeId: string; cabangIds?: string[] | null; semuaPegawai?: boolean };
export type BarisRekapIMT = { nip: string; nama: string; jabatan: string; foto: string | null; beratAwal: number | null; berat: number | null; perubahan: number | null; imt: number | null; kategori: string | null };
export type SlideRekapIMT = { periode: string; mulai: Date; selesai: Date; unit: string; baris: BarisRekapIMT[] };

export async function susunRekapIMT(filter: FilterRekapIMT): Promise<SlideRekapIMT[]> {
  const periode = await prisma.periode.findUnique({
    where: { id: filter.periodeId },
    include: {
      pengukuranIMT: {
        where: {
          pegawai: {
            role: 'PEGAWAI',
            ...(filter.cabangIds ? { cabangId: { in: filter.cabangIds } } : {}),
          },
        },
        orderBy: { tanggal: 'desc' },
        include: { pegawai: { select: { nip: true, nama: true, fotoData: true, fotoUrl: true, beratBadan: true, jabatan: { select: { nama: true } }, cabang: { select: { nama: true } } } } },
      },
    },
  });
  if (!periode) return [];
  if (filter.semuaPegawai) {
    const pegawai = await prisma.pegawai.findMany({
      where: { role: 'PEGAWAI', ...(filter.cabangIds ? { cabangId: { in: filter.cabangIds } } : {}) },
      orderBy: { nama: 'asc' },
      select: { nip: true, nama: true, beratBadan: true, fotoData: true, fotoUrl: true, jabatan: { select: { nama: true } }, cabang: { select: { nama: true } }, pengukuranIMT: { where: { periodeId: filter.periodeId }, orderBy: { tanggal: 'desc' }, take: 1 } },
    });
    return [{ periode: periode.nama, mulai: periode.tanggalMulai, selesai: periode.tanggalSelesai, unit: filter.cabangIds ? (pegawai[0]?.cabang.nama ?? 'Unit terpilih') : 'Semua unit', baris: pegawai.map((p) => { const berat = p.pengukuranIMT[0]?.beratBadan ?? null; return { nip: p.nip, nama: p.nama, jabatan: p.jabatan?.nama ?? '—', foto: p.fotoData ?? p.fotoUrl ?? null, beratAwal: p.beratBadan, berat, perubahan: berat != null && p.beratBadan != null ? berat - p.beratBadan : null, imt: p.pengukuranIMT[0]?.nilaiIMT ?? null, kategori: p.pengukuranIMT[0]?.kategori ?? null }; }) }];
  }
  const terakhir = new Map<string, (typeof periode.pengukuranIMT)[number]>();
  for (const x of periode.pengukuranIMT) if (!terakhir.has(x.pegawaiId)) terakhir.set(x.pegawaiId, x);
  const baris = [...terakhir.values()].sort((a, b) => a.pegawai.nama.localeCompare(b.pegawai.nama)).map((x) => ({
    nip: x.pegawai.nip, nama: x.pegawai.nama, jabatan: x.pegawai.jabatan?.nama ?? '—', foto: x.pegawai.fotoData ?? x.pegawai.fotoUrl ?? null, beratAwal: x.pegawai.beratBadan, berat: x.beratBadan, perubahan: x.pegawai.beratBadan != null ? x.beratBadan - x.pegawai.beratBadan : null, imt: x.nilaiIMT, kategori: x.kategori,
  }));
  const unit = filter.cabangIds ? (periode.pengukuranIMT[0]?.pegawai.cabang.nama ?? 'Unit terpilih') : 'Semua unit';
  return [{ periode: periode.nama, mulai: periode.tanggalMulai, selesai: periode.tanggalSelesai, unit, baris }];
}
