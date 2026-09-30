/**
 * Putuskan koneksi yang memegang advisory lock Prisma secara menggantung.
 *
 * Latar: Prisma memakai pg_advisory_lock(72707369). Melalui connection
 * pooler (pgbouncer), lock itu bisa menggantung tanpa batas kalau koneksinya
 * tidak pernah dilepas. Akibatnya semua migrasi berikutnya gagal P1002.
 *
 * Jalankan: pnpm exec tsx scripts/bebaskan-lock.ts
 * (hanya memutus koneksi yang benar-benar memegang lock migrasi Prisma)
 */
import 'dotenv/config';
import { Client } from 'pg';

const KUNCI_PRISMA = 72707369;

async function main() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  console.log('=== PEMEGANG ADVISORY LOCK PRISMA ===');
  const pemegang = await client.query(
    `
    SELECT l.pid, a.state, a.application_name,
           a.query_start, now() - a.query_start AS durasi
    FROM pg_locks l
    JOIN pg_stat_activity a ON a.pid = l.pid
    WHERE l.locktype = 'advisory' AND l.objid = $1
  `,
    [KUNCI_PRISMA]
  );

  if (pemegang.rows.length === 0) {
    console.log('  (tidak ada yang memegang lock — sudah bebas)');
    await client.end();
    return;
  }

  for (const r of pemegang.rows) {
    const detik = Math.round(Number(r.durasi?.seconds ?? 0));
    console.log(`  pid=${r.pid} state=${r.state} app=${r.application_name ?? '-'} selama ~${detik}s`);
  }

  console.log('');
  console.log('→ Memutus koneksi pemegang lock...');

  for (const r of pemegang.rows) {
    // jangan putus koneksi kita sendiri
    const hasil = await client.query('SELECT pg_terminate_backend($1) AS ok', [r.pid]);
    console.log(`  pid=${r.pid} → ${hasil.rows[0].ok ? 'diputus' : 'gagal'}`);
  }

  // beri waktu backend benar-benar berhenti
  await new Promise((r) => setTimeout(r, 2000));

  const cek = await client.query(
    `
    SELECT COUNT(*)::int AS jumlah
    FROM pg_locks
    WHERE locktype = 'advisory' AND objid = $1
  `,
    [KUNCI_PRISMA]
  );
  console.log('');
  console.log(
    cek.rows[0].jumlah === 0
      ? '✅ Lock sudah bebas. Migrasi bisa dijalankan.'
      : `⚠ Masih ada ${cek.rows[0].jumlah} pemegang lock.`
  );

  await client.end();
}

main().catch((e) => {
  console.error('GAGAL:', e.message);
  process.exit(1);
});
