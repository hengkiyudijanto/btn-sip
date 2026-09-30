import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

async function main() {
  const t = await prisma.periode.findMany({
    where: { kode: { in: ['FOTOP-W1', 'FOTOP-W2'] } },
    select: { id: true, kode: true, nama: true, tanggalMulai: true, tanggalSelesai: true },
  });
  console.log('periode uji yang ada:', t.length);
  for (const p of t) {
    console.log(`  ${p.kode} ${p.nama} ${p.tanggalMulai.toDateString()} – ${p.tanggalSelesai.toDateString()}`);
  }

  // cari periode lain yang tanggalnya bentrok dengan 5-11 Jan dan 12-18 Jan
  const th = new Date().getFullYear();
  const bentrok = await prisma.periode.findMany({
    where: {
      OR: [
        { tanggalMulai: new Date(th, 0, 5), tanggalSelesai: new Date(th, 0, 11) },
        { tanggalMulai: new Date(th, 0, 12), tanggalSelesai: new Date(th, 0, 18) },
      ],
    },
    select: { id: true, kode: true, nama: true },
  });
  console.log('\nperiode yang bentrok tanggal:', bentrok.length);
  for (const p of bentrok) console.log(`  ${p.kode} — ${p.nama}`);
}

main()
  .catch((e) => {
    console.error('GAGAL:', e.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
