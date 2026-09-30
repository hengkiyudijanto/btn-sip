/**
 * Verifikasi halaman pengajuan pegawai di produksi.
 * Jalankan: BASE_URL=https://btn-sip.vercel.app pnpm exec tsx scripts/cek-produksi-pengajuan.ts
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

let lulus = 0;
let gagal = 0;
function cek(k: boolean, label: string) {
  console.log(`   ${k ? 'ok ' : 'XX '} ${label}`);
  if (k) lulus++;
  else gagal++;
}

async function main() {
  console.log(`=== CEK PRODUKSI HALAMAN PENGAJUAN (${BASE}) ===\n`);

  const admin = await prisma.pegawai.findUnique({ where: { nip: 'admin' } });
  if (!admin) throw new Error('admin tidak ada');
  const token = crypto.randomBytes(32).toString('base64url');
  await prisma.sesi.create({
    data: { tokenHash: h(token), pegawaiId: admin.id, expiresAt: new Date(Date.now() + 600000) },
  });

  const res = await fetch(`${BASE}/pengajuan-pegawai`, {
    headers: { cookie: 'sip_sesi=' + token },
    redirect: 'manual',
  });
  const html = res.status === 200 ? await res.text() : '';
  cek(res.status === 200, `halaman terbuka (status ${res.status})`);

  cek(html.includes('Pengajuan Pegawai'), 'judul halaman ada');
  cek(html.includes('Usul Pegawai'), 'menu navigasi ada');
  cek(html.includes('Ajukan pegawai'), 'tombol ajukan ada');
  cek(html.includes('Kenapa lewat pengajuan'), 'penjelasan alur ada');
  cek(html.includes('Menunggu keputusan'), 'bagian menunggu keputusan ada');
  cek(html.includes('NIP'), 'kolom NIP ada');
  cek(html.includes('Unit kerja'), 'kolom unit kerja ada');

  // admin harus melihat tombol keputusan kalau ada pengajuan menunggu
  const menunggu = await prisma.pengajuanPegawai.count({ where: { status: 'MENUNGGU' } });
  console.log(`   pengajuan menunggu: ${menunggu}`);
  if (menunggu > 0) {
    cek(html.includes('Setujui') && html.includes('Tolak'), 'tombol Setujui/Tolak tampil');
  }

  await prisma.sesi.deleteMany({ where: { pegawaiId: admin.id } });

  console.log(`\n=== HASIL: ${lulus} lulus, ${gagal} gagal ===`);
  if (gagal > 0) process.exit(1);
  console.log('✅ HALAMAN PENGAJUAN AKTIF DI PRODUKSI.');
}

main()
  .catch((e) => {
    console.error('GAGAL:', e.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
