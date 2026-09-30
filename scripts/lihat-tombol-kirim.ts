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
  const nipS = 'LIHAT001';
  const nipP = 'LIHAT002';
  const kodeW = 'LIHAT-W1';

  await prisma.penilaianDetail.deleteMany({
    where: { penilaian: { pegawai: { nip: { in: [nipP, nipS] } } } },
  });
  await prisma.penilaian.deleteMany({ where: { pegawai: { nip: { in: [nipP, nipS] } } } });
  await prisma.pegawai.deleteMany({ where: { nip: { in: [nipP, nipS] } } });
  await prisma.periode.deleteMany({ where: { kode: kodeW } });

  const spv = await prisma.pegawai.create({
    data: { nip: nipS, nama: 'SPV Lihat', passwordHash: hash, role: 'SUPERVISOR',
      harusGantiPassword: false, aktif: true, cabangId: cabang!.id },
  });
  const pet = await prisma.pegawai.create({
    data: { nip: nipP, nama: 'Petugas Lihat', passwordHash: hash, role: 'PEGAWAI',
      harusGantiPassword: false, aktif: true, cabangId: cabang!.id, atasanId: spv.id },
  });
  const per = await prisma.periode.create({
    data: { kode: kodeW, nama: 'Uji Lihat', tanggalMulai: new Date(2037, 3, 1),
      tanggalSelesai: new Date(2037, 3, 7), aktif: true },
  });

  const token = crypto.randomBytes(32).toString('base64url');
  await prisma.sesi.create({
    data: { tokenHash: h(token), pegawaiId: spv.id, expiresAt: new Date(Date.now() + 600000) },
  });

  // buka halaman -> baris dibuat otomatis
  await fetch(`http://localhost:3100/penilaian/${pet.id}?periode=${per.id}`, {
    headers: { cookie: 'sip_sesi=' + token },
  });

  // pasang foto
  await prisma.penilaian.update({
    where: { pegawaiId_periodeId: { pegawaiId: pet.id, periodeId: per.id } },
    data: {
      fotoData: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==',
      fotoMime: 'image/jpeg', fotoUkuran: 160,
    },
  });

  const res = await fetch(`http://localhost:3100/penilaian/${pet.id}?periode=${per.id}`, {
    headers: { cookie: 'sip_sesi=' + token },
  });
  const html = await res.text();

  console.log('=== SEMUA TOMBOL DI HALAMAN ===');
  const tombol = html.match(/<button[^>]*>[\s\S]{0,80}?<\/button>/g) ?? [];
  console.log(`jumlah tombol: ${tombol.length}`);
  for (const t of tombol) {
    const bersih = t.replace(/\s+/g, ' ');
    const teks = bersih.replace(/<[^>]*>/g, '').trim().slice(0, 40);
    const disabled = /disabled/.test(bersih);
    console.log(`  disabled=${String(disabled).padEnd(5)} teks="${teks}"`);
  }

  console.log('\n=== JEJAK ADAFOTO ===');
  console.log('html memuat "belum ada"?         ', html.includes('belum ada'));
  console.log('html memuat "foto penilaian belum"', html.includes('foto penilaian belum'));

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
