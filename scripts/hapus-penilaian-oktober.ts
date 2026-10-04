/**
 * Hapus penilaian di periode OKTOBER 2026 (keputusan pemilik aplikasi,
 * 3 Okt 2026): ketiganya dianggap uji coba kemarin, termasuk satu yang sudah
 * terisi 13 aspek.
 *
 * Sebelum benar-benar menghapus, isinya DITULIS ke berkas JSON di
 * `backups/hapus-oktober-<tanggal>.json` supaya masih bisa dipulihkan kalau
 * ternyata dibutuhkan. Folder backups/ sudah di-.gitignore.
 *
 * Jalankan:
 *   pnpm exec tsx scripts/hapus-penilaian-oktober.ts            # pratinjau
 *   pnpm exec tsx scripts/hapus-penilaian-oktober.ts --jalankan # eksekusi
 */
import 'dotenv/config';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const JALANKAN = process.argv.includes('--jalankan');
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

function lokal(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

async function main() {
  const periode = await prisma.periode.findMany({
    where: { tanggalMulai: { gte: new Date(2026, 9, 1), lte: new Date(2026, 9, 31) } },
  });
  const ids = periode.map((p) => p.id);
  if (ids.length === 0) {
    console.log('Tidak ada periode Oktober 2026 di database.');
    return;
  }

  const penilaian = await prisma.penilaian.findMany({
    where: { periodeId: { in: ids } },
    include: {
      pegawai: { select: { nip: true, nama: true } },
      periode: { select: { nama: true, tanggalMulai: true, tanggalSelesai: true } },
      detail: true,
    },
  });

  console.log(`Periode Oktober 2026 ditemukan: ${periode.length}`);
  console.log(`Penilaian yang akan DIHAPUS: ${penilaian.length}`);
  for (const p of penilaian) {
    console.log(
      `  · ${p.pegawai.nama.padEnd(20)} ${p.periode.nama.padEnd(26)} status=${p.status.padEnd(8)}` +
        ` nilai=${String(p.nilaiAkhir ?? '-').padEnd(6)} aspek=${p.detail.length}/13 foto=${p.fotoData ? 'ada' : '-'}`
    );
  }
  console.log(`  (periode itu sendiri TIDAK dihapus di sini — diganti skrip ganti-periode)`);

  if (!JALANKAN) {
    console.log('\n(pratinjau — tambahkan --jalankan untuk eksekusi)');
    return;
  }

  // cadangkan isinya dulu
  const cap = new Date().toISOString().slice(0, 10);
  const akar = join(process.cwd(), 'backups', `hapus-oktober-${cap}`);
  mkdirSync(akar, { recursive: true });
  const jalur = join(akar, 'penilaian-oktober.json');
  writeFileSync(
    jalur,
    JSON.stringify(
      {
        dibuat: new Date().toISOString(),
        keterangan:
          'Penilaian periode Oktober 2026 yang dihapus atas keputusan pemilik aplikasi (dianggap uji coba).',
        penilaian: penilaian.map((p) => ({
          ...p,
          periode: {
            ...p.periode,
            tanggalMulai: lokal(p.periode.tanggalMulai),
            tanggalSelesai: lokal(p.periode.tanggalSelesai),
          },
        })),
      },
      null,
      1
    ),
    'utf8'
  );
  console.log(`\nCadangan ditulis: ${jalur}`);

  // hapus detail dulu, lalu penilaiannya
  const pids = penilaian.map((p) => p.id);
  const d1 = await prisma.penilaianDetail.deleteMany({ where: { penilaianId: { in: pids } } });
  const d2 = await prisma.penilaian.deleteMany({ where: { id: { in: pids } } });
  console.log(`Terhapus: ${d1.count} detail aspek, ${d2.count} penilaian`);

  const sisa = await prisma.penilaian.count({ where: { periodeId: { in: ids } } });
  const total = await prisma.penilaian.count();
  console.log(`Sisa penilaian di Oktober: ${sisa} (harus 0)`);
  console.log(`Total penilaian di database: ${total}`);
}

main()
  .catch((e) => {
    console.error('GAGAL:', e instanceof Error ? e.message : e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
