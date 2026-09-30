/**
 * Bersihkan periode lama (penamaan ISO: "Minggu ke-35", "2026-W35") yang
 * dibuat sebelum aturan periode resmi dipakai, lalu buat periode baru
 * sesuai aturan (Minggu ke-N <Bulan> <Tahun>).
 *
 * AMAN: hanya menghapus periode yang TIDAK punya penilaian.
 * Kalau ada periode lama yang sudah punya penilaian, skrip berhenti dan
 * melaporkannya supaya tidak ada data hilang.
 *
 * Jalankan:
 *   pnpm exec tsx scripts/bersihkan-periode-lama.ts          # lihat saja (dry-run)
 *   pnpm exec tsx scripts/bersihkan-periode-lama.ts --hapus  # benar-benar hapus
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { periodeTahun } from '../src/lib/sip/periode';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

const hapus = process.argv.includes('--hapus');

async function main() {
  console.log('=== PERIODE LAMA vs ATURAN BARU ===\n');

  const png = await prisma.pengaturan.findUnique({ where: { id: 'utama' } });
  const hariPenilaian = png?.hariPenilaian ?? 3;
  console.log(`Hari penilaian: ${hariPenilaian} (${hariPenilaian === 3 ? 'Rabu' : '?'})`);
  console.log(`Mode: ${hapus ? 'HAPUS' : 'lihat saja (dry-run)'}\n`);

  const lama = await prisma.periode.findMany({
    orderBy: { tanggalMulai: 'asc' },
    include: { _count: { select: { penilaian: true } } },
  });

  if (lama.length === 0) {
    console.log('Tidak ada periode di database.');
  } else {
    console.log(`Periode lama di database: ${lama.length}`);
    for (const p of lama) {
      const dipakai = p._count.penilaian;
      console.log(
        `  ${p.kode.padEnd(12)} ${p.nama.padEnd(42)} ` +
          `penilaian=${dipakai}${dipakai > 0 ? '  ⚠ ADA DATA' : ''}`
      );
    }
  }

  // ===== cek apakah ada periode lama yang punya penilaian =====
  const terpakai = lama.filter((p) => p._count.penilaian > 0);
  if (terpakai.length > 0) {
    console.log('\n⚠ PERHATIAN: periode berikut sudah punya penilaian, TIDAK akan dihapus:');
    for (const p of terpakai) {
      console.log(`   ${p.kode} — ${p.nama} (${p._count.penilaian} penilaian)`);
    }
  }

  // ===== periode baru menurut aturan =====
  const tahunSekarang = new Date().getFullYear();
  const tahunDaftar = [tahunSekarang - 1, tahunSekarang, tahunSekarang + 1];
  console.log(`\nPeriode baru akan dibuat untuk tahun: ${tahunDaftar.join(', ')}`);

  let totalBaru = 0;
  for (const th of tahunDaftar) {
    const daftar = periodeTahun(th, hariPenilaian);
    totalBaru += daftar.length;
    console.log(`  ${th}: ${daftar.length} periode`);
  }
  console.log(`  total: ${totalBaru} periode`);

  if (!hapus) {
    console.log('\n(dry-run — tidak ada yang diubah. Tambahkan --hapus untuk menjalankan.)');
    return;
  }

  // ===== hapus periode lama yang kosong =====
  const akanDihapus = lama.filter((p) => p._count.penilaian === 0);
  if (akanDihapus.length > 0) {
    const hasil = await prisma.periode.deleteMany({
      where: { id: { in: akanDihapus.map((p) => p.id) } },
    });
    console.log(`\n✓ ${hasil.count} periode lama dihapus`);
  }

  // ===== buat periode baru =====
  let dibuat = 0;
  let dilewati = 0;
  for (const th of tahunDaftar) {
    for (const p of periodeTahun(th, hariPenilaian)) {
      const ada = await prisma.periode.findFirst({
        where: { tanggalMulai: p.mulai, tanggalSelesai: p.selesai },
        select: { id: true },
      });
      if (ada) {
        dilewati++;
        continue;
      }
      await prisma.periode.create({
        data: {
          kode: p.kode,
          nama: p.nama,
          tanggalMulai: p.mulai,
          tanggalSelesai: p.selesai,
          aktif: true,
        },
      });
      dibuat++;
    }
  }
  console.log(`✓ ${dibuat} periode baru dibuat, ${dilewati} dilewati (sudah ada)`);

  await prisma.pengaturan.update({
    where: { id: 'utama' },
    data: { periodeTerbuatSampaiTahun: tahunSekarang + 1 },
  });

  const totalAkhir = await prisma.periode.count();
  console.log(`\nTotal periode di database sekarang: ${totalAkhir}`);
}

main()
  .catch((e) => {
    console.error('\n❌ GAGAL:', e.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
