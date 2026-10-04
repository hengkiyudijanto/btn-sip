import { NextResponse } from 'next/server';
import { pegawaiDariSesi } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { kumpulkanTurunan, LABEL_JENIS, type CabangRingkas } from '@/lib/sip/hierarki';
import { pilihPeriodeRelevan } from '@/lib/sip/periode-aktif';
import { susunCsvRekap, namaBerkasRekap, type BarisRekap } from '@/lib/sip/ekspor';
import { bolehBukaHalaman } from '@/lib/sip/akses';

export const dynamic = 'force-dynamic';

const LABEL_STATUS: Record<string, string> = {
  DRAFT: 'Draft',
  DIKIRIM: 'Menunggu diketahui',
  DIKETAHUI: 'Sudah diketahui',
  FINAL: 'Final',
};

/**
 * Unduh rekap penilaian sebagai berkas CSV yang bisa dibuka di Excel.
 *
 * Cakupan dan periode mengikuti filter di halaman Laporan, jadi yang
 * terunduh persis sama dengan yang terlihat di layar.
 */
export async function GET(request: Request) {
  const saya = await pegawaiDariSesi();
  if (!saya) {
    return NextResponse.json({ error: 'Belum masuk.' }, { status: 401 });
  }
  if (saya.harusGantiPassword) {
    return NextResponse.json({ error: 'Ganti password dulu.' }, { status: 403 });
  }
  // Route ini tidak lewat gerbang halaman, jadi perannya diperiksa di sini.
  // Berkasnya memuat NIP, nama, jabatan, dan nilai seluruh petugas dalam
  // cakupan — pegawai biasa tidak boleh mengunduhnya.
  if (!bolehBukaHalaman(saya.role, '/laporan/ekspor')) {
    return NextResponse.json({ error: 'Anda tidak berwenang mengunduh rekap.' }, { status: 403 });
  }

  const url = new URL(request.url);
  const periodeId = url.searchParams.get('periode');
  const cabangId = url.searchParams.get('cabang');

  const periode = periodeId
    ? await prisma.periode.findUnique({ where: { id: periodeId } })
    : await pilihPeriodeRelevan();
  if (!periode) {
    return NextResponse.json({ error: 'Periode tidak ditemukan.' }, { status: 404 });
  }

  // ===== tentukan cakupan cabang (sama seperti halaman laporan) =====
  const bolehLihatSemua = saya.role === 'ADMIN';
  const semuaCabang = await prisma.cabang.findMany({ orderBy: { kode: 'asc' } });
  const ringkas: CabangRingkas[] = semuaCabang.map((c) => ({
    id: c.id, kode: c.kode, nama: c.nama, jenis: c.jenis,
    indukId: c.indukId, aktif: c.aktif,
  }));

  let cakupanId: string[];
  let namaCakupan: string;

  if (bolehLihatSemua) {
    if (cabangId) {
      const unit = ringkas.find((c) => c.id === cabangId);
      if (!unit) {
        return NextResponse.json({ error: 'Unit kerja tidak ditemukan.' }, { status: 404 });
      }
      cakupanId = kumpulkanTurunan(unit.id, ringkas);
      namaCakupan =
        `${LABEL_JENIS[unit.jenis]} ${unit.kode} — ${unit.nama}` +
        (cakupanId.length > 1 ? ` (${cakupanId.length - 1} unit turunan)` : '');
    } else {
      cakupanId = semuaCabang.map((c) => c.id);
      namaCakupan = 'Seluruh unit kerja';
    }
  } else {
    cakupanId = kumpulkanTurunan(saya.cabang.id, ringkas);
    const unitSendiri = ringkas.find((c) => c.id === saya.cabang.id);
    namaCakupan =
      `${unitSendiri ? LABEL_JENIS[unitSendiri.jenis] : ''} ${saya.cabang.kode} — ${saya.cabang.nama}`.trim() +
      (cakupanId.length > 1 ? ` (${cakupanId.length - 1} unit turunan)` : '');
  }

  // ===== ambil penilaian =====
  const penilaian = await prisma.penilaian.findMany({
    where: {
      periodeId: periode.id,
      pegawai: { cabangId: { in: cakupanId } },
    },
    include: {
      pegawai: {
        include: {
          jabatan: true,
          cabang: { select: { kode: true, nama: true } },
        },
      },
    },
    orderBy: [{ nilaiAkhir: 'desc' }],
  });

  // ===== susun baris & statistik =====
  const baris: BarisRekap[] = penilaian.map((p, i) => ({
    rank: i + 1,
    nama: p.pegawai.nama,
    nip: p.pegawai.nip,
    jabatan: p.pegawai.jabatan?.nama ?? '-',
    cabang: `${p.pegawai.cabang.kode} - ${p.pegawai.cabang.nama}`,
    penampilan: p.nilaiPenampilan,
    kemampuan: p.nilaiKemampuan,
    sikap: p.nilaiSikap,
    nilaiAkhir: p.nilaiAkhir,
    rating: p.rating ?? '-',
    status: LABEL_STATUS[p.status] ?? p.status,
  }));

  const nilai = penilaian.map((p) => p.nilaiAkhir ?? 0);
  const rataRata = nilai.length > 0 ? nilai.reduce((a, b) => a + b, 0) / nilai.length : 0;

  const sebaran: Record<string, number> = {};
  for (const p of penilaian) {
    const r = p.rating ?? '—';
    sebaran[r] = (sebaran[r] ?? 0) + 1;
  }

  const csv = susunCsvRekap(
    {
      periode: periode.nama,
      cakupan: namaCakupan,
      jumlahDinilai: penilaian.length,
      rataRata,
      tertinggi:
        penilaian.length > 0
          ? { nama: penilaian[0].pegawai.nama, nilai: penilaian[0].nilaiAkhir ?? 0 }
          : null,
      terendah:
        penilaian.length > 0
          ? {
              nama: penilaian[penilaian.length - 1].pegawai.nama,
              nilai: penilaian[penilaian.length - 1].nilaiAkhir ?? 0,
            }
          : null,
      sebaran,
    },
    baris
  );

  // catat ekspor di audit log — berkas berisi data pribadi pegawai
  await prisma.auditLog.create({
    data: {
      pegawaiId: saya.id,
      aksi: 'EKSPOR_REKAP',
      entitas: 'Periode',
      entitasId: periode.id,
      dataBaru: {
        periode: periode.kode,
        cakupan: namaCakupan,
        jumlahBaris: baris.length,
      },
    },
  });

  const namaBerkas = namaBerkasRekap(periode.kode);

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${namaBerkas}"`,
      'Cache-Control': 'no-store',
    },
  });
}
