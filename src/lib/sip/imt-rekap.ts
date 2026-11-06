import { prisma } from '@/lib/db';
import { kumpulkanTurunan, type CabangRingkas } from './hierarki';

export type FilterRekapIMT = { periodeId: string; cabangIds?: string[] | null };
export type BarisRekapIMT = { nip: string; nama: string; jabatan: string; berat: number | null; imt: number | null; kategori: string | null };
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
        include: { pegawai: { select: { nip: true, nama: true, jabatan: { select: { nama: true } }, cabang: { select: { nama: true } } } } },
      },
    },
  });
  if (!periode) return [];
  const terakhir = new Map<string, (typeof periode.pengukuranIMT)[number]>();
  for (const x of periode.pengukuranIMT) if (!terakhir.has(x.pegawaiId)) terakhir.set(x.pegawaiId, x);
  const baris = [...terakhir.values()].sort((a, b) => a.pegawai.nama.localeCompare(b.pegawai.nama)).map((x) => ({
    nip: x.pegawai.nip, nama: x.pegawai.nama, jabatan: x.pegawai.jabatan?.nama ?? '—', berat: x.beratBadan, imt: x.nilaiIMT, kategori: x.kategori,
  }));
  const unit = filter.cabangIds ? (periode.pengukuranIMT[0]?.pegawai.cabang.nama ?? 'Unit terpilih') : 'Semua unit';
  return [{ periode: periode.nama, mulai: periode.tanggalMulai, selesai: periode.tanggalSelesai, unit, baris }];
}
