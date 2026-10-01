import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });
async function main() {
  const p = await prisma.periode.findFirst({ where: { nama: { contains: 'September 2026' } }, orderBy: { tanggalMulai: 'desc' } });
  console.log(p?.id ?? 'tidak ada');
}
main().finally(() => prisma.$disconnect());
