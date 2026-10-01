/**
 * Bandingkan apa yang ditampilkan dropdown halaman vs apa yang ditampilkan
 * halaman /periode, supaya ketahuan sumber perbedaannya.
 *
 * Jalankan: pnpm exec tsx scripts/banding-periode-dropdown.ts
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

async function main() {
  console.log('=== 1. Semua periode di DB menurut tahun ===');
  const semua = await prisma.periode.findMany({ orderBy: { tanggalMulai: 'asc' } });
  const perTahun = new Map<number, number>();
  for (const p of semua) {
    const t = p.tanggalMulai.getFullYear();
    perTahun.set(t, (perTahun.get(t) ?? 0) + 1);
  }
  console.log('  ', [...perTahun.entries()].map(([t, n]) => `${t}: ${n}`).join('  |  '));

  console.log('\n=== 2. Yang aktif saja (dipakai dropdown) ===');
  const aktif = await prisma.periode.findMany({
    where: { aktif: true }, orderBy: { tanggalMulai: 'asc' },
  });
  console.log('    jumlah aktif:', aktif.length);
  const aktifTahun = new Map<number, number>();
  for (const p of aktif) {
    const t = p.tanggalMulai.getFullYear();
    aktifTahun.set(t, (aktifTahun.get(t) ?? 0) + 1);
  }
  console.log('  ', [...aktifTahun.entries()].map(([t, n]) => `${t}: ${n}`).join('  |  '));

  console.log('\n=== 3. Yang TIDAK aktif ===');
  const nonAktif = semua.filter((p) => !p.aktif);
  console.log('    jumlah non-aktif:', nonAktif.length);
  for (const p of nonAktif.slice(0, 10)) {
    console.log(`    ${p.kode}  ${p.nama}  ${p.tanggalMulai.toISOString().slice(0, 10)}`);
  }
  if (nonAktif.length > 10) console.log(`    ... dan ${nonAktif.length - 10} lagi`);

  console.log('\n=== 4. Periode di 2027 (yang dikeluhkan muncul di dropdown) ===');
  const p2027 = semua.filter((p) => p.tanggalMulai.getFullYear() === 2027);
  console.log('    jumlah:', p2027.length);
  console.log('    contoh 5 pertama:');
  for (const p of p2027.slice(0, 5)) {
    console.log(`      ${p.kode}  ${p.nama}  aktif=${p.aktif}`);
  }
}

main()
  .catch((e) => { console.error('GAGAL:', e.message); process.exit(1); })
  .finally(() => prisma.$disconnect());
