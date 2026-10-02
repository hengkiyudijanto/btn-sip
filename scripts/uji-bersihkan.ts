/**
 * Bersihkan SEMUA jejak pengujian fitur baru dari database:
 *   - akun uji TSTADMIN / TSTMGR beserta sesinya
 *   - periode uji 2099
 *   - catatan audit log yang dibuat oleh skrip uji (aksi uji e2e)
 *
 * Dijalankan dengan aman berkali-kali. Jalankan:
 *   pnpm exec tsx scripts/uji-bersihkan.ts            (dry-run, hanya melaporkan)
 *   pnpm exec tsx scripts/uji-bersihkan.ts --hapus    (benar-benar menghapus)
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const HAPUS = process.argv.includes('--hapus');

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

const NIP_UJI = ['TSTADMIN', 'TSTMGR'];

async function main() {
  const pegawai = await prisma.pegawai.findMany({
    where: { nip: { in: NIP_UJI } },
    select: { id: true, nip: true, nama: true },
  });
  const ids = pegawai.map((p) => p.id);

  const [sesi, penilaian, auditPegawai, periodeUji, auditUji] = await Promise.all([
    prisma.sesi.count({ where: { pegawaiId: { in: ids } } }),
    prisma.penilaian.count({ where: { pegawaiId: { in: ids } } }),
    prisma.auditLog.count({ where: { pegawaiId: { in: ids } } }),
    prisma.periode.count({ where: { kode: { startsWith: 'TST-' } } }),
    prisma.auditLog.count({ where: { aksi: { startsWith: 'UJI_' } } }),
  ]);

  console.log('Yang akan dibersihkan:');
  console.log(`  akun uji          : ${pegawai.map((p) => p.nip).join(', ') || '(tidak ada)'}`);
  console.log(`  sesi akun uji     : ${sesi}`);
  console.log(`  penilaian akun uji: ${penilaian}`);
  console.log(`  audit akun uji    : ${auditPegawai}`);
  console.log(`  periode uji (TST-): ${periodeUji}`);
  console.log(`  audit aksi UJI_*  : ${auditUji}`);

  if (!HAPUS) {
    console.log('\n(dry-run — jalankan ulang dengan --hapus untuk benar-benar membersihkan)');
    return;
  }

  await prisma.$transaction(async (tx) => {
    if (ids.length) {
      await tx.sesi.deleteMany({ where: { pegawaiId: { in: ids } } });
      await tx.auditLog.deleteMany({ where: { pegawaiId: { in: ids } } });
    }
    await tx.auditLog.deleteMany({ where: { aksi: { startsWith: 'UJI_' } } });
    // periode uji hanya dihapus kalau tidak dipakai penilaian mana pun
    await tx.periode.deleteMany({
      where: { kode: { startsWith: 'TST-' }, penilaian: { none: {} } },
    });
    if (ids.length) {
      await tx.pegawai.deleteMany({ where: { id: { in: ids } } });
    }
  });

  console.log('\nSelesai dibersihkan.');
}

main()
  .catch((e) => {
    console.error('GAGAL:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
