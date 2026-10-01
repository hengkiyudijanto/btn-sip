import 'dotenv/config';
import crypto from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });
const h = (t: string) => crypto.createHash('sha256').update(t).digest('hex');
async function main() {
  const admin = await prisma.pegawai.findUnique({ where: { nip: 'admin' } });
  if (!admin) throw new Error('admin tidak ada');
  const token = crypto.randomBytes(32).toString('base64url');
  await prisma.sesi.create({ data: { tokenHash: h(token), pegawaiId: admin.id, expiresAt: new Date(Date.now()+600000) } });
  const periodeId = process.argv[2];
  const res = await fetch(`http://localhost:3100/laporan/ranking/pptx?periode=${periodeId}`, { headers: { cookie: `sip_sesi=${token}` } });
  console.log('status:', res.status);
  if (res.status !== 200) { console.log(await res.text()); return; }
  const buf = Buffer.from(await res.arrayBuffer());
  writeFileSync('ranking-nyata.pptx', buf);
  console.log(`tersimpan: ranking-nyata.pptx (${(buf.length/1024).toFixed(0)} KB)`);
  await prisma.sesi.deleteMany({ where: { pegawaiId: admin.id } });
}
main().finally(() => prisma.$disconnect());
