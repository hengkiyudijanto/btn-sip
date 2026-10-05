import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

async function main() {
  const k = await prisma.kontenSosmed.findMany({
    select: {
      id: true,
      judul: true,
      status: true,
      mediaByte: true,
      pembuatId: true,
      penyetujuId: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
    take: 5,
  });
  console.log('konten:', JSON.stringify(k, null, 1));

  const s = await prisma.sesi.findMany({
    select: { id: true, pegawaiId: true, revokedAt: true, expiresAt: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
    take: 3,
  });
  console.log('sesi terbaru:', JSON.stringify(s, null, 1));
}

main().finally(() => prisma.$disconnect());
