import 'dotenv/config';
import crypto from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});
const h = (t: string) => crypto.createHash('sha256').update(t).digest('hex');

async function main() {
  const admin = await prisma.pegawai.findUnique({ where: { nip: 'admin' } });
  if (!admin) throw new Error('admin tidak ada');
  const t = crypto.randomBytes(32).toString('base64url');
  await prisma.sesi.create({
    data: { tokenHash: h(t), pegawaiId: admin.id, expiresAt: new Date(Date.now() + 600000) },
  });
  const r = await fetch('http://localhost:3100/penilaian', {
    headers: { cookie: 'sip_sesi=' + t },
    redirect: 'manual',
  });
  const html = await r.text();
  const m = html.match(/<a[^>]*href="\/penilaian\/[^"]*"[\s\S]{0,150}?<\/a>/g) ?? [];
  console.log('jumlah tautan penilaian:', m.length);
  for (const x of m.slice(0, 3)) {
    console.log('---\n' + x.replace(/\s+/g, ' ').slice(0, 320));
  }
  await prisma.sesi.deleteMany({ where: { pegawaiId: admin.id } });
}

main()
  .catch((e) => {
    console.error('GAGAL:', e.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
