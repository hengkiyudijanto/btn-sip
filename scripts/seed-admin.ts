/**
 * Skrip seed: membuat akun admin awal supaya bisa login pertama kali.
 *
 * Jalankan: pnpm exec tsx scripts/seed-admin.ts
 * Password diambil dari ADMIN_PASSWORD di .env.local (atau argumen pertama).
 *
 * PENTING: akun dibuat dengan harusGantiPassword = true, jadi password
 * tersebut wajib diganti saat login pertama.
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import bcrypt from 'bcryptjs';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('❌ DATABASE_URL tidak ada.');
  process.exit(1);
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

async function main() {
  const nip = process.env.ADMIN_NIP ?? 'admin';
  const password = process.env.ADMIN_PASSWORD ?? process.argv[2];

  if (!password) {
    console.error(
      '❌ Password admin belum diset.\n' +
        '   Tambahkan ADMIN_PASSWORD ke .env.local, atau jalankan:\n' +
        '   pnpm exec tsx scripts/seed-admin.ts "PasswordAnda123"'
    );
    process.exit(1);
  }

  if (password.length < 8) {
    console.error('❌ Password minimal 8 karakter.');
    process.exit(1);
  }

  // cabang default
  const cabang = await prisma.cabang.upsert({
    where: { kode: '0001' },
    update: {},
    create: { kode: '0001', nama: 'Kantor Pusat' },
  });
  console.log('✓ Cabang:', cabang.kode, '-', cabang.nama);

  // master jabatan frontliner
  const daftarJabatan = [
    { kode: 'TELLER', nama: 'Teller', namaEn: 'Teller' },
    { kode: 'CS', nama: 'Customer Service', namaEn: 'Customer Service' },
    { kode: 'SECURITY', nama: 'Security', namaEn: 'Security' },
    {
      kode: 'PB_TELLER',
      nama: 'Priority Banking Teller',
      namaEn: 'Priority Banking Teller',
    },
    {
      kode: 'PB_CS',
      nama: 'Priority Banking Customer Service',
      namaEn: 'Priority Banking Customer Service',
    },
  ];
  for (const j of daftarJabatan) {
    await prisma.jabatan.upsert({
      where: { kode: j.kode },
      update: { nama: j.nama, namaEn: j.namaEn },
      create: j,
    });
  }
  console.log('✓ Jabatan:', daftarJabatan.map((j) => j.kode).join(', '));

  // akun admin
  const hash = await bcrypt.hash(password, 12);
  const admin = await prisma.pegawai.upsert({
    where: { nip },
    update: { role: 'ADMIN', aktif: true },
    create: {
      nip,
      nama: process.env.ADMIN_NAMA ?? 'Administrator',
      passwordHash: hash,
      role: 'ADMIN',
      harusGantiPassword: true,
      cabangId: cabang.id,
    },
  });
  console.log('✓ Admin:', admin.nip, '-', admin.nama, '(role:', admin.role + ')');

  console.log('\n✅ Seed selesai. Login dengan NIP', nip, 'lalu ganti password.');
}

main()
  .catch((e) => {
    console.error('❌ GAGAL:', e.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
