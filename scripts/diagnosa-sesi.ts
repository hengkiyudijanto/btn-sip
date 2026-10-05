import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

/**
 * Menjawab "kenapa sesi hilang setelah klik Simpan?" dengan bukti, bukan dugaan.
 *
 * Yang diperiksa:
 *  1. Apakah sesi UJISM1 masih ada & belum di-revoke?
 *  2. Apakah konten benar-benar tersimpan (kalau ya, masalahnya cuma cookie)?
 *  3. Apakah ada jejak audit dari aksi simpan?
 *  4. Apakah ada error tersimpan di log mana pun.
 */
async function main() {
  const p = await prisma.pegawai.findUnique({
    where: { nip: 'UJISM1' },
    select: { id: true, nama: true, aktif: true },
  });
  console.log('pegawai UJISM1:', p);

  if (p) {
    const sesi = await prisma.sesi.findMany({
      where: { pegawaiId: p.id },
      select: { id: true, revokedAt: true, expiresAt: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });
    console.log(`\nsesi (${sesi.length}):`);
    for (const s of sesi) {
      const hidup = !s.revokedAt && s.expiresAt > new Date();
      console.log(
        `  ${s.createdAt.toISOString()} revoked=${s.revokedAt ? s.revokedAt.toISOString() : 'tidak'} ${
          hidup ? 'HIDUP' : 'MATI'
        }`
      );
    }

    const audit = await prisma.auditLog.findMany({
      where: { pegawaiId: p.id },
      select: { aksi: true, entitas: true, entitasId: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });
    console.log('\naudit terakhir:');
    for (const a of audit) {
      console.log(`  ${a.createdAt.toISOString()} ${a.aksi} ${a.entitas ?? ''} ${a.entitasId ?? ''}`);
    }
  }

  const konten = await prisma.kontenSosmed.findMany({
    select: { id: true, judul: true, status: true, mediaByte: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
    take: 5,
  });
  console.log(`\nkonten (${konten.length} terakhir):`);
  for (const k of konten) {
    console.log(`  ${k.createdAt.toISOString()} [${k.status}] ${k.judul} (${k.mediaByte ?? 0} byte)`);
  }
}

main().finally(() => prisma.$disconnect());
