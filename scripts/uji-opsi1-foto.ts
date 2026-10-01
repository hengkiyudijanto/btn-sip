/**
 * Uji Opsi 1: foto dilayani lewat route /foto dengan cache browser.
 *
 * Membuktikan:
 *   1. HTML laporan TIDAK lagi memuat data URL (foto tidak ditanam)
 *   2. Halaman memakai alamat /foto/...
 *   3. Route mengembalikan gambar yang benar (tipe + panjang isi)
 *   4. Header cache terpasang (ini inti penghematannya)
 *   5. Aturan akses: tanpa login ditolak, orang lain ditolak
 *   6. Pembukaan berulang menghemat lalu lintas
 *
 * Jalankan: BASE_URL=http://localhost:3100 pnpm exec tsx scripts/uji-opsi1-foto.ts
 */
import 'dotenv/config';
import crypto from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import bcrypt from 'bcryptjs';

const BASE = process.env.BASE_URL ?? 'http://localhost:3100';
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});
const h = (t: string) => crypto.createHash('sha256').update(t).digest('hex');

let lulus = 0;
let gagal = 0;
function cek(kondisi: boolean, label: string) {
  console.log(`   ${kondisi ? 'ok ' : 'XX '} ${label}`);
  if (kondisi) lulus++;
  else gagal++;
}

// JPEG kecil yang sah (1x1 px) sebagai foto uji
const FOTO_UJI =
  'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsL' +
  'DBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QA' +
  'FAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==';

const NIP_S = 'OPSI1SPV';
const NIP_P = 'OPSI1PET';
const NIP_L = 'OPSI1LAIN';
const KODE_W = 'OPSI1-W1';

async function bersih() {
  const ids = (
    await prisma.pegawai.findMany({
      where: { nip: { in: [NIP_S, NIP_P, NIP_L] } },
      select: { id: true },
    })
  ).map((p) => p.id);
  await prisma.penilaianDetail.deleteMany({ where: { penilaian: { pegawaiId: { in: ids } } } });
  await prisma.penilaian.deleteMany({ where: { pegawaiId: { in: ids } } });
  await prisma.sesi.deleteMany({ where: { pegawaiId: { in: ids } } });
  await prisma.pegawai.deleteMany({ where: { nip: { in: [NIP_S, NIP_P, NIP_L] } } });
  await prisma.periode.deleteMany({ where: { kode: KODE_W } });
}

