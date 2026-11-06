import { NextRequest, NextResponse } from 'next/server';
import { pegawaiDariSesi, catatAudit } from '@/lib/auth';
import { bolehBukaHalaman } from '@/lib/sip/akses';
import { susunRekapIMT } from '@/lib/sip/imt-rekap';
import { bangunPptxRekapIMT } from '@/lib/sip/imt-rekap-pptx';

export async function GET(req: NextRequest) {
  const saya = await pegawaiDariSesi();
  if (!saya) return new NextResponse('Belum masuk', { status: 401 });
  if (!bolehBukaHalaman(saya.role, '/laporan/ranking')) return new NextResponse('Tidak berwenang', { status: 403 });
  const sp = req.nextUrl.searchParams;
  const tahun = Number(sp.get('tahun')) || new Date().getFullYear();
  const data = await susunRekapIMT({ tahun, kodeCabang: sp.get('cabang'), kodeJabatan: sp.get('posisi') });
  if (!data.some((x) => x.baris.length)) return new NextResponse('Belum ada data IMT pada tahun tersebut.', { status: 404 });
  const buffer = await bangunPptxRekapIMT(data);
  await catatAudit({ pegawaiId: saya.id, aksi: 'UNDUH_REKAP_IMT_PPTX', entitas: 'PengukuranIMT', dataBaru: { tahun, slide: data.length } });
  return new NextResponse(new Uint8Array(buffer), { status: 200, headers: { 'Content-Type': 'application/vnd.openxmlformats-officedocument.presentationml.presentation', 'Content-Disposition': `attachment; filename="rekap-imt-${tahun}.pptx"`, 'Content-Length': String(buffer.length), 'Cache-Control': 'no-store' } });
}
