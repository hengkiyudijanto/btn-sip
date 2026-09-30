import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

async function main() {
  const total = await prisma.periode.count();
  console.log('total periode di database:', total);

  const contoh = await prisma.periode.findMany({
    orderBy: { tanggalMulai: 'asc' },
    select: { nama: true, kode: true, tanggalMulai: true, tanggalSelesai: true },
    take: 5,
  });
  console.log('\n5 periode pertama:');
  for (const p of contoh) {
    console.log(`  ${p.kode}  ${p.nama}`);
  }

  const png = await prisma.pengaturan.findUnique({ where: { id: 'utama' } });
  console.log('\nhari penilaian:', png ? png.hariPenilaian : '(belum ada baris)');
  console.log('periode terbuat sampai tahun:', png?.periodeTerbuatSampaiTahun ?? '(belum)');
}

main()
  .catch((e) => {
    console.error('GAGAL:', e.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
