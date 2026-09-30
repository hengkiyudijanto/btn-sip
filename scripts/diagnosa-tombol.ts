import 'dotenv/config';
import crypto from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});
const h = (t: string) => crypto.createHash('sha256').update(t).digest('hex');

async function main() {
  const cabang = await prisma.cabang.findFirst({ where: { aktif: true } });
  const hash = await bcrypt.hash('Lihat1234', 10);
  const nipS = 'DIAG001';
  const nipP = 'DIAG002';
  const kodeW = 'DIAG-W1';

  await prisma.penilaianDetail.deleteMany({
    where: { penilaian: { pegawai: { nip: { in: [nipP, nipS] } } } },
  });
  await prisma.penilaian.deleteMany({ where: { pegawai: { nip: { in: [nipP, nipS] } } } });
  await prisma.pegawai.deleteMany({ where: { nip: { in: [nipP, nipS] } } });
  await prisma.periode.deleteMany({ where: { kode: kodeW } });

  const spv = await prisma.pegawai.create({
    data: { nip: nipS, nama: 'SPV Diag', passwordHash: hash, role: 'SUPERVISOR',
      harusGantiPassword: false, aktif: true, cabangId: cabang!.id },
  });
  const pet = await prisma.pegawai.create({
    data: { nip: nipP, nama: 'Petugas Diag', passwordHash: hash, role: 'PEGAWAI',
      harusGantiPassword: false, aktif: true, cabangId: cabang!.id, atasanId: spv.id },
  });
  const per = await prisma.periode.create({
    data: { kode: kodeW, nama: 'Uji Diag', tanggalMulai: new Date(2038, 4, 1),
      tanggalSelesai: new Date(2038, 4, 7), aktif: true },
  });

  const token = crypto.randomBytes(32).toString('base64url');
  await prisma.sesi.create({
    data: { tokenHash: h(token), pegawaiId: spv.id, expiresAt: new Date(Date.now() + 600000) },
  });

  const url = `http://localhost:3100/penilaian/${pet.id}?periode=${per.id}`;
  const res = await fetch(url, { headers: { cookie: 'sip_sesi=' + token } });
  const html = await res.text();

  console.log('=== TOMBOL PADA HALAMAN TANPA FOTO ===');
  const t1 = html.match(/<button[^>]*>[\s\S]{0,60}?<\/button>/g) ?? [];
  for (const b of t1) {
    const b2 = b.replace(/\s+/g, ' ');
    console.log(`  disabled=${String(/disabled/.test(b2)).padEnd(5)} "${b2.replace(/<[^>]*>/g,'').trim().slice(0,30)}"`);
  }

  // pasang foto lalu buka lagi
  await prisma.penilaian.update({
    where: { pegawaiId_periodeId: { pegawaiId: pet.id, periodeId: per.id } },
    data: {
      fotoData: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==',
      fotoMime: 'image/jpeg', fotoUkuran: 160,
    },
  });

  const res2 = await fetch(url, { headers: { cookie: 'sip_sesi=' + token } });
  const html2 = await res2.text();

  console.log('\n=== TOMBOL SETELAH FOTO ADA ===');
  const t2 = html2.match(/<button[^>]*>[\s\S]{0,60}?<\/button>/g) ?? [];
  for (const b of t2) {
    const b2 = b.replace(/\s+/g, ' ');
    console.log(`  disabled=${String(/disabled/.test(b2)).padEnd(5)} "${b2.replace(/<[^>]*>/g,'').trim().slice(0,30)}"`);
  }

  await prisma.penilaianDetail.deleteMany({ where: { penilaian: { pegawaiId: pet.id } } });
  await prisma.penilaian.deleteMany({ where: { pegawaiId: pet.id } });
  await prisma.sesi.deleteMany({ where: { pegawaiId: spv.id } });
  await prisma.pegawai.deleteMany({ where: { nip: { in: [nipP, nipS] } } });
  await prisma.periode.deleteMany({ where: { kode: kodeW } });
}

main()
  .catch((e) => {
    console.error('GAGAL:', e.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
