import { NextRequest, NextResponse } from 'next/server';
import { pegawaiDariSesi, catatAudit } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { susunRanking } from '@/lib/sip/ranking';
import { bangunPptxRanking } from '@/lib/sip/ranking-pptx';
import { siapkanFotoUntukKotak } from '@/lib/sip/foto-bulat';
import type { JenisCabang } from '@prisma/client';

/**
 * Unduh laporan ranking sebagai PPTX (format Service Drill Ranking).
 *
 * Ditulis dengan pptxgenjs (JavaScript) dan bukan python-pptx, karena
 * fungsi serverless Vercel tidak bisa menjalankan Python. Hasil akhirnya
 * sama: satu slide per unit + posisi, grafik batang horizontal dengan foto.
 */

export async function GET(req: NextRequest) {
  const saya = await pegawaiDariSesi();
  if (!saya) return new NextResponse('Belum masuk', { status: 401 });
  if (saya.harusGantiPassword) {
    return new NextResponse('Wajib ganti password dulu', { status: 403 });
  }

  const sp = req.nextUrl.searchParams;
  const periodeId = sp.get('periode');
  if (!periodeId) return new NextResponse('Periode wajib dipilih', { status: 400 });

  const jenis = (sp.get('jenis') as JenisCabang | null) || null;
  const kodeCabang = sp.get('cabang');
  const kodeJabatan = sp.get('posisi');

  let hasil;
  try {
    hasil = await susunRanking({ periodeId, jenis, kodeCabang, kodeJabatan });
  } catch (e) {
    return new NextResponse((e as Error).message, { status: 404 });
  }

  if (hasil.jumlahPeserta === 0) {
    return new NextResponse(
      'Tidak ada penilaian yang cocok dengan filter ini.',
      { status: 404 }
    );
  }

  // Foto diambil terpisah supaya hanya query ini yang membawa data besar.
  const penilaian = await prisma.penilaian.findMany({
    where: {
      periodeId,
      nilaiAkhir: { not: null },
      pegawai: {
        ...(kodeCabang || jenis
          ? {
              cabang: kodeCabang
                ? { kode: kodeCabang }
                : { jenis: jenis ?? undefined },
            }
          : {}),
        ...(kodeJabatan ? { jabatan: { kode: kodeJabatan } } : {}),
      },
    },
    select: {
      fotoData: true,
      pegawai: {
        select: { nip: true, cabang: { select: { kode: true } }, jabatan: { select: { nama: true } } },
      },
      pegawaiId: true,
    },
  });

  // Peta nip -> isi foto, sudah disiapkan untuk slide.
  //
  // Fotonya diubah dulu di sini: dipotong mengisi kotaknya tanpa gepeng, dan
  // sudutnya dibuat membulat + tembus pandang (src/lib/sip/foto-bulat.ts).
  // Kalau penyiapan gagal, foto aslinya tetap dipakai — lebih baik tampil
  // apa adanya daripada tidak tampil sama sekali.
  const petaFoto = new Map<string, string>();
  for (const p of penilaian) {
    if (!p.fotoData) continue;
    const koma = p.fotoData.indexOf(',');
    if (koma <= 0) continue;

    const base64Asli = p.fotoData.slice(koma + 1);
    const siap = await siapkanFotoUntukKotak(Buffer.from(base64Asli, 'base64'));
    petaFoto.set(
      p.pegawai.nip,
      siap ? siap.toString('base64') : base64Asli
    );
  }

  const buffer = await bangunPptxRanking(hasil, petaFoto);

  const namaBerkas = `ranking-${hasil.periode.replace(/[^a-zA-Z0-9]+/g, '-')}.pptx`;

  await catatAudit({
    pegawaiId: saya.id,
    aksi: 'UNDUH_RANKING_PPTX',
    entitas: 'Periode',
    entitasId: periodeId,
    dataLama: {
      periode: hasil.periode,
      unit: hasil.unit,
      posisi: hasil.posisi,
      peserta: hasil.jumlahPeserta,
    },
  });

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'Content-Disposition': `attachment; filename="${namaBerkas}"`,
      'Content-Length': String(buffer.length),
      'Cache-Control': 'no-store',
    },
  });
}
