import { NextRequest, NextResponse } from 'next/server';
import { pegawaiDariSesi } from '@/lib/auth';
import { prisma } from '@/lib/db';

/**
 * Menyajikan foto sebagai berkas gambar tersendiri, bukan sebagai data URL
 * yang ditanam di HTML.
 *
 * Kenapa: foto berukuran ~28 KB sebagai data URL ikut terkirim SETIAP KALI
 * halaman dibuka. Atasan yang memeriksa laporan 5x berarti mengunduh foto
 * yang sama 5x. Dengan route ini browser menyimpannya di cache dan hanya
 * mengunduh sekali — 5x buka: 139 KB -> 28 KB (hemat 80%).
 *
 * Kualitas foto tidak berubah sama sekali: byte gambar diteruskan apa adanya.
 *
 * Keamanan: hanya pegawai yang sudah login boleh membuka, dan aturan
 * cakupannya sama seperti halaman laporan.
 */

// Foto melekat pada satu penilaian dan tidak berubah setelah dikirim.
// Kalau diganti, alamatnya ikut berubah karena memuat penanda versi
// (lihat alamatFoto di src/lib/sip/alamat-foto.ts).
const CACHE_JANGKA_PANJANG = 'private, max-age=604800, immutable';

// Selama penilaian masih DRAFT, fotonya MASIH BISA DIGANTI. Kalau tetap
// di-cache lama, atasan yang baru mengganti foto akan melihat foto lama di
// lembar laporan sampai cache-nya kedaluwarsa — pernah terjadi. Untuk DRAFT
// foto selalu diambil ulang dari server; setelah dikirim (tidak bisa diubah
// lagi) barulah boleh di-cache lama.
const CACHE_DRAFT = 'private, no-cache, must-revalidate';

const POLA_DATA_URL = /^data:(image\/(?:jpeg|png|webp));base64,([\s\S]+)$/;

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ jenis: string; id: string }> }
) {
  const saya = await pegawaiDariSesi();
  if (!saya) return new NextResponse(null, { status: 401 });

  const { jenis, id } = await params;

  if (jenis === 'penilaian') {
    const p = await prisma.penilaian.findUnique({
      where: { id },
      select: {
        fotoData: true,
        fotoMime: true,
        penilaiId: true,
        pegawaiId: true,
        status: true,
        pegawai: { select: { atasanId: true, cabangId: true } },
      },
    });
    if (!p?.fotoData) return new NextResponse(null, { status: 404 });

    // admin bebas; penilai & yang dinilai selalu boleh; manager boleh untuk
    // cabangnya sendiri; atasan langsung boleh untuk bawahannya
    const boleh =
      saya.role === 'ADMIN' ||
      p.penilaiId === saya.id ||
      p.pegawaiId === saya.id ||
      (saya.role === 'MANAGER' && p.pegawai.cabangId === saya.cabang.id) ||
      p.pegawai.atasanId === saya.id;
    if (!boleh) return new NextResponse(null, { status: 403 });

    // DRAFT/Dikembalikan masih bisa diubah -> jangan di-cache lama.
    const bisaDiubah = p.status === 'DRAFT';
    return kirim(p.fotoData, p.fotoMime, bisaDiubah ? CACHE_DRAFT : CACHE_JANGKA_PANJANG);
  }

  if (jenis === 'pegawai') {
    const p = await prisma.pegawai.findUnique({
      where: { id },
      select: { fotoData: true, fotoMime: true, cabangId: true },
    });
    if (!p?.fotoData) return new NextResponse(null, { status: 404 });

    const boleh =
      saya.role === 'ADMIN' ||
      saya.role === 'MANAGER' ||
      p.cabangId === saya.cabang.id;
    if (!boleh) return new NextResponse(null, { status: 403 });

    // Foto pegawai bisa diganti kapan saja oleh admin, jadi jangan di-cache
    // lama — kalau tidak, foto lama akan terus tampil di laporan.
    return kirim(p.fotoData, p.fotoMime, CACHE_DRAFT);
  }

  return new NextResponse(null, { status: 400 });
}

/** Ubah data URL menjadi respons berkas gambar, tanpa mengubah isinya. */
function kirim(dataUrl: string, mime: string | null, cache: string) {
  const cocok = POLA_DATA_URL.exec(dataUrl);
  if (!cocok) return new NextResponse(null, { status: 422 });

  const contentType = cocok[1] || mime || 'image/jpeg';
  const isi = Buffer.from(cocok[2], 'base64');

  return new NextResponse(new Uint8Array(isi), {
    status: 200,
    headers: {
      'Content-Type': contentType,
      'Content-Length': String(isi.length),
      'Cache-Control': cache,
    },
  });
}
