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
  const admin = await prisma.pegawai.findUnique({ where: { nip: 'admin' } });
  if (!admin) throw new Error('admin tidak ada');
  const token = crypto.randomBytes(32).toString('base64url');
  await prisma.sesi.create({
    data: {
      tokenHash: h(token),
      pegawaiId: admin.id,
      expiresAt: new Date(Date.now() + 600000),
    },
  });

  for (const p of ['/penilaian', '/dasbor', '/persetujuan']) {
    const r = await fetch(BASE + p, {
      headers: { cookie: 'sip_sesi=' + token, 'cache-control': 'no-cache' },
      redirect: 'manual',
    });
    const html = r.status === 200 ? await r.text() : '';
    const m = html.match(/Minggu ke-\d+ \w+ \d{4}/g) ?? [];
    console.log(
      `${p}  status=${r.status}  periode: ${[...new Set(m)].join(' | ') || '(tidak ada)'}`
    );
    if (html.includes('Desember 2027')) console.log('   ⚠ masih ada Desember 2027');
  }

  await prisma.sesi.deleteMany({ where: { pegawaiId: admin.id } });
}

main()
  .catch((e) => {
    console.error('GAGAL:', e.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
