/**
 * Unduh tampilan ranking SATU HALAMAN sebagai PPTX (satu slide, semua peserta).
 *
 * Berbeda dari /laporan/ranking/pptx yang membuat satu slide per unit+posisi,
 * route ini membuat SATU slide berisi seluruh peringkat — mengikuti permintaan
 * pemilik aplikasi supaya semuanya tampil dalam satu halaman.
 */

import { NextResponse } from 'next/server';
import { pegawaiDariSesi, catatAudit } from '@/lib/auth';
import { bolehBukaHalaman } from '@/lib/sip/akses';
import { susunRankingGabungan } from '@/lib/sip/ranking-gabungan';
import { bangunPptxRankingSatu } from '@/lib/sip/ranking-satu-pptx';
import type { JenisCabang } from '@prisma/client';

export async function GET(req: Request) {
  const saya = await pegawaiDariSesi();
  if (!saya) {
    return NextResponse.json({ error: 'Belum masuk.' }, { status: 401 });
  }
  if (!bolehBukaHalaman(saya.role, '/laporan/ranking')) {
    return NextResponse.json({ error: 'Tidak punya akses.' }, { status: 403 });
  }

  const u = new URL(req.url);
  const periodeId = u.searchParams.get('periode');
  if (!periodeId) {
    return NextResponse.json({ error: 'Periode wajib diisi.' }, { status: 400 });
  }

  const data = await susunRankingGabungan({
    periodeId,
    jenis: (u.searchParams.get('jenis') as JenisCabang | null) || null,
    kodeCabang: u.searchParams.get('cabang'),
    kodeJabatan: u.searchParams.get('posisi'),
  });

  if (data.jumlahPeserta === 0) {
    return NextResponse.json(
      { error: 'Tidak ada penilaian yang cocok dengan filter ini.' },
      { status: 404 }
    );
  }

  // Foto sudah berbentuk data URL di data.baris; pembuat PPTX hanya butuh
  // isi base64 tanpa awalan, dikumpulkan per NIP.
  const petaFoto = new Map<string, string>();
  for (const b of data.baris) {
    if (b.foto) {
      const koma = b.foto.indexOf(',');
      if (koma > 0) petaFoto.set(b.nip, b.foto.slice(koma + 1));
    }
  }

  const berkas = await bangunPptxRankingSatu(data, petaFoto);

  const namaBerkas = `ranking-1-halaman-${data.periode.replace(/[^a-zA-Z0-9]+/g, '-')}.pptx`;

  await catatAudit({
    pegawaiId: saya.id,
    aksi: 'UNDUH_RANKING_SATU_PPTX',
    entitas: 'Periode',
    entitasId: periodeId,
    dataBaru: {
      periode: data.periode,
      unit: data.unit,
      posisi: data.posisi,
      jumlahPeserta: data.jumlahPeserta,
    },
  });

  return new NextResponse(new Uint8Array(berkas), {
    headers: {
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'Content-Disposition': `attachment; filename="${namaBerkas}"`,
      'Cache-Control': 'no-store',
    },
  });
}
