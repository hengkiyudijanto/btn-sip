/**
 * Uji proteksi akses halaman detail pegawai.
 * Membuat dua akun pegawai (satu aktif tanpa wajib-ganti-password) supaya
 * aturan akses benar-benar teruji.
 *
 * Jalankan: pnpm exec tsx scripts/test-proteksi-detail.ts
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

let lulus = 0;
let gagal = 0;
function cek(kondisi: boolean, label: string) {
  console.log(`   ${kondisi ? 'ok ' : 'XX '} ${label}`);
  if (kondisi) lulus++;
  else gagal++;
}

const hashToken = (t: string) => crypto.createHash('sha256').update(t).digest('hex');
const NIP_A = 'PROT00001';
const NIP_B = 'PROT00002';

async function buatSesi(pegawaiId: string) {
  const token = crypto.randomBytes(32).toString('base64url');
  await prisma.sesi.create({
    data: { tokenHash: hashToken(token), pegawaiId, expiresAt: new Date(Date.now() + 3600_000) },
  });
  return token;
}

async function get(path: string, token: string) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { cookie: `sip_sesi=${token}` },
    redirect: 'manual',
  });
  return { status: res.status, html: await res.text(), lokasi: res.headers.get('location') };
}

async function main() {
  console.log('=== UJI PROTEKSI AKSES HALAMAN DETAIL ===\n');

  await prisma.pegawai.deleteMany({ where: { nip: { in: [NIP_A, NIP_B] } } });
  const cabang = await prisma.cabang.findFirst({ where: { aktif: true } });
  if (!cabang) throw new Error('tidak ada cabang aktif');

  const hash = await bcrypt.hash('ProtPass123', 10);
  const a = await prisma.pegawai.create({
    data: {
      nip: NIP_A, nama: 'Pegawai Proteksi A', passwordHash: hash,
      role: 'PEGAWAI', harusGantiPassword: false, aktif: true, cabangId: cabang.id,
    },
  });
  const b = await prisma.pegawai.create({
    data: {
      nip: NIP_B, nama: 'Pegawai Proteksi B', passwordHash: hash,
      role: 'PEGAWAI', harusGantiPassword: false, aktif: true, cabangId: cabang.id,
    },
  });
  console.log('ok  dua pegawai uji dibuat (tidak wajib ganti password)\n');

  const tokenA = await buatSesi(a.id);

  // ===== 1. boleh lihat diri sendiri =====
  console.log('--- 1. akses diri sendiri ---');
  const r1 = await get(`/pegawai/${a.id}`, tokenA);
  cek(r1.status === 200, `boleh buka detail sendiri (status ${r1.status})`);
  cek(r1.html.includes('Pegawai Proteksi A'), 'nama sendiri tampil');
  cek(!r1.html.includes('Hapus foto'), 'pegawai biasa TIDAK melihat kontrol unggah foto');
  cek(!r1.html.includes('Foto pegawai (3'), 'panel unggah foto tidak dirender untuk pegawai biasa');

  // ===== 2. TIDAK boleh lihat orang lain =====
  console.log('\n--- 2. akses pegawai lain ---');
  const r2 = await get(`/pegawai/${b.id}`, tokenA);
  cek(r2.status === 307, `dialihkan (status ${r2.status})`);
  cek(r2.lokasi === '/dasbor', `dialihkan ke dasbor (${r2.lokasi})`);
  cek(!r2.html.includes('Pegawai Proteksi B'), 'data pegawai lain TIDAK bocor di respons');

  // ===== 3. manager boleh lihat =====
  console.log('\n--- 3. akses manager ---');
  const mgr = await prisma.pegawai.findFirst({
    where: { role: { in: ['MANAGER', 'ADMIN'] }, aktif: true },
  });
  if (mgr) {
    const tokenMgr = await buatSesi(mgr.id);
    const r3 = await get(`/pegawai/${a.id}`, tokenMgr);
    cek(r3.status === 200, `manager boleh buka detail pegawai (status ${r3.status})`);
    await prisma.sesi.deleteMany({ where: { pegawaiId: mgr.id } });
  }

  // ===== 4. tanpa sesi =====
  console.log('\n--- 4. tanpa sesi ---');
  const res = await fetch(`${BASE}/pegawai/${a.id}`, { redirect: 'manual' });
  cek(res.status === 307, `tanpa login dialihkan (status ${res.status})`);

  // ===== 5. wajib ganti password =====
  console.log('\n--- 5. akun wajib ganti password ---');
  await prisma.pegawai.update({ where: { id: a.id }, data: { harusGantiPassword: true } });
  const r5 = await get(`/pegawai/${b.id}`, tokenA);
  cek(
    r5.status === 307 && r5.lokasi === '/ubah-password',
    `dialihkan ke ubah-password dulu (${r5.status} → ${r5.lokasi})`
  );

  // bersihkan
  await prisma.sesi.deleteMany({ where: { pegawaiId: { in: [a.id, b.id] } } });
  await prisma.pegawai.deleteMany({ where: { nip: { in: [NIP_A, NIP_B] } } });
  console.log('\n✓ data uji dibersihkan');

  console.log(`\n=== HASIL: ${lulus} lulus, ${gagal} gagal ===`);
  if (gagal > 0) process.exit(1);
  console.log('✅ PROTEKSI AKSES TERVERIFIKASI.');
}

main()
  .catch((e) => {
    console.error('\n❌ GAGAL:', e.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
