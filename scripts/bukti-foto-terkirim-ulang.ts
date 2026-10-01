/**
 * Buktikan pemborosan KEDUA: foto ikut terkirim berulang sebagai bagian HTML.
 *
 * Kalau benar, maka membuka halaman 10x berarti mengunduh foto 10x — padahal
 * fotonya tidak berubah. Ini pemborosan yang jauh lebih besar dari base64,
 * dan bisa dihilangkan TANPA menyentuh kualitas foto.
 *
 * Jalankan: pnpm exec tsx scripts/bukti-foto-terkirim-ulang.ts
 */
import 'dotenv/config';
import crypto from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const BASE = process.env.BASE_URL ?? 'https://btn-sip.vercel.app';
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});
const h = (t: string) => crypto.createHash('sha256').update(t).digest('hex');

async function main() {
  console.log(`=== BUKTI: FOTO TERKIRIM ULANG DI SETIAP PEMBUKAAN (${BASE}) ===\n`);

  const admin = await prisma.pegawai.findUnique({ where: { nip: 'admin' } });
  if (!admin) throw new Error('akun admin tidak ada');
  const token = crypto.randomBytes(32).toString('base64url');
  await prisma.sesi.create({
    data: { tokenHash: h(token), pegawaiId: admin.id, expiresAt: new Date(Date.now() + 900000) },
  });
  const cookie = `sip_sesi=${token}`;

  // cari halaman laporan yang punya foto penilaian
  const adaFoto = await prisma.penilaian.findFirst({
    where: { fotoData: { not: null } },
    select: { id: true, fotoUkuran: true, pegawai: { select: { nama: true } } },
  });
  if (!adaFoto) {
    console.log('  (belum ada penilaian dengan foto — lewati)');
  } else {
    console.log(`  penilaian contoh : ${adaFoto.pegawai.nama}`);
    console.log(`  ukuran foto      : ${adaFoto.fotoUkuran} byte (biner)`);
    console.log(`  sebagai base64   : ~${Math.round((adaFoto.fotoUkuran ?? 0) * 4 / 3)} byte\n`);

    console.log('  Membuka halaman laporan 5x:');
    let total = 0;
    for (let i = 1; i <= 5; i++) {
      const res = await fetch(`${BASE}/laporan/${adaFoto.id}`, {
        headers: { cookie }, redirect: 'manual',
      });
      const html = await res.text();
      total += Buffer.byteLength(html);
      const adaDataUrl = html.includes('data:image/');
      console.log(
        `    buka ke-${i}: HTML ${(Buffer.byteLength(html) / 1024).toFixed(0)} KB   ` +
          `foto ikut terkirim: ${adaDataUrl ? 'YA' : 'tidak'}`
      );
    }
    console.log(`\n  total terunduh untuk 5x buka: ${(total / 1024).toFixed(0)} KB`);
    console.log(
      `  kalau foto dikirim sekali lalu di-cache browser: ~${(
        Buffer.byteLength(await (await fetch(`${BASE}/laporan/${adaFoto.id}`, {
          headers: { cookie },
        })).text()) / 1024
      ).toFixed(0)} KB + 4x (HTML tanpa foto)`
    );
  }

  // hitung proyeksi yang lebih luas
  console.log('\n=== PROYEKSI SKALA ===');
  const jumlahPenilaian = await prisma.penilaian.count();
  const denganFoto = await prisma.penilaian.count({ where: { fotoData: { not: null } } });
  console.log(`  penilaian tersimpan   : ${jumlahPenilaian}`);
  console.log(`  dengan foto           : ${denganFoto}`);

  const rataFoto = 40_000; // estimasi konservatif byte biner per foto
  const perTahun = 5 * 48 * 12; // 5 petugas x 48 periode x 12 cabang (contoh Kanwil)
  console.log(`\n  contoh Kanwil: 12 cabang x 5 petugas x 48 periode = ${perTahun} foto/tahun`);
  console.log(`  data URL per foto ~${Math.round(rataFoto * 4 / 3 / 1024)} KB`);
  console.log(`  pertumbuhan database   : ~${(perTahun * rataFoto * 4 / 3 / 1024 / 1024).toFixed(0)} MB/tahun`);
  console.log(`  kuota Neon gratis 512 MB -> cukup ~${Math.floor(512 / (perTahun * rataFoto * 4 / 3 / 1024 / 1024))} tahun`);

  await prisma.sesi.deleteMany({ where: { pegawaiId: admin.id } });
}

main()
  .catch((e) => { console.error('GAGAL:', e.message); process.exit(1); })
  .finally(() => prisma.$disconnect());
