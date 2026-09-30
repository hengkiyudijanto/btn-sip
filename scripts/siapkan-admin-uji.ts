import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

async function main() {
  const sebelum = await prisma.pegawai.findUnique({
    where: { nip: 'admin' },
    select: { nip: true, nama: true, role: true, aktif: true, harusGantiPassword: true },
  });
  console.log('SEBELUM:', JSON.stringify(sebelum, null, 1));

  const pw = await bcrypt.hash('AdminUji2026', 10);
  const sesudah = await prisma.pegawai.update({
    where: { nip: 'admin' },
    data: { harusGantiPassword: false, passwordHash: pw, aktif: true },
    select: { nip: true, role: true, aktif: true, harusGantiPassword: true },
  });
  console.log('SESUDAH:', JSON.stringify(sesudah, null, 1));
}

main()
  .catch((e) => {
    console.error('GAGAL:', e.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
