import { NextRequest, NextResponse } from 'next/server';
import { pegawaiDariSesi, catatAudit } from '@/lib/auth';
import { bolehBukaHalaman } from '@/lib/sip/akses';
import { susunRekapIMT } from '@/lib/sip/imt-rekap';
import { bangunPptxRekapIMT } from '@/lib/sip/imt-rekap-pptx';
import { kumpulkanTurunan } from '@/lib/sip/hierarki';
import { prisma } from '@/lib/db';

export async function GET(req: NextRequest) {
  const saya = await pegawaiDariSesi();
  if (!saya) return new NextResponse('Belum masuk', { status: 401 });
  if (!bolehBukaHalaman(saya.role, '/laporan/ranking')) return new NextResponse('Tidak berwenang', { status: 403 });
  const sp = req.nextUrl.searchParams;
  const periodeId = sp.get('periode');
  if (!periodeId) return new NextResponse('Periode wajib dipilih', { status: 400 });
  const cabangId = sp.get('cabang');
  const semuaPegawai = sp.get('semua') === '1';
  const tanggalRaw = sp.get('tanggal');
  const tanggal = tanggalRaw && /^\d{4}-\d{2}-\d{2}$/.test(tanggalRaw) ? new Date(`${tanggalRaw}T00:00:00.000Z`) : undefined;
  const semuaCabang = await prisma.cabang.findMany({ select: { id: true, indukId: true } });
  const cabangIds = cabangId ? kumpulkanTurunan(cabangId, semuaCabang) : bolehBukaHalaman(saya.role, '/laporan/ranking') ? null : [saya.cabang.id];
  const data = await susunRekapIMT({ periodeId, cabangIds, semuaPegawai, tanggal });
  if (!data.some((x) => x.baris.length)) return new NextResponse('Belum ada data IMT pada tahun tersebut.', { status: 404 });
  const buffer = await bangunPptxRekapIMT(data);
  await catatAudit({ pegawaiId: saya.id, aksi: 'UNDUH_REKAP_IMT_PPTX', entitas: 'PengukuranIMT', dataBaru: { periodeId, cabangId, slide: data.length } });
  return new NextResponse(new Uint8Array(buffer), { status: 200, headers: { 'Content-Type': 'application/vnd.openxmlformats-officedocument.presentationml.presentation', 'Content-Disposition': `attachment; filename="rekap-imt-${periodeId}.pptx"`, 'Content-Length': String(buffer.length), 'Cache-Control': 'no-store' } });
}
