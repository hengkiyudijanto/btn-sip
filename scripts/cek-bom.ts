import 'dotenv/config';
import crypto from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import bcrypt from 'bcryptjs';

const BASE = 'http://localhost:3100';
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});
const h = (t: string) => crypto.createHash('sha256').update(t).digest('hex');

async function main() {
  const cabang = await prisma.cabang.findFirst({ where: { aktif: true } });
  const hash = await bcrypt.hash('X1234567', 10);

  await prisma.penilaianDetail.deleteMany({ where: { penilaian: { pegawai: { nip: 'BOMTEST01' } } } });
  await prisma.penilaian.deleteMany({ where: { pegawai: { nip: 'BOMTEST01' } } });
  await prisma.pegawai.deleteMany({ where: { nip: 'BOMTEST01' } });

  const peg = await prisma.pegawai.create({
    data: {
      nip: 'BOMTEST01', nama: 'BOM Test', passwordHash: hash, role: 'PEGAWAI',
      harusGantiPassword: false, aktif: true, cabangId: cabang!.id,
    },
  });
  const spv = await prisma.pegawai.findFirst({ where: { role: { in: ['SUPERVISOR', 'ADMIN'] } } });
  const periode = await prisma.periode.findFirst({ orderBy: { tanggalMulai: 'desc' } });

  await prisma.penilaian.create({
    data: {
      pegawaiId: peg.id, penilaiId: spv!.id, periodeId: periode!.id, status: 'DRAFT',
      nilaiAkhir: 4.0, rating: 'Baik',
      detail: { create: [{ kodeAspek: 'A1', nilaiMentah: 90, skor: 3, bobotAspek: 0.4 }] },
    },
  });

  const token = crypto.randomBytes(32).toString('base64url');
  await prisma.sesi.create({
    data: { tokenHash: h(token), pegawaiId: spv!.id, expiresAt: new Date(Date.now() + 600000) },
  });

  const res = await fetch(`${BASE}/laporan/ekspor?periode=${periode!.id}`, {
    headers: { cookie: 'sip_sesi=' + token },
  });
  const buf = Buffer.from(await res.arrayBuffer());

  console.log('=== 4 BYTE PERTAMA BERKAS ===');
  console.log([...buf.subarray(0, 4)].map((b) => b.toString(16).padStart(2, '0')).join(' '));
  console.log('diharapkan: ef bb bf (BOM UTF-8) lalu 52 (huruf R)');
  console.log('');
  console.log('byte[0] =', buf[0], '(0xef =', 0xef, ')');
  console.log('byte[1] =', buf[1], '(0xbb =', 0xbb, ')');
  console.log('byte[2] =', buf[2], '(0xbf =', 0xbf, ')');
  console.log('');

  const teks = buf.toString('utf8');
  console.log('teks.charCodeAt(0) =', teks.charCodeAt(0), '(0xfeff =', 0xfeff, ')');
  console.log('teks mulai dengan:', JSON.stringify(teks.slice(0, 40)));
  console.log('');

  await prisma.penilaianDetail.deleteMany({ where: { penilaian: { pegawaiId: peg.id } } });
  await prisma.penilaian.deleteMany({ where: { pegawaiId: peg.id } });
  await prisma.sesi.deleteMany({ where: { pegawaiId: spv!.id } });
  await prisma.pegawai.delete({ where: { id: peg.id } });
}

main()
  .catch((e) => {
    console.error('GAGAL:', e.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
