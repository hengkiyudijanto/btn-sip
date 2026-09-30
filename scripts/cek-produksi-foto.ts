/**
 * Cek apakah fitur unggah foto sudah aktif di PRODUKSI (Vercel).
 * Membuat sesi admin, lalu memeriksa halaman detail pegawai di URL produksi.
 *
 * Jalankan: BASE_URL=https://btn-sip.vercel.app pnpm exec tsx scripts/cek-produksi-foto.ts
 */
import 'dotenv/config';
import crypto from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const BASE = process.env.BASE_URL ?? 'https://btn-sip.vercel.app';
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

const hashToken = (t: string) => crypto.createHash('sha256').update(t).digest('hex');

let lulus = 0;
let gagal = 0;
function cek(kondisi: boolean, label: string) {
  console.log(`   ${kondisi ? 'ok ' : 'XX '} ${label}`);
  if (kondisi) lulus++;
  else gagal++;
}

async function main() {
  console.log(`=== CEK PRODUKSI: ${BASE} ===\n`);

  const admin = await prisma.pegawai.findUnique({ where: { nip: 'admin' } });
  if (!admin) throw new Error('akun admin tidak ada');
  if (admin.harusGantiPassword) {
    console.log('PERHATIAN: akun admin masih wajib ganti password —');
    console.log('halaman akan dialihkan ke /ubah-password, bukan karena bug.\n');
  }

  const token = crypto.randomBytes(32).toString('base64url');
  await prisma.sesi.create({
    data: { tokenHash: hashToken(token), pegawaiId: admin.id, expiresAt: new Date(Date.now() + 1800_000) },
  });

  // ambil satu pegawai untuk diuji
  const target = await prisma.pegawai.findFirst({
    where: { nip: { not: 'admin' } },
    select: { id: true, nip: true, nama: true },
  });
  if (!target) throw new Error('tidak ada pegawai lain untuk diuji');

  const cookie = `sip_sesi=${token}`;

  // ===== 1. daftar pegawai =====
  console.log('--- 1. halaman daftar pegawai ---');
  const r1 = await fetch(`${BASE}/pegawai`, { headers: { cookie }, redirect: 'manual' });
  const h1 = await r1.text();
  console.log(`   status: ${r1.status}`);
  cek(r1.status === 200, 'daftar pegawai bisa dibuka');

  if (r1.status === 307) {
    console.log(`   dialihkan ke: ${r1.headers.get('location')}`);
    console.log('   → kemungkinan akun admin wajib ganti password dulu.');
  }

  cek(h1.includes('Pengelolaan Pegawai'), 'judul halaman daftar ada');
  cek(h1.includes(`/pegawai/${target.id}`), `nama "${target.nama}" ter-link ke halaman detail`);

  // ===== 2. halaman detail =====
  console.log('\n--- 2. halaman detail pegawai ---');
  const r2 = await fetch(`${BASE}/pegawai/${target.id}`, {
    headers: { cookie },
    redirect: 'manual',
  });
  const h2 = await r2.text();
  console.log(`   status: ${r2.status}`);

  cek(r2.status === 200, 'halaman detail bisa dibuka');
  cek(h2.includes(target.nama), 'nama pegawai tampil');
  cek(h2.includes('Foto pegawai'), 'panel unggah foto MUNCUL di produksi');
  cek(h2.includes('Pilih file foto'), 'tombol pilih berkas ada');
  cek(h2.includes('dikompres otomatis'), 'keterangan kompresi ada');
  cek(h2.includes('atau pakai URL'), 'opsi URL ada');

  // ===== 3. kasih tahu kalau belum ter-deploy =====
  console.log('\n--- 3. diagnosis ---');
  if (!h2.includes('Foto pegawai')) {
    console.log('   Panel unggah foto BELUM ada di produksi.');
    console.log('   Kemungkinan: Vercel belum selesai deploy commit terbaru.');
    console.log('   Cek di dashboard Vercel → Deployments, pastikan commit 450645b sudah Ready.');
  } else {
    console.log('   Panel unggah foto SUDAH aktif di produksi.');
    console.log('   Kalau di layar Anda belum muncul: klik NAMA pegawai di daftar Pegawai.');
  }

  await prisma.sesi.deleteMany({ where: { pegawaiId: admin.id } });

  console.log(`\n=== HASIL: ${lulus} lulus, ${gagal} gagal ===`);
}

main()
  .catch((e) => {
    console.error('GAGAL:', e.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
