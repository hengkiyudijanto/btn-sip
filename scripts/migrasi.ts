/**
 * Menerapkan migrasi database ke lingkungan tujuan.
 *
 * Dipisahkan dari proses build Vercel dengan sengaja: menjalankan migrasi
 * di dalam build membuat build rapuh, karena Prisma memakai advisory lock
 * PostgreSQL — dua build bersamaan (atau koneksi lain yang memegang lock)
 * membuat build GAGAL dengan error P1002 walau kodenya benar.
 *
 * Jadi: build hanya meng-generate Prisma Client (tidak butuh database),
 * sedangkan migrasi dijalankan di sini secara sadar.
 *
 * Pemakaian:
 *   pnpm db:migrasi                    # pakai DATABASE_URL dari .env.local
 *   pnpm db:migrasi --produksi         # pakai .env.production
 *   pnpm db:migrasi --url "postgresql://..."
 */
import 'dotenv/config';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';

const arg = process.argv.slice(2);
const idxUrl = arg.indexOf('--url');
const pakaiProduksi = arg.includes('--produksi');

let databaseUrl = process.env.DATABASE_URL;

if (idxUrl >= 0 && arg[idxUrl + 1]) {
  databaseUrl = arg[idxUrl + 1];
} else if (pakaiProduksi) {
  const berkas = '.env.production';
  if (!existsSync(berkas)) {
    console.error(`❌ Berkas ${berkas} tidak ditemukan.`);
    process.exit(1);
  }
  const isi = readFileSync(berkas, 'utf8');
  const cocok = isi.match(/^DATABASE_URL\s*=\s*"?([^"\n]+)"?/m);
  if (!cocok) {
    console.error(`❌ DATABASE_URL tidak ditemukan di ${berkas}.`);
    process.exit(1);
  }
  databaseUrl = cocok[1].trim();
}

if (!databaseUrl) {
  console.error(
    '❌ DATABASE_URL belum tersedia.\n' +
      '   Jalankan dari folder proyek dengan .env.local, atau pakai:\n' +
      '   pnpm db:migrasi --url "postgresql://..."'
  );
  process.exit(1);
}

const host = databaseUrl.split('@')[1]?.split('/')[0] ?? '(tidak terbaca)';
console.log(`→ Menerapkan migrasi ke: ${host}`);
console.log('');

try {
  execFileSync('pnpm', ['exec', 'prisma', 'migrate', 'deploy'], {
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: databaseUrl },
  });
  console.log('');
  console.log('✅ Migrasi selesai.');
} catch {
  console.error('');
  console.error('❌ Migrasi gagal.');
  console.error('   Kalau error P1002 (timeout advisory lock): tunggu 1-2 menit');
  console.error('   lalu jalankan ulang — biasanya ada proses lain yang memegang lock.');
  process.exit(1);
}
