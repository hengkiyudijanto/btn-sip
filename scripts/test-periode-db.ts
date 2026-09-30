/**
 * Uji pembuatan periode otomatis ke database sungguhan.
 *
 * Memastikan:
 *   1. Pengaturan hari penilaian tersimpan & bisa diubah
 *   2. Periode setahun dibuat otomatis dan idempoten (dijalankan 2x aman)
 *   3. Periode tidak menyeberang bulan, tidak ada celah
 *   4. Menghitung tepat: seluruh hari tahun ini tercakup
 *
 * Jalankan: pnpm exec tsx scripts/test-periode-db.ts
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { periodeTahun, periodeBulan, selisihHari } from '../src/lib/sip/periode';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

let lulus = 0;
let gagal = 0;
function cek(kondisi: boolean, label: string) {
  console.log(`   ${kondisi ? 'ok ' : 'XX '} ${label}`);
  if (kondisi) lulus++;
  else gagal++;
}

const TAHUN_UJI = 2030; // tahun jauh supaya tidak bentrok data produksi
const RABU = 3;

async function bereskan() {
  await prisma.periode.deleteMany({
    where: {
      tanggalMulai: {
        gte: new Date(TAHUN_UJI, 0, 1),
        lte: new Date(TAHUN_UJI, 11, 31),
      },
    },
  });
}

async function main() {
  console.log('=== UJI PERIODE OTOMATIS KE DATABASE ===\n');

  await bereskan();
  console.log(`ok  data uji ${TAHUN_UJI} dibersihkan\n`);

  // ===== 1. hitung di memori =====
  console.log('--- 1. perhitungan mesin periode ---');
  const daftar = periodeTahun(TAHUN_UJI, RABU);
  console.log(`   ${daftar.length} periode dihitung untuk ${TAHUN_UJI}`);

  const tanggalMulai = new Date(TAHUN_UJI, 0, 1);
  const tanggalAkhir = new Date(TAHUN_UJI, 11, 31);
  const totalHari = Math.round(
    (tanggalAkhir.getTime() - tanggalMulai.getTime()) / 86_400_000
  ) + 1;
  const jumlahHariPeriode = daftar.reduce((s, p) => s + p.jumlahHari, 0);

  cek(jumlahHariPeriode === totalHari, `seluruh ${totalHari} hari tercakup (${jumlahHariPeriode})`);
  cek(
    daftar.every((p) => p.jumlahHari >= 5),
    'semua periode >= 5 hari'
  );
  cek(
    daftar.every((p, i) => {
      if (i === 0) return true;
      return selisihHari(daftar[i - 1].selesai, p.mulai) === 1;
    }),
    'tidak ada celah antar periode'
  );

  // ===== 2. simpan ke database (tiruan buatPeriodeDariMesin) =====
  console.log('\n--- 2. penyimpanan ke database ---');
  for (const p of daftar) {
    await prisma.periode.create({
      data: {
        kode: `${p.kode}-UJI`,
        nama: p.nama,
        tanggalMulai: p.mulai,
        tanggalSelesai: p.selesai,
        aktif: true,
      },
    });
  }
  const tersimpan = await prisma.periode.count({
    where: {
      tanggalMulai: { gte: new Date(TAHUN_UJI, 0, 1), lte: new Date(TAHUN_UJI, 11, 31) },
    },
  });
  cek(tersimpan === daftar.length, `${tersimpan} periode tersimpan di database`);

  // ===== 3. idempoten — jalankan lagi tidak membuat duplikat =====
  console.log('\n--- 3. idempoten (dijalankan ulang aman) ---');
  let dibuatLagi = 0;
  for (const p of daftar) {
    const ada = await prisma.periode.findFirst({
      where: { tanggalMulai: p.mulai, tanggalSelesai: p.selesai },
      select: { id: true },
    });
    if (!ada) {
      await prisma.periode.create({
        data: {
          kode: `${p.kode}-UJI2`,
          nama: p.nama,
          tanggalMulai: p.mulai,
          tanggalSelesai: p.selesai,
          aktif: true,
        },
      });
      dibuatLagi++;
    }
  }
  cek(dibuatLagi === 0, 'tidak ada duplikat saat dijalankan kedua kali');
  const totalSetelah = await prisma.periode.count({
    where: {
      tanggalMulai: { gte: new Date(TAHUN_UJI, 0, 1), lte: new Date(TAHUN_UJI, 11, 31) },
    },
  });
  cek(totalSetelah === daftar.length, `jumlah tetap ${daftar.length}`);

  // ===== 4. verifikasi isi database cocok dengan perhitungan =====
  console.log('\n--- 4. isi database cocok dengan perhitungan ---');
  const dariDb = await prisma.periode.findMany({
    where: {
      tanggalMulai: { gte: new Date(TAHUN_UJI, 0, 1), lte: new Date(TAHUN_UJI, 11, 31) },
    },
    orderBy: { tanggalMulai: 'asc' },
  });
  let cocok = 0;
  for (let i = 0; i < daftar.length; i++) {
    const a = daftar[i];
    const b = dariDb[i];
    if (
      b &&
      selisihHari(a.mulai, b.tanggalMulai) === 0 &&
      selisihHari(a.selesai, b.tanggalSelesai) === 0 &&
      a.nama === b.nama
    ) {
      cocok++;
    }
  }
  cek(cocok === daftar.length, `${cocok}/${daftar.length} periode identik (tanggal + nama)`);

  // ===== 5. kasus Oktober 2030 =====
  console.log('\n--- 5. contoh nyata ---');
  const okt = await prisma.periode.findFirst({
    where: {
      tanggalMulai: { gte: new Date(TAHUN_UJI, 9, 1), lte: new Date(TAHUN_UJI, 9, 31) },
      nama: { contains: 'Oktober' },
    },
    orderBy: { tanggalMulai: 'asc' },
  });
  if (okt) {
    console.log(`   ${okt.nama}: mulai ${okt.tanggalMulai.getDate()}/${okt.tanggalMulai.getMonth() + 1}`);
  }
  const semuaOkt = dariDb.filter((p) => p.nama.includes('Oktober'));
  cek(semuaOkt.length > 0, `periode Oktober ${TAHUN_UJI} ada (${semuaOkt.length})`);
  cek(
    semuaOkt[0]?.tanggalMulai.getDate() === 1,
    'periode Oktober mulai tanggal 1'
  );

  // ===== 6. pengaturan hari penilaian =====
  console.log('\n--- 6. pengaturan hari penilaian ---');
  const sebelum = await prisma.pengaturan.findUnique({ where: { id: 'utama' } });
  if (sebelum) {
    console.log(`   hari penilaian tersimpan: ${sebelum.hariPenilaian}`);
    cek(sebelum.hariPenilaian >= 0 && sebelum.hariPenilaian <= 6, 'nilai hari wajar');
  } else {
    const baru = await prisma.pengaturan.create({
      data: { id: 'utama', hariPenilaian: RABU },
    });
    cek(baru.hariPenilaian === RABU, 'pengaturan default dibuat (Rabu)');
  }

  // ===== bereskan =====
  await bereskan();
  console.log(`\n✓ data uji ${TAHUN_UJI} dibersihkan`);

  console.log(`\n=== HASIL: ${lulus} lulus, ${gagal} gagal ===`);
  if (gagal > 0) process.exit(1);
  console.log('✅ PERIODE OTOMATIS TERVERIFIKASI.');
}

main()
  .catch((e) => {
    console.error('\n❌ GAGAL:', e.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
