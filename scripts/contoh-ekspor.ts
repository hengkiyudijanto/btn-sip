/**
 * Unduh contoh berkas rekap dari produksi untuk diperiksa manusia.
 * Jalankan: BASE_URL=https://btn-sip.vercel.app pnpm exec tsx scripts/contoh-ekspor.ts
 */
import 'dotenv/config';
import crypto from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const BASE = process.env.BASE_URL ?? 'http://localhost:3100';
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});
const h = (t: string) => crypto.createHash('sha256').update(t).digest('hex');

async function main() {
  const admin = await prisma.pegawai.findUnique({ where: { nip: 'admin' } });
  if (!admin) throw new Error('admin tidak ada');
  const token = crypto.randomBytes(32).toString('base64url');
  await prisma.sesi.create({
    data: { tokenHash: h(token), pegawaiId: admin.id, expiresAt: new Date(Date.now() + 600000) },
  });

  const res = await fetch(`${BASE}/laporan/ekspor`, {
    headers: { cookie: 'sip_sesi=' + token },
  });
  const buf = Buffer.from(await res.arrayBuffer());
  const keluar = '/home/ubuntu/projects/btn-sip/contoh-rekap.csv';
  writeFileSync(keluar, buf);
  console.log('status:', res.status);
  console.log('berkas:', keluar, `(${buf.length} byte)`);
  console.log('');
  console.log('=== ISI ===');
  buf.toString('utf8').split('\r\n').forEach((l, i) => console.log(`${String(i).padStart(2)}| ${l}`));

  await prisma.sesi.deleteMany({ where: { pegawaiId: admin.id } });
}

main()
  .catch((e) => {
    console.error('GAGAL:', e.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
