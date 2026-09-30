import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

async function main() {
  const kolom = await prisma.$queryRaw<{ column_name: string; data_type: string }[]>`
    SELECT column_name, data_type
    FROM information_schema.columns
    WHERE table_name = 'Penilaian' AND column_name LIKE 'foto%'
    ORDER BY column_name
  `;
  console.log('=== KOLOM FOTO DI TABEL Penilaian ===');
  if (kolom.length === 0) {
    console.log('  (BELUM ADA — migrasi belum jalan)');
  }
  for (const c of kolom) {
    console.log(`  ${c.column_name.padEnd(16)} ${c.data_type}`);
  }
}

main()
  .catch((e) => {
    console.error('GAGAL:', e.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
