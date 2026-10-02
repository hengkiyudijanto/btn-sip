/**
 * RESET PASSWORD SAJA — tidak menyentuh apa pun selain password akun admin.
 *
 * Beda penting dari `reset-produksi.ts` (jangan tertukar):
 *   reset-produksi.ts  : menghapus data demo + memindahkan admin ke cabang
 *                        "0001 Kantor Pusat" + memaksa ganti password.
 *   skrip ini          : HANYA mengganti passwordHash. Nama, NIP, role,
 *                        cabang, dan seluruh data lain dibiarkan apa adanya.
 *
 * Dipakai ketika user kehilangan password akun admin-nya tetapi tidak mau
 * data akun (cabang, nama, penilaian yang pernah ia isi) ikut berubah.
 *
 * Password dibaca dari `.env.reset` (sudah masuk `.gitignore`) — JANGAN
 * menaruhnya di argumen perintah atau di chat, karena keduanya tercatat.
 *
 * Jalankan:
 *   pnpm exec tsx scripts/reset-password-admin.ts            # lihat rencana
 *   pnpm exec tsx scripts/reset-password-admin.ts --jalankan # benar-benar ganti
 */
import 'dotenv/config';
import { readFileSync, existsSync } from 'node:fs';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

const FILE_PW = '.env.reset';
const JALANKAN = process.argv.includes('--jalankan');

function bacaPassword(): string {
  if (process.env.ADMIN_PASSWORD) return process.env.ADMIN_PASSWORD;
  if (existsSync(FILE_PW)) {
    const baris = readFileSync(FILE_PW, 'utf8')
      .split('\n')
      .find((b) => b.trimStart().startsWith('ADMIN_PASSWORD='));
    if (baris) return baris.slice(baris.indexOf('=') + 1).trim();
  }
  console.error(`❌ Password tidak ditemukan. Isi ${FILE_PW} dengan baris:\n   ADMIN_PASSWORD=...`);
  process.exit(1);
}

/** Aturan yang sama dengan `validasiKekuatanPassword()` di aplikasi. */
function periksaKekuatan(pw: string): string | null {
  if (pw.length < 8) return 'minimal 8 karakter';
  if (!/[a-z]/.test(pw)) return 'harus ada huruf kecil';
  if (!/[A-Z]/.test(pw)) return 'harus ada huruf besar';
  if (!/[0-9]/.test(pw)) return 'harus ada angka';
  return null;
}

async function main() {
  const nipAdmin = process.env.ADMIN_NIP ?? 'admin';
  const password = bacaPassword();

  const lemah = periksaKekuatan(password);
  if (lemah) {
    console.error(`❌ Password ditolak aturan aplikasi: ${lemah}.`);
    process.exit(1);
  }

  const host = (process.env.DATABASE_URL ?? '').split('@')[1]?.split('/')[0];
  console.log('Database:', host);

  const admin = await prisma.pegawai.findUnique({ where: { nip: nipAdmin } });
  if (!admin) {
    console.error(`❌ Akun NIP "${nipAdmin}" tidak ditemukan.`);
    process.exit(1);
  }

  const sesiAktif = await prisma.sesi.count({
    where: { pegawaiId: admin.id, revokedAt: null, expiresAt: { gt: new Date() } },
  });
  const penilaianSebagaiPenilai = await prisma.penilaian.count({
    where: { penilaiId: admin.id },
  });

  console.log('');
  console.log('Yang akan diubah:');
  console.log(`  akun          : ${admin.nip} — ${admin.nama} (${admin.role})`);
  console.log(`  cabang        : ${admin.cabangId}  ← TIDAK diubah`);
  console.log(`  aktif         : ${admin.aktif}  ← TIDAK diubah`);
  console.log(`  wajibGantiPw  : ${admin.harusGantiPassword}  ← TIDAK diubah`);
  console.log(`  hash lama     : ${admin.passwordHash.slice(0, 7)}… (cost ${admin.passwordHash.match(/^\$2[aby]\$(\d+)\$/)?.[1] ?? '?'})`);
  console.log(`  password baru : ${password.length} karakter (tidak ditampilkan)`);
  console.log(`  sesi aktif yang akan dicabut : ${sesiAktif}`);
  console.log(`  penilaian atas namanya (tidak tersentuh) : ${penilaianSebagaiPenilai}`);

  if (!JALANKAN) {
    console.log('\n(rencana saja — tambahkan --jalankan untuk benar-benar mengganti)');
    return;
  }

  const hash = await bcrypt.hash(password, 12);
  await prisma.pegawai.update({
    where: { id: admin.id },
    data: {
      passwordHash: hash,
      // harusGantiPassword SENGAJA tidak diubah: user sudah memakai aplikasi
      // ini dan tidak minta dipaksa ganti password lagi.
      aktif: true,
    },
  });

  // cabut sesi lama supaya tidak ada sesi menggantung dengan password lama
  await prisma.sesi.updateMany({
    where: { pegawaiId: admin.id, revokedAt: null },
    data: { revokedAt: new Date() },
  });

  // buktikan hasilnya dengan membaca ulang dari database
  const sesudah = await prisma.pegawai.findUniqueOrThrow({ where: { id: admin.id } });
  const cocok = await bcrypt.compare(password, sesudah.passwordHash);

  console.log('');
  console.log('=== HASIL ===');
  console.log(`  hash baru     : ${sesudah.passwordHash.slice(0, 7)}… panjang ${sesudah.passwordHash.length} (harus 60)`);
  console.log(`  cost          : ${sesudah.passwordHash.match(/^\$2[aby]\$(\d+)\$/)?.[1]} (harus 12)`);
  console.log(`  uji kecocokan : ${cocok ? 'Password cocok dengan hash tersimpan ✓' : 'GAGAL ✗'}`);
  console.log(`  cabang tetap  : ${sesudah.cabangId}`);
  console.log(`  wajibGantiPw  : ${sesudah.harusGantiPassword}`);
  if (!cocok || sesudah.passwordHash.length !== 60) process.exitCode = 1;
}

main()
  .catch((e) => {
    console.error('❌ GAGAL:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
