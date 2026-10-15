/**
 * Bersihkan 4 baris audit sisa modul "Konten Sosmed" yang SUDAH DI-REVERT.
 *
 * Latar: commit 73fc91f membatalkan modul Konten Sosmed, tetapi baris audit yang
 * sempat tercatat (KONTEN_AJUKAN, KONTEN_SETUJUI, KONTEN_MINTA_REVISI) tertinggal
 * di tabel AuditLog. Akibatnya skrip verifikasi `test-fitur-pengingat.ts` melaporkan
 * "semua aksi yang ada di database punya label" GAGAL — padahal yang salah bukan
 * kode yang kehilangan label, melainkan database memuat aksi dari fitur yang tidak
 * ada lagi. Selama baris ini ada, kegagalan itu akan terus muncul dan terbaca
 * sebagai bug aplikasi.
 *
 * Aman: baris ini hanya catatan historis fitur yang sudah dibatalkan; ia tidak
 * dirujuk baris lain (AuditLog berdiri sendiri). Cadangan ditulis ke backups/ dulu.
 *
 * Jalankan:
 *   pnpm exec tsx scripts/bersihkan-audit-konten.ts          # lihat saja (dry-run)
 *   pnpm exec tsx scripts/bersihkan-audit-konten.ts --hapus  # benar-benar hapus
 */
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { mkdirSync, writeFileSync } from 'node:fs';

const HAPUS = process.argv.includes('--hapus');

async function main() {
  const p = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

  // Dua pola: aksi modul Konten diawali KONTEN_* (KONTEN_AJUKAN) atau diakhiri
  // _KONTEN (BUAT_KONTEN, UBAH_KONTEN, KIRIM_KONTEN). Pola pertama saja tidak
  // cukup — tiga baris terakhir sempat lolos dan tetap membuat uji gagal.
  const saring = {
    OR: [{ aksi: { startsWith: 'KONTEN' } }, { aksi: { endsWith: '_KONTEN' } }],
  };
  const baris = await p.auditLog.findMany({
    where: saring,
    orderBy: { createdAt: 'asc' },
  });

  if (baris.length === 0) {
    console.log('Tidak ada baris audit KONTEN_* — sudah bersih.');
    await p.$disconnect();
    return;
  }

  console.log(`Ditemukan ${baris.length} baris audit sisa modul Konten Sosmed:\n`);
  const perAksi = new Map<string, number>();
  for (const b of baris) perAksi.set(b.aksi, (perAksi.get(b.aksi) ?? 0) + 1);
  for (const [aksi, n] of perAksi) console.log(`   ${aksi}  n=${n}`);
  console.log(`\nrentang: ${baris[0].createdAt.toISOString().slice(0, 16)} s/d ${baris[baris.length - 1].createdAt.toISOString().slice(0, 16)}`);

  // Pastikan aksi ini memang tidak dikenal kode — kalau dikenal, jangan dihapus.
  const { aksiBelumBerlabel } = await import('../src/lib/sip/audit');
  const dikenal = baris.filter((b) => !aksiBelumBerlabel(b.aksi));
  if (dikenal.length > 0) {
    console.error(`\n❌ BERHENTI: ${dikenal.length} baris memakai aksi yang MASIH dikenal kode.`);
    console.error('   Berarti ini bukan sisa fitur yang dibatalkan — jangan dihapus.');
    await p.$disconnect();
    process.exit(1);
  }
  console.log('\n✅ Tidak satu pun aksinya dikenal kode sekarang — ini memang sisa fitur yang dibatalkan.');

  if (!HAPUS) {
    console.log('\n(dry-run) Jalankan dengan --hapus untuk benar-benar menghapusnya.');
    await p.$disconnect();
    return;
  }

  mkdirSync('backups', { recursive: true });
  const berkas = `backups/audit-konten-${new Date().toISOString().slice(0, 10)}.json`;
  writeFileSync(berkas, JSON.stringify(baris, null, 2));
  console.log(`\ncadangan ditulis: ${berkas}`);

  const hasil = await p.auditLog.deleteMany({ where: saring });
  console.log(`✅ ${hasil.count} baris audit sisa dihapus.`);

  const sisa = await p.auditLog.count({ where: saring });
  console.log(`pemeriksaan ulang — sisa baris KONTEN_*: ${sisa} (harus 0)`);
  console.log(`total baris audit sekarang: ${await p.auditLog.count()}`);

  await p.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
