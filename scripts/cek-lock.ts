/**
 * Periksa advisory lock PostgreSQL yang menghalangi migrasi Prisma.
 * Prisma memakai kunci 72707369; skrip ini memberitahu siapa pemegangnya.
 *
 * Jalankan: pnpm exec tsx scripts/cek-lock.ts
 */
import 'dotenv/config';
import { Client } from 'pg';

async function main() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  console.log('=== ADVISORY LOCK ===');
  const locks = await client.query(`
    SELECT l.objid, l.pid, a.state, a.query_start,
           now() - a.query_start AS durasi,
           a.application_name, a.client_addr::text,
           left(a.query, 80) AS query
    FROM pg_locks l
    JOIN pg_stat_activity a ON a.pid = l.pid
    WHERE l.locktype = 'advisory'
  `);
  if (locks.rows.length === 0) {
    console.log('  (tidak ada advisory lock yang aktif)');
  } else {
    for (const r of locks.rows) {
      console.log(`  objid=${r.objid} pid=${r.pid} state=${r.state}`);
      console.log(`    durasi=${r.durasi} app=${r.application_name ?? '-'} addr=${r.client_addr ?? '-'}`);
      console.log(`    query: ${r.query}`);
    }
  }

  console.log('\n=== KONEKSI AKTIF KE DATABASE ===');
  const akt = await client.query(`
    SELECT pid, state, application_name, client_addr::text,
           now() - query_start AS durasi,
           left(query, 70) AS query
    FROM pg_stat_activity
    WHERE datname = current_database() AND pid <> pg_backend_pid()
    ORDER BY query_start NULLS LAST
    LIMIT 15
  `);
  if (akt.rows.length === 0) {
    console.log('  (tidak ada koneksi lain)');
  } else {
    console.log(`  ${akt.rows.length} koneksi aktif:`);
    for (const r of akt.rows) {
      console.log(
        `  pid=${r.pid} state=${r.state ?? '-'} app=${r.application_name ?? '-'} ${r.durasi ? 'durasi=' + r.durasi.toFixed?.(0) + 's' : ''}`
      );
      if (r.query) console.log(`      ${r.query}`);
    }
  }

  await client.end();
}

main().catch((e) => {
  console.error('GAGAL:', e.message);
  process.exit(1);
});
