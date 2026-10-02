/**
 * Siapkan akun & data uji untuk memeriksa fitur baru (audit log, pengingat,
 * tren, lonceng) lewat HTTP.
 *
 * PENTING: skrip ini TIDAK menyentuh akun nyata. Database server ini adalah
 * database produksi yang sama dengan yang dilihat user (lihat skill), jadi
 * semua probe memakai akun khusus berawalan `TST`, dan semuanya dibersihkan
 * lagi oleh `scripts/uji-bersihkan.ts --hapus`.
 *
 * Jalankan: pnpm exec tsx scripts/uji-siapkan.ts
 */
import 'dotenv/config';
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

async function main() {
  const pw = await bcrypt.hash('UjiSip2026!', 10);
  const ro = await prisma.cabang.findFirstOrThrow({ where: { kode: 'RO-SMP' } });
  const kc = await prisma.cabang.findFirstOrThrow({ where: { kode: '244' } });

  const admin = await prisma.pegawai.upsert({
    where: { nip: 'TSTADMIN' },
    update: { aktif: true, harusGantiPassword: false, passwordHash: pw },
    create: {
      nip: 'TSTADMIN', nama: 'Admin Uji', role: 'ADMIN',
      passwordHash: pw, harusGantiPassword: false, aktif: true, cabangId: ro.id,
    },
  });
  const mgr = await prisma.pegawai.upsert({
    where: { nip: 'TSTMGR' },
    update: { aktif: true, harusGantiPassword: false, passwordHash: pw },
    create: {
      nip: 'TSTMGR', nama: 'Manager Uji', role: 'MANAGER',
      passwordHash: pw, harusGantiPassword: false, aktif: true, cabangId: kc.id,
    },
  });

  // Periode uji ber-`aktif: false` di tahun 2099: dipakai untuk menguji
  // pembatasan periode, tidak pernah muncul di dropdown pemilih user.
  const periode = await prisma.periode.upsert({
    where: { kode: 'TST-2099-01' },
    update: {},
    create: {
      kode: 'TST-2099-01', nama: 'Minggu ke-1 Januari 2099',
      tanggalMulai: new Date(2099, 0, 1), tanggalSelesai: new Date(2099, 0, 7), aktif: false,
    },
  });

  console.log(JSON.stringify({
    adminId: admin.id, mgrId: mgr.id, periodeId: periode.id, cabang244: kc.id,
  }, null, 1));

  // token sesi untuk kedua akun uji
  for (const [label, peg] of [['ADMIN', admin], ['MANAGER', mgr]] as const) {
    const token = crypto.randomBytes(32).toString('base64url');
    await prisma.sesi.create({
      data: {
        tokenHash: crypto.createHash('sha256').update(token).digest('hex'),
        pegawaiId: peg.id,
        expiresAt: new Date(Date.now() + 3600_000),
      },
    });
    console.log(`TOKEN_${label}=${token}`);
  }
}

main()
  .catch((e) => { console.error('GAGAL', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
