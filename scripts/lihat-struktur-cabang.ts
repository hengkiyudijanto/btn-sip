import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

async function main() {
  console.log('=== STRUKTUR CABANG ===\n');
  const semua = await prisma.cabang.findMany({
    orderBy: { kode: 'asc' },
    include: { induk: { select: { kode: true, nama: true, jenis: true } } },
  });

  for (const c of semua) {
    console.log(
      `${c.kode.padEnd(10)} ${c.jenis.padEnd(7)} ${c.nama.padEnd(28)} ` +
        `induk=${c.induk ? `${c.induk.kode} (${c.induk.jenis})` : '—'} aktif=${c.aktif}`
    );
  }

  console.log('\n=== HIERARKI ===');
  const kanwil = semua.filter((c) => c.jenis === 'KANWIL');
  for (const k of kanwil) {
    console.log(`${k.kode} — ${k.nama}`);
    const kc = semua.filter((c) => c.indukId === k.id);
    for (const c of kc) {
      console.log(`  └ ${c.kode} — ${c.nama}`);
      const kcp = semua.filter((x) => x.indukId === c.id);
      for (const p of kcp) {
        console.log(`      └ ${p.kode} — ${p.nama}`);
      }
    }
  }
}

main()
  .catch((e) => {
    console.error('GAGAL:', e.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
