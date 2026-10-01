/**
 * Cek batas koneksi & spesifikasi database Neon.
 *
 * Ini penentu batas sebenarnya: Vercel bisa menambah instance tanpa batas
 * (bayar per pemakaian), tapi Postgres gratis punya plafon koneksi.
 * Kalau instance Vercel melebihi plafon itu, permintaan akan mengantre.
 *
 * Jalankan: pnpm exec tsx scripts/cek-batas-db.ts
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

async function main() {
  console.log('=== BATAS DATABASE NEON ===\n');

  const maxKoneksi = await prisma.$queryRaw<Array<{ name: string; setting: string }>>`
    SELECT name, setting FROM pg_settings WHERE name IN
      ('max_connections', 'superuser_reserved_connections', 'shared_buffers')
  `;
  for (const r of maxKoneksi) {
    console.log(`  ${r.name.padEnd(34)} ${r.setting}`);
  }

  const versi = await prisma.$queryRaw<Array<{ version: string }>>`SELECT version()`;
  console.log(`  versi Postgres                     ${versi[0].version.split(',')[0]}`);

  const sekarang = await prisma.$queryRaw<Array<{ n: bigint }>>`
    SELECT count(*) AS n FROM pg_stat_activity WHERE datname = current_database()
  `;
  console.log(`  koneksi aktif sekarang             ${sekarang[0].n}`);

  const ukuran = await prisma.$queryRaw<Array<{ size: string }>>`
    SELECT pg_size_pretty(pg_database_size(current_database())) AS size
  `;
  console.log(`  ukuran database                    ${ukuran[0].size}`);

  // ukuran tabel foto — penentu utama pertumbuhan
  const tabel = await prisma.$queryRaw<Array<{ nama: string; ukuran: string }>>`
    SELECT c.relname AS nama, pg_size_pretty(pg_total_relation_size(c.oid)) AS ukuran
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r'
    ORDER BY pg_total_relation_size(c.oid) DESC LIMIT 5
  `;
  console.log('\n  tabel terbesar:');
  for (const t of tabel) {
    console.log(`    ${t.nama.padEnd(22)} ${t.ukuran}`);
  }

  const jumlahFoto = await prisma.penilaian.count({ where: { fotoData: { not: null } } });
  const fotoPegawai = await prisma.pegawai.count({ where: { fotoData: { not: null } } });
  console.log(`\n  foto penilaian tersimpan : ${jumlahFoto}`);
  console.log(`  foto pegawai tersimpan   : ${fotoPegawai}`);

  console.log('\n=== ARTI ANGKA INI ===');
  console.log('  max_connections adalah plafon koneksi Postgres. Setiap instance');
  console.log('  fungsi Vercel yang hidup memakai 1+ koneksi. Kalau instance lebih');
  console.log('  banyak dari plafon ini, permintaan mengantre — bukan gagal, tapi');
  console.log('  lambat. Pooler Neon (host memuat "-pooler") menaikkan plafon ini.');
}

main()
  .catch((e) => { console.error('GAGAL:', e.message); process.exit(1); })
  .finally(() => prisma.$disconnect());
