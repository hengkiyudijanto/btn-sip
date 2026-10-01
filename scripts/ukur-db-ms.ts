/**
 * Pisahkan biaya: berapa lama DATABASE vs berapa lama SISANYA.
 *
 * Kalau satu query sederhana ke Neon saja sudah ratusan ms, kelambatan
 * utamanya ada di jaringan server-Vercel ↔ Neon, bukan di kode.
 *
 * Jalankan: pnpm exec tsx scripts/ukur-db-ms.ts
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

async function ukur(label: string, fn: () => Promise<unknown>, ulang = 5) {
  const waktu: number[] = [];
  for (let i = 0; i < ulang; i++) {
    const m = performance.now();
    await fn();
    waktu.push(performance.now() - m);
  }
  const rata = waktu.reduce((a, b) => a + b, 0) / waktu.length;
  console.log(
    `  ${label.padEnd(34)} rata ${rata.toFixed(0).padStart(5)} ms   ` +
      `(${waktu.map((x) => x.toFixed(0)).join(' / ')} ms)`
  );
  return rata;
}

async function main() {
  console.log('=== BIAYA DATABASE (dari server ini) ===\n');

  console.log('Kueri sederhana:');
  const q1 = await ukur('SELECT 1', () => prisma.$queryRaw`SELECT 1`);
  const q2 = await ukur('COUNT pegawai', () => prisma.pegawai.count());
  const q3 = await ukur('COUNT periode', () => prisma.periode.count());

  console.log('\nKueri seperti yang dipakai halaman (berat):');
  const q4 = await ukur('periode.findMany semua (148 baris)', () =>
    prisma.periode.findMany({ orderBy: { tanggalMulai: 'desc' } })
  );
  const q5 = await ukur('penilaian + relasi (seperti dasbor)', () =>
    prisma.penilaian.findMany({
      take: 50,
      include: { pegawai: { include: { cabang: true, jabatan: true } }, periode: true },
      orderBy: { createdAt: 'desc' },
    })
  );

  const rataSederhana = (q1 + q2 + q3) / 3;

  console.log('\n=== KESIMPULAN ===');
  console.log(`  satu kueri sederhana : ${rataSederhana.toFixed(0)} ms`);
  console.log(`  kueri berat          : ${((q4 + q5) / 2).toFixed(0)} ms`);
  console.log('');
  if (rataSederhana > 150) {
    console.log('  → Biaya per kueri SUDAH TINGGI. Ini bukan soal banyaknya kueri,');
    console.log('    tapi jarak/kecepatan sambungan ke database (latensi per kueri).');
  } else {
    console.log('  → Biaya per kueri wajar. Kelambatan halaman lebih banyak dari');
    console.log('    JUMLAH kueri per halaman atau cold start fungsi serverless.');
  }

  // jumlah kueri: aktifkan log sebentar
  console.log('\n=== JUMLAH KUERI SAAT MEMUAT /dasbor ===');
  let n = 0;
  const terhitung = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
    log: [{ emit: 'event', level: 'query' }],
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (terhitung as any).$on('query', () => { n++; });
  await terhitung.penilaian.findMany({
    take: 20,
    include: { pegawai: { include: { cabang: true, jabatan: true } }, periode: true },
  });
  await new Promise((r) => setTimeout(r, 300));
  console.log(`  kueri terhitung (perkiraan pola dasbor): ${n}`);
  await terhitung.$disconnect();
}

main()
  .catch((e) => { console.error('GAGAL:', e.message); process.exit(1); })
  .finally(() => prisma.$disconnect());
