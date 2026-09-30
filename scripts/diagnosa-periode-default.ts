/**
 * Diagnosa: halaman /penilaian menampilkan periode mana sebagai default?
 * Jalankan: pnpm exec tsx scripts/diagnosa-periode-default.ts
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

async function main() {
  const hariIni = new Date();
  console.log('=== DIAGNOSA PERIODE DEFAULT ===\n');
  console.log(`Server sekarang: ${hariIni.toISOString()}`);
  console.log(`Tanggal lokal   : ${hariIni.toDateString()}\n`);

  // 1. Berapa periode total & rentangnya
  const semua = await prisma.periode.findMany({
    orderBy: { tanggalMulai: 'asc' },
    select: { id: true, nama: true, tanggalMulai: true, tanggalSelesai: true, aktif: true },
  });
  console.log(`Total periode di database: ${semua.length}`);
  if (semua.length > 0) {
    console.log(`  paling awal : ${semua[0].nama} (${semua[0].tanggalMulai.toDateString()})`);
    console.log(
      `  paling akhir: ${semua[semua.length - 1].nama} (${semua[semua.length - 1].tanggalMulai.toDateString()})\n`
    );
  }

  // 2. Periode yang memuat hari ini
  const t = new Date(hariIni.getFullYear(), hariIni.getMonth(), hariIni.getDate());
  const berjalan = await prisma.periode.findFirst({
    where: { tanggalMulai: { lte: t }, tanggalSelesai: { gte: t } },
  });
  console.log('Periode yang memuat HARI INI:');
  if (berjalan) {
    console.log(`  ${berjalan.nama}`);
    console.log(`  ${berjalan.tanggalMulai.toDateString()} – ${berjalan.tanggalSelesai.toDateString()}`);
    console.log(`  aktif: ${berjalan.aktif}`);
  } else {
    console.log('  (TIDAK ADA periode yang memuat hari ini)');
  }

  // 3. Periode aktif terdekat dari hari ini
  console.log('\n5 periode aktif terdekat dari hari ini:');
  const dekat = await prisma.periode.findMany({
    where: { aktif: true },
    orderBy: { tanggalMulai: 'asc' },
  });
  const urut = dekat
    .map((p) => ({ p, jarak: Math.abs(p.tanggalMulai.getTime() - t.getTime()) }))
    .sort((a, b) => a.jarak - b.jarak)
    .slice(0, 5);
  for (const { p, jarak } of urut) {
    const hari = Math.round(jarak / 86_400_000);
    console.log(`  ${p.nama.padEnd(34)} ${p.tanggalMulai.toDateString()}  (${hari} hari dari sekarang)`);
  }

  // 4. Bagaimana halaman /penilaian memilih default?
  console.log('\n=== APA YANG DILIHAT HALAMAN /penilaian ===');
  const jumlah = await prisma.periode.count();
  console.log(`periode.count() = ${jumlah}`);
  const prismaDefault = await prisma.periode.findFirst({
    orderBy: { tanggalMulai: 'desc' },
  });
  console.log(`findFirst(orderBy tanggalMulai DESC) = ${prismaDefault?.nama ?? '(kosong)'}`);
  console.log('  ← kalau halaman memakai ini, yang tampil adalah periode TERAKHIR,');
  console.log('    yaitu Desember 2027. Itu bug pemilihan default.');
}

main()
  .catch((e) => {
    console.error('GAGAL:', e.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
