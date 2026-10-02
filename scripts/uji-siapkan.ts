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

  // SENGAJA tidak membuat periode uji tahun 2099 lagi.
  // Periode di luar masa berlaku pernah dibuat untuk menguji batas dropdown,
  // tetapi ia muncul di /parameter/periode sebagai kelompok tahun kosong
  // ("2099 — 1 periode") dan membingungkan user. Batas dropdown sekarang
  // diuji langsung terhadap data nyata (lihat test-grafik-batang/test-periode-aktif).
  console.log(JSON.stringify({
    adminId: admin.id, mgrId: mgr.id, cabang244: kc.id,
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
