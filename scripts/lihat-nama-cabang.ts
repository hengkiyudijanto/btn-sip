/** Melihat nama cabang di database — untuk memeriksa apakah namanya
 *  sudah menyertakan kode cabang atau belum. */

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

async function main() {
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  });
  const cabang = await prisma.cabang.findMany({
    select: { kode: true, nama: true },
    take: 10,
    orderBy: { kode: 'asc' },
  });
  for (const c of cabang) {
    console.log(`  kode="${c.kode}"  nama="${c.nama}"`);
  }
  console.log(`\n  total: ${await prisma.cabang.count()} cabang`);
  await prisma.$disconnect();
}

main();
