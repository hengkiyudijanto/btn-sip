/**
 * Reset password SATU akun admin ke nilai yang ditentukan, TANPA lewat aturan
 * kekuatan password aplikasi, lalu memaksa ganti password saat login.
 *
 * Dipakai hanya ketika pemilik aplikasi meminta password tertentu yang ditolak
 * `validasiKekuatanPassword()` (mis. tanpa angka). Gunanya: login darurat.
 * Setelah login, pengguna langsung diarahkan ke /ubah-password.
 *
 * Password dibaca dari `.env.reset` (sudah di-gitignore) — JANGAN lewat argumen
 * perintah atau chat, karena keduanya tercatat.
 *
 *   ADMIN_NIP=admin pnpm exec tsx scripts/paksa-password-admin.ts            # rencana
 *   ADMIN_NIP=admin pnpm exec tsx scripts/paksa-password-admin.ts --jalankan # ubah
 */
import 'dotenv/config';
import { readFileSync, existsSync } from 'node:fs';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});
const JALANKAN = process.argv.includes('--jalankan');

function bacaPassword(): string {
  if (existsSync('.env.reset')) {
    const baris = readFileSync('.env.reset', 'utf8')
      .split('\n')
      .find((b) => b.trimStart().startsWith('ADMIN_PASSWORD='));
    if (baris) return baris.slice(baris.indexOf('=') + 1).trim();
  }
  console.error('❌ ADMIN_PASSWORD tidak ada di .env.reset');
  process.exit(1);
}

async function main() {
  const nip = process.env.ADMIN_NIP ?? 'admin';
  const password = bacaPassword();
  const admin = await prisma.pegawai.findUnique({ where: { nip } });
  if (!admin) {
    console.error(`❌ Akun NIP "${nip}" tidak ditemukan.`);
    process.exit(1);
  }

  console.log(`akun          : ${admin.nip} — ${admin.nama} (${admin.role})`);
  console.log(`password baru : ${password.length} karakter (tidak ditampilkan)`);
  console.log(`wajibGantiPw  : ${admin.harusGantiPassword} → true`);

  if (!JALANKAN) {
    console.log('\n(rencana saja — tambahkan --jalankan)');
    return;
  }

  await prisma.pegawai.update({
    where: { id: admin.id },
    data: { passwordHash: await bcrypt.hash(password, 12), harusGantiPassword: true, aktif: true },
  });
  await prisma.sesi.updateMany({
    where: { pegawaiId: admin.id, revokedAt: null },
    data: { revokedAt: new Date() },
  });

  const sesudah = await prisma.pegawai.findUniqueOrThrow({ where: { id: admin.id } });
  const cocok = await bcrypt.compare(password, sesudah.passwordHash);
  console.log('\n=== HASIL ===');
  console.log(`  password cocok dengan hash : ${cocok ? 'YA' : 'TIDAK'}`);
  console.log(`  cost                       : ${sesudah.passwordHash.match(/^\$2[aby]\$(\d+)\$/)?.[1]}`);
  console.log(`  wajib ganti saat login     : ${sesudah.harusGantiPassword}`);
  await prisma.$disconnect();
}
main();
