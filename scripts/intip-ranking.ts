import 'dotenv/config';
import crypto from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });
const h = (t: string) => crypto.createHash('sha256').update(t).digest('hex');
async function main() {
  const per = await prisma.periode.findFirst({ where: { kode: 'RANK-W1' } });
  if (!per) { console.log('periode uji tidak ada'); return; }
  const spv = await prisma.pegawai.findFirst({ where: { nip: 'RANKSPV1' } });
  if (!spv) { console.log('akun uji tidak ada'); return; }
  const token = crypto.randomBytes(32).toString('base64url');
  await prisma.sesi.create({ data: { tokenHash: h(token), pegawaiId: spv.id, expiresAt: new Date(Date.now()+600000) } });
  const r = await fetch(`http://localhost:3100/laporan/ranking?periode=${per.id}`, { headers: { cookie: `sip_sesi=${token}` } });
  const html = await r.text();
  const i = html.indexOf('petugas</strong>');
  console.log('--- sekitar "petugas" ---');
  console.log(i > 0 ? html.slice(Math.max(0, i-260), i+120).replace(/\s+/g, ' ') : '(tidak ketemu)');
  await prisma.sesi.deleteMany({ where: { pegawaiId: spv.id } });
  await prisma.periode.deleteMany({ where: { kode: 'RANK-W1' } });
}
main().finally(() => prisma.$disconnect());