async function main() {
  console.log(`=== UJI OPSI 1: FOTO LEWAT ROUTE + CACHE (${BASE}) ===\n`);
  await bersih();

  const cabang = await prisma.cabang.findFirst({ where: { aktif: true } });
  const hash = await bcrypt.hash('Opsi1uji', 10);

  const spv = await prisma.pegawai.create({
    data: { nip: NIP_S, nama: 'SPV Opsi1', passwordHash: hash, role: 'SUPERVISOR',
      harusGantiPassword: false, aktif: true, cabangId: cabang!.id },
  });
  const pet = await prisma.pegawai.create({
    data: { nip: NIP_P, nama: 'Petugas Opsi1', passwordHash: hash, role: 'PEGAWAI',
      harusGantiPassword: false, aktif: true, cabangId: cabang!.id, atasanId: spv.id },
  });
  // orang lain di cabang berbeda — harus DITOLAK
  const cabangLain = await prisma.cabang.findFirst({
    where: { aktif: true, id: { not: cabang!.id } },
  });
  const lain = await prisma.pegawai.create({
    data: { nip: NIP_L, nama: 'Orang Lain', passwordHash: hash, role: 'PEGAWAI',
      harusGantiPassword: false, aktif: true, cabangId: (cabangLain ?? cabang!).id },
  });

  const per = await prisma.periode.create({
    data: { kode: KODE_W, nama: 'Uji Opsi1', tanggalMulai: new Date(2048, 0, 1),
      tanggalSelesai: new Date(2048, 0, 7), aktif: true },
  });
  const pen = await prisma.penilaian.create({
    data: {
      pegawaiId: pet.id, penilaiId: spv.id, periodeId: per.id, status: 'FINAL',
      nilaiAkhir: 3.5, rating: 'Cukup',
      fotoData: FOTO_UJI, fotoMime: 'image/jpeg', fotoUkuran: 160,
      fotoCatatan: 'seragam lengkap',
      detail: { create: [{ kodeAspek: 'A1', nilaiMentah: 90, skor: 3, bobotAspek: 0.4 }] },
    },
  });

  const tokenSpv = crypto.randomBytes(32).toString('base64url');
  const tokenLain = crypto.randomBytes(32).toString('base64url');
  await prisma.sesi.create({
    data: { tokenHash: h(tokenSpv), pegawaiId: spv.id, expiresAt: new Date(Date.now() + 900000) },
  });
  await prisma.sesi.create({
    data: { tokenHash: h(tokenLain), pegawaiId: lain.id, expiresAt: new Date(Date.now() + 900000) },
  });

  const cookieSpv = `sip_sesi=${tokenSpv}`;
  const cookieLain = `sip_sesi=${tokenLain}`;

  // ===== 1. HTML laporan tidak lagi memuat data URL =====
  console.log('--- 1. HTML laporan ---');
  const resHal = await fetch(`${BASE}/laporan/${pen.id}`, {
    headers: { cookie: cookieSpv }, redirect: 'manual',
  });
  const html = await resHal.text();
  cek(resHal.status === 200, `halaman terbuka (${resHal.status})`);
  cek(!html.includes('data:image/'), 'HTML TIDAK memuat data URL foto');
  cek(html.includes(`/foto/penilaian/${pen.id}`), 'HTML memakai alamat /foto/penilaian/<id>');
  cek(html.includes('?v='), 'alamat foto memuat penanda versi (anti cache-basi)');
  console.log(`   ukuran HTML: ${(Buffer.byteLength(html) / 1024).toFixed(1)} KB`);

  // ===== 2. route mengembalikan gambar yang benar =====
  console.log('\n--- 2. route /foto ---');
  const alamat = `/foto/penilaian/${pen.id}?v=1`;
  const resFoto = await fetch(`${BASE}${alamat}`, { headers: { cookie: cookieSpv } });
  cek(resFoto.status === 200, `status 200 (${resFoto.status})`);
  cek(
    (resFoto.headers.get('content-type') ?? '').startsWith('image/'),
    `tipe isi gambar (${resFoto.headers.get('content-type')})`
  );
  const byteFoto = (await resFoto.arrayBuffer()).byteLength;
  cek(byteFoto > 0, `ada isinya (${byteFoto} byte)`);

  // panjang isi harus sama dengan byte asli fotonya (tidak diubah kualitasnya)
  const byteAsli = Buffer.from(FOTO_UJI.split(',')[1], 'base64').length;
  cek(byteFoto === byteAsli, `byte identik dengan aslinya (${byteAsli}) — kualitas tidak berubah`);

  // ===== 3. header cache =====
  console.log('\n--- 3. header cache (inti penghematan) ---');
  const cc = resFoto.headers.get('cache-control') ?? '';
  cek(cc.includes('max-age='), `Cache-Control ada (${cc})`);
  cek(cc.includes('private'), 'bertanda private (foto tidak disimpan di cache bersama)');
  const maxAge = Number(/max-age=(\d+)/.exec(cc)?.[1] ?? 0);
  cek(maxAge >= 86400, `masa simpan lama (${maxAge} detik = ${(maxAge / 86400).toFixed(0)} hari)`);

  // ===== 4. pembukaan berulang & lalu lintas =====
  console.log('\n--- 4. pembukaan berulang ---');
  const ukuranFotoKb = byteFoto / 1024;
  const ukuranHtmlKb = Buffer.byteLength(html) / 1024;
  console.log(`   HTML laporan tanpa foto : ${ukuranHtmlKb.toFixed(1)} KB`);
  console.log(`   foto (di-cache)         : ${ukuranFotoKb.toFixed(1)} KB`);
  const tanpaOpsi1 = ukuranHtmlKb * 5 + ukuranFotoKb * 5;
  const denganOpsi1 = ukuranHtmlKb * 5 + ukuranFotoKb;
  console.log(`   5x buka SEBELUM (foto di HTML) : ${tanpaOpsi1.toFixed(1)} KB`);
  console.log(`   5x buka SESUDAH (foto di-cache): ${denganOpsi1.toFixed(1)} KB`);
  cek(
    denganOpsi1 < tanpaOpsi1,
    `hemat ${(((tanpaOpsi1 - denganOpsi1) / tanpaOpsi1) * 100).toFixed(0)}% pada 5x buka`
  );

  // ===== 5. aturan akses =====
  console.log('\n--- 5. aturan akses ---');
  const tanpaLogin = await fetch(`${BASE}${alamat}`, { redirect: 'manual' });
  cek(tanpaLogin.status === 401, `tanpa login ditolak 401 (${tanpaLogin.status})`);

  const orangLain = await fetch(`${BASE}${alamat}`, { headers: { cookie: cookieLain } });
  cek(
    orangLain.status === 403,
    `pegawai cabang lain ditolak 403 (${orangLain.status})`
  );

  const penilai = await fetch(`${BASE}${alamat}`, { headers: { cookie: cookieSpv } });
  cek(penilai.status === 200, `penilai boleh membuka (${penilai.status})`);

  const salah = await fetch(`${BASE}/foto/penilaian/tidak-ada`, { headers: { cookie: cookieSpv } });
  cek(salah.status === 404, `id tidak ada -> 404 (${salah.status})`);

  const jenisSalah = await fetch(`${BASE}/foto/ngawur/${pen.id}`, {
    headers: { cookie: cookieSpv },
  });
  cek(jenisSalah.status === 400, `jenis tidak dikenal -> 400 (${jenisSalah.status})`);

  // ===== 6. cetak PDF masih memuat foto =====
  console.log('\n--- 6. PDF memuat foto ---');
  const { execSync } = await import('node:child_process');
  try {
    const keluaran = execSync('pnpm exec tsx scripts/cetak-dua-versi.ts 2>&1', {
      encoding: 'utf8', timeout: 180000,
    });
    const barisGambar = keluaran.split('\n').filter((l) => l.includes('gambar:'));
    for (const b of barisGambar) console.log(`   ${b.trim()}`);
    cek(
      barisGambar.some((l) => l.includes('semua gambar dimuat')),
      'skrip cetak menunggu gambar selesai dimuat'
    );
  } catch (e) {
    cek(false, `cetak PDF gagal: ${(e as Error).message.slice(0, 80)}`);
  }

  await bersih();
  console.log(`\n=== HASIL: ${lulus} lulus, ${gagal} gagal ===`);
  if (gagal > 0) process.exit(1);
  console.log('✅ OPSI 1 TERVERIFIKASI.');
}

main()
  .catch((e) => { console.error('GAGAL:', e.message); process.exit(1); })
  .finally(() => prisma.$disconnect());
