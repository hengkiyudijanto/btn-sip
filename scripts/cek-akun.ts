/**
 * Periksa akun pegawai di database yang sedang aktif (dari DATABASE_URL).
 * Berguna untuk memastikan akun benar-benar ada dan hash passwordnya valid.
 *
 * Jalankan: pnpm exec tsx scripts/cek-akun.ts
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

async function main() {
  const url = process.env.DATABASE_URL ?? '';
  const host = url.split('@')[1]?.split('/')[0] ?? '(tidak terbaca)';
  console.log('Database:', host);
  console.log('');

  const semua = await prisma.pegawai.findMany({
    select: {
      nip: true,
      nama: true,
      role: true,
      aktif: true,
      harusGantiPassword: true,
      passwordHash: true,
      cabang: { select: { kode: true } },
    },
    orderBy: { nip: 'asc' },
  });

  console.log('Total pegawai:', semua.length);

  if (semua.length === 0) {
    console.log('');
    console.log('>>> TIDAK ADA AKUN. Jalankan seed admin dulu:');
    console.log("    ADMIN_PASSWORD='...' pnpm exec tsx scripts/seed-admin.ts");
    return;
  }

  console.log('');
  for (const p of semua) {
    const panjang = p.passwordHash?.length ?? 0;
    const valid = panjang > 20 && p.passwordHash.startsWith('$2');
    console.log(
      `  ${p.nip.padEnd(12)} ${p.nama.padEnd(22)} ${p.role.padEnd(11)} ` +
        `cabang=${p.cabang.kode} aktif=${p.aktif} gantiPw=${p.harusGantiPassword} ` +
        `hash=${panjang}char ${valid ? 'OK' : 'TIDAK VALID'}`
    );
  }
}

main()
  .catch((e) => {
    console.error('GAGAL:', e.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
