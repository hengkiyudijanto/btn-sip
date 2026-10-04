/**
 * Hapus penilaian DRAFT yang KOSONG (tanpa satu pun aspek terisi dan tanpa
 * nilai akhir). Baris seperti ini muncul otomatis saat halaman
 * /penilaian/<pegawai> dibuka — termasuk saat pengujian — dan bukan
 * penilaian sungguhan.
 *
 * Pengaman: hanya menghapus yang detail.length === 0 DAN nilaiAkhir === null.
 * DRAFT yang sudah ada isinya TIDAK disentuh (itu pekerjaan orang).
 *
 *   pnpm exec tsx scripts/bersih-draft-kosong.ts            # pratinjau
 *   pnpm exec tsx scripts/bersih-draft-kosong.ts --jalankan # hapus
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const JALANKAN = process.argv.includes('--jalankan');
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

async function main() {
  const semua = await prisma.penilaian.findMany({
    include: {
      detail: true,
      pegawai: { select: { nip: true, nama: true } },
      periode: { select: { kode: true, nama: true } },
    },
    orderBy: { createdAt: 'asc' },
  });

  const kosong = semua.filter((p) => p.detail.length === 0 && p.nilaiAkhir === null);
  const berisi = semua.filter((p) => !(p.detail.length === 0 && p.nilaiAkhir === null));

  console.log(`total penilaian: ${semua.length}`);
  console.log(`  ada isinya   : ${berisi.length}  <-- TIDAK disentuh`);
  console.log(`  kosong       : ${kosong.length}  <-- akan dihapus`);
  console.log('');
  for (const p of kosong) {
    console.log(
      `  ${p.pegawai.nip.padEnd(12)} ${p.pegawai.nama.padEnd(20)} ${p.periode.nama.padEnd(26)} status=${p.status} dibuat=${p.createdAt.toISOString().slice(0, 16)}`
    );
  }

  if (!JALANKAN) {
    console.log('\n(pratinjau — tambahkan --jalankan untuk menghapus)');
    return;
  }

  const hapus = await prisma.penilaian.deleteMany({ where: { id: { in: kosong.map((p) => p.id) } } });
  console.log(`\nterhapus: ${hapus.count}`);
  console.log('total penilaian sekarang:', await prisma.penilaian.count());

  // pastikan yang berisi tetap utuh
  const masihAda = await prisma.penilaian.count({ where: { id: { in: berisi.map((p) => p.id) } } });
  console.log(`penilaian berisi yang masih ada: ${masihAda} (harus ${berisi.length})`);
}

main()
  .catch((e) => {
    console.error('GAGAL:', e instanceof Error ? e.message : e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
