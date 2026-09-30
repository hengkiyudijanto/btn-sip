/**
 * Skrip uji koneksi database.
 * Membuktikan Prisma Client benar-benar bisa membaca & menulis ke Neon,
 * bukan sekadar "migrasi berhasil".
 *
 * Jalankan: pnpm exec tsx scripts/test-db.ts
 * (butuh DATABASE_URL dari .env.local)
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('❌ DATABASE_URL tidak ada. Jalankan: set -a; source .env.local; set +a');
  process.exit(1);
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

async function main() {
  console.log('→ Menghubungkan ke Neon...');

  // 1. tulis: buat cabang contoh
  const cabang = await prisma.cabang.upsert({
    where: { kode: 'TEST-001' },
    update: {},
    create: { kode: 'TEST-001', nama: 'Cabang Uji Coba' },
  });
  console.log('  ✓ tulis Cabang:', cabang.kode, '-', cabang.nama);

  // 2. tulis: jabatan contoh
  const jabatan = await prisma.jabatan.upsert({
    where: { kode: 'TELLER' },
    update: {},
    create: { kode: 'TELLER', nama: 'Teller', namaEn: 'Teller' },
  });
  console.log('  ✓ tulis Jabatan:', jabatan.kode, '-', jabatan.nama);

  // 3. tulis: pegawai contoh (password dummy hash, bukan kredensial nyata)
  const pegawai = await prisma.pegawai.upsert({
    where: { nip: 'TEST0001' },
    update: {},
    create: {
      nip: 'TEST0001',
      nama: 'Pegawai Uji Coba',
      passwordHash: 'dummy-hash-untuk-uji-koneksi',
      role: 'PEGAWAI',
      harusGantiPassword: true,
      cabangId: cabang.id,
      jabatanId: jabatan.id,
    },
  });
  console.log('  ✓ tulis Pegawai:', pegawai.nip, '-', pegawai.nama);

  // 4. relasi: baca pegawai dengan cabang + jabatan ikut terbaca
  const lengkap = await prisma.pegawai.findUnique({
    where: { nip: 'TEST0001' },
    include: { cabang: true, jabatan: true },
  });
  console.log(
    '  ✓ relasi OK —',
    lengkap?.nama,
    '|',
    lengkap?.cabang.nama,
    '|',
    lengkap?.jabatan?.nama
  );

  // 5. hitung isi semua tabel
  const [nCabang, nPegawai, nPeriode, nPenilaian] = await Promise.all([
    prisma.cabang.count(),
    prisma.pegawai.count(),
    prisma.periode.count(),
    prisma.penilaian.count(),
  ]);
  console.log(
    `  ✓ tabel — cabang: ${nCabang} | pegawai: ${nPegawai} | periode: ${nPeriode} | penilaian: ${nPenilaian}`
  );

  // 6. bersihkan data uji
  await prisma.pegawai.delete({ where: { nip: 'TEST0001' } });
  await prisma.jabatan.delete({ where: { kode: 'TELLER' } });
  await prisma.cabang.delete({ where: { kode: 'TEST-001' } });
  console.log('  ✓ data uji dibersihkan');

  console.log('\n✅ Koneksi database BERHASIL — Prisma bisa baca, tulis, dan relasi ke Neon.');
}

main()
  .catch((e) => {
    console.error('\n❌ GAGAL:', e.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
