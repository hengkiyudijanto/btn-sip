/**
 * Hapus periode yang **belum dimulai** (tanggal mulai setelah hari ini).
 *
 * Dipakai sekali untuk membersihkan periode tahun depan yang terlanjur dibuat
 * otomatis oleh `pastikanPeriodeTahun()` — halaman `/parameter/periode`
 * menampilkannya sebagai kelompok tahun kosong dan user membacanya sebagai
 * data yang hilang. Aplikasi sekarang hanya membuat periode tahun berjalan.
 *
 * KEAMANAN — periode hanya dihapus kalau:
 *   1. tanggal mulainya SETELAH hari ini, DAN
 *   2. tidak punya penilaian sama sekali (`penilaian: { none: {} }`)
 *
 * Jadi periode yang sedang berjalan, periode arsip, dan periode apa pun yang
 * sudah dipakai menilai tidak akan tersentuh.
 *
 * Jalankan:
 *   pnpm exec tsx scripts/bersihkan-periode-belum-mulai.ts            # lihat rencana
 *   pnpm exec tsx scripts/bersihkan-periode-belum-mulai.ts --hapus    # benar-benar hapus
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const HAPUS = process.argv.includes('--hapus');

// Aplikasi tidak lagi mengubah tahun ini (tidak ada penulisan ke Pengaturan),
// jadi koneksi ini hanya membaca. Kalau nanti skrip ini perlu menulis,
// jalankan hanya saat aplikasi sedang tidak diakses.
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

async function main() {
  const hariIni = new Date();
  const awalHari = new Date(hariIni.getFullYear(), hariIni.getMonth(), hariIni.getDate());

  const [kandidat, terjaga] = await Promise.all([
    prisma.periode.findMany({
      where: { tanggalMulai: { gt: awalHari }, penilaian: { none: {} } },
      orderBy: { tanggalMulai: 'asc' },
      select: { id: true, kode: true, nama: true, tanggalMulai: true },
    }),
    prisma.periode.findMany({
      where: { tanggalMulai: { gt: awalHari }, penilaian: { some: {} } },
      orderBy: { tanggalMulai: 'asc' },
      select: { kode: true, nama: true, _count: { select: { penilaian: true } } },
    }),
  ]);

  const host = (process.env.DATABASE_URL ?? '').split('@')[1]?.split('/')[0];
  console.log('Database :', host);
  console.log('Hari ini :', awalHari.toISOString().slice(0, 10));
  console.log('');

  if (kandidat.length > 0) {
    const perTahun = new Map<number, number>();
    for (const p of kandidat) {
      const t = p.tanggalMulai.getFullYear();
      perTahun.set(t, (perTahun.get(t) ?? 0) + 1);
    }
    console.log('Periode BELUM DIMULAI dan tanpa penilaian (akan dihapus):');
    for (const [t, n] of [...perTahun.entries()].sort((a, b) => a[0] - b[0])) {
      console.log(`  ${t} : ${n} periode`);
    }
    console.log(`  contoh: ${kandidat[0].nama} (${kandidat[0].tanggalMulai.toISOString().slice(0, 10)})`);
  } else {
    console.log('Periode belum dimulai tanpa penilaian: (tidak ada)');
  }

  if (terjaga.length > 0) {
    console.log('\nPeriode belum dimulai TAPI SUDAH PUNYA PENILAIAN (TIDAK dihapus):');
    for (const p of terjaga) console.log(`  ${p.nama} — ${p._count.penilaian} penilaian`);
  }

  console.log(`\nTotal yang akan dihapus: ${kandidat.length} periode`);

  if (!HAPUS) {
    console.log('\n(dry-run — jalankan ulang dengan --hapus untuk benar-benar menghapus)');
    return;
  }

  const hasil = await prisma.periode.deleteMany({
    where: { id: { in: kandidat.map((p) => p.id) } },
  });
  console.log(`\nTerhapus: ${hasil.count} periode.`);
}

main()
  .catch((e) => {
    console.error('GAGAL:', e instanceof Error ? e.message : e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
