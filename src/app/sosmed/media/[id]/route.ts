import { NextRequest, NextResponse } from 'next/server';
import { pegawaiDariSesi } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { bolehLihatKonten } from '@/lib/sosmed/akses';

/**
 * Menyajikan berkas media konten sebagai respons gambar/video tersendiri.
 *
 * Dua alasan kenapa harus route, bukan data URL di HTML:
 *  1. Berkas besar (sampai 20 MB) tidak boleh ikut terkirim setiap kali
 *     halaman dibuka — peramban menyimpannya di cache dan hanya mengunduh
 *     sekali.
 *  2. API TikTok/Instagram meminta URL PUBLIK, bukan unggahan berkas. Route
 *     inilah URL yang dipakai adapter pengiriman.
 *
 * KEAMANAN: hanya pegawai login yang telah melihat konten ini. Kalau nanti
 * pengiriman ke platform nyata memakai route ini, platform tidak akan bisa
 * menariknya tanpa sesi — solusinya token sekali-pakai berumur pendek
 * (BELUM dibuat; lihat catatan di /sosmed/pengaturan).
 */

const CACHE = 'private, max-age=300';

const POLA = /^data:(image\/(?:jpeg|png|webp)|video\/(?:mp4|quicktime|webm));base64,([\s\S]+)$/;

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const saya = await pegawaiDariSesi();
  if (!saya) return new NextResponse(null, { status: 401 });

  const { id } = await ctx.params;

  const konten = await prisma.kontenSosmed.findUnique({
    where: { id },
    select: {
      mediaData: true,
      mediaMime: true,
      pembuatId: true,
      penyetujuId: true,
      status: true,
    },
  });

  if (!konten?.mediaData) return new NextResponse(null, { status: 404 });

  const izin = bolehLihatKonten(
    {
      pembuatId: konten.pembuatId,
      penyetujuId: konten.penyetujuId,
      status: konten.status as never,
    },
    { id: saya.id, role: saya.role }
  );
  if (!izin) return new NextResponse(null, { status: 403 });

  const cocok = POLA.exec(konten.mediaData);
  if (!cocok) return new NextResponse(null, { status: 422 });

  const isi = Buffer.from(cocok[2], 'base64');
  const contentType = cocok[1] || konten.mediaMime || 'application/octet-stream';

  return new NextResponse(new Uint8Array(isi), {
    status: 200,
    headers: {
      'Content-Type': contentType,
      'Content-Length': String(isi.length),
      'Cache-Control': CACHE,
    },
  });
}
