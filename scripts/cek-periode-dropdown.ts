import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

async function main() {
  const total = await prisma.periode.count();
  const terurut = await prisma.periode.findMany({
    orderBy: { tanggalMulai: 'asc' },
    select: { kode: true, nama: true, tanggalMulai: true, aktif: true },
  });
  console.log('total periode di DB:', total);
  if (terurut.length) {
    console.log('paling awal :', terurut[0].kode, terurut[0].nama,
      terurut[0].tanggalMulai.toISOString().slice(0, 10));
    console.log('paling akhir:', terurut[terurut.length - 1].kode,
      terurut[terurut.length - 1].nama,
      terurut[terurut.length - 1].tanggalMulai.toISOString().slice(0, 10));
  }
  // per tahun
  const perTahun = new Map<number, number>();
  for (const p of terurut) {
    const t = p.tanggalMulai.getFullYear();
    perTahun.set(t, (perTahun.get(t) ?? 0) + 1);
  }
  console.log('per tahun:', [...perTahun.entries()].map(([t, n]) => `${t}=${n}`).join('  '));
  console.log('aktif (dikunci/buka):', terurut.filter((p) => p.aktif).length);
}
main().catch((e) => { console.error('GAGAL:', e.message); process.exit(1); })
  .finally(() => prisma.$disconnect());
