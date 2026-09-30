import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

async function main() {
  const hariIni = new Date();
  console.log(`=== PERIODE SEKITAR SEKARANG (${hariIni.toDateString()}) ===\n`);

  const dekat = await prisma.periode.findMany({
    where: {
      tanggalMulai: {
        gte: new Date(hariIni.getFullYear(), hariIni.getMonth() - 1, 1),
        lte: new Date(hariIni.getFullYear(), hariIni.getMonth() + 2, 28),
      },
    },
    orderBy: { tanggalMulai: 'asc' },
    include: { _count: { select: { penilaian: true } } },
  });

  for (const p of dekat) {
    const mulai = p.tanggalMulai.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
    const selesai = p.tanggalSelesai.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
    const berjalan = hariIni >= p.tanggalMulai && hariIni <= p.tanggalSelesai;
    const lewat = hariIni > p.tanggalSelesai;
    console.log(
      `${berjalan ? '→' : ' '} ${p.nama.padEnd(32)} ${mulai.padStart(8)} – ${selesai.padEnd(8)} ` +
        `${p.aktif ? 'aktif' : 'NONAKTIF'} ${p.dikunci ? 'TERKUNCI' : ''} ` +
        `penilaian=${p._count.penilaian} ${lewat ? '(sudah lewat)' : ''}`
    );
  }

  console.log('\n=== CEK: apakah ada periode DIKUNCI? ===');
  const terkunci = await prisma.periode.count({ where: { dikunci: true } });
  console.log(`periode terkunci: ${terkunci}`);

  console.log('\n=== CEK: penilaian yang sudah ada ===');
  const penilaian = await prisma.penilaian.findMany({
    include: {
      pegawai: { select: { nama: true, nip: true } },
      periode: { select: { nama: true, dikunci: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 10,
  });
  if (penilaian.length === 0) {
    console.log('  (belum ada penilaian sama sekali)');
  } else {
    console.log(`  total: ${await prisma.penilaian.count()}`);
    for (const p of penilaian) {
      console.log(
        `  ${p.periode.nama.padEnd(30)} ${p.pegawai.nama.padEnd(20)} status=${p.status} ` +
          `${p.periode.dikunci ? 'PERIODE TERKUNCI' : ''}`
      );
    }
  }
}

main()
  .catch((e) => {
    console.error('GAGAL:', e.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
