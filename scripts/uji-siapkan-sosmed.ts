/**
 * Menyiapkan akun & data uji untuk mengetes modul sosmed lewat UI/peramban.
 *
 * Jalankan:  pnpm exec tsx scripts/uji-siapkan-sosmed.ts
 * Bersihkan: pnpm exec tsx scripts/uji-siapkan-sosmed.ts --hapus
 *
 * Akun yang dibuat (password: UjiSosmed123, harusGantiPassword=false):
 *   UJISM1 — SUPERVISOR (kreator)
 *   UJISM2 — MANAGER    (penyetuju)
 *   UJISM3 — PEGAWAI    (tidak punya hak apa pun di modul sosmed)
 *
 * Akun sengaja TIDAK dihapus otomatis setelah uji supaya bisa dipakai berulang
 * saat memeriksa UI dengan peramban.
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
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

const SANDI = 'UjiSosmed123';
const PREFIX = '[UJI-SOSMED]';
const AKUN: { nip: string; role: 'SUPERVISOR' | 'MANAGER' | 'PEGAWAI'; nama: string }[] = [
  { nip: 'UJISM1', role: 'SUPERVISOR', nama: 'Kreator Uji' },
  { nip: 'UJISM2', role: 'MANAGER', nama: 'Penyetuju Uji' },
  { nip: 'UJISM3', role: 'PEGAWAI', nama: 'Pegawai Uji' },
];

async function main() {
  const hapus = process.argv.includes('--hapus');

  if (hapus) {
    for (const a of AKUN) {
      const p = await prisma.pegawai.findUnique({ where: { nip: a.nip } });
      if (!p) continue;
      // URUTAN PENTING: hapus konten sebelum pegawainya. Kalau dibalik, Postgres
      // menolak dengan P2003 (KontenSosmed_pembuatId_fkey) karena relasi
      // pembuat/penyetuju/pengaju masih menunjuk ke pegawai ini.
      await prisma.kontenSosmed.deleteMany({
        where: {
          OR: [{ pembuatId: p.id }, { penyetujuId: p.id }, { pengajuId: p.id }],
        },
      });
      await prisma.sesi.deleteMany({ where: { pegawaiId: p.id } });
      await prisma.pegawai.delete({ where: { id: p.id } });
    }
    // konten demo sisa (kalau ada) yang pembuatnya bukan akun uji di atas
    await prisma.kontenSosmed.deleteMany({ where: { judul: { startsWith: PREFIX } } });
    await prisma.jabatan.deleteMany({ where: { kode: 'UJI-SM' } });
    await prisma.cabang.deleteMany({ where: { kode: 'UJI-SM' } });
    console.log('✓ Akun & data uji sosmed dihapus.');
    return;
  }

  const cabang = await prisma.cabang.upsert({
    where: { kode: 'UJI-SM' },
    update: {},
    create: { kode: 'UJI-SM', nama: 'Uji Sosmed' },
  });
  const jabatan = await prisma.jabatan.upsert({
    where: { kode: 'UJI-SM' },
    update: {},
    create: { kode: 'UJI-SM', nama: 'Petugas Uji' },
  });
  const hash = await bcrypt.hash(SANDI, 10);

  for (const a of AKUN) {
    const lama = await prisma.pegawai.findUnique({ where: { nip: a.nip } });
    if (lama) {
      await prisma.sesi.deleteMany({ where: { pegawaiId: lama.id } });
      await prisma.pegawai.update({
        where: { id: lama.id },
        data: {
          nama: a.nama,
          passwordHash: hash,
          role: a.role,
          aktif: true,
          harusGantiPassword: false,
          cabangId: cabang.id,
          jabatanId: jabatan.id,
        },
      });
      console.log(`↻ diperbarui: ${a.nip} (${a.role}) — ${a.nama}`);
      continue;
    }
    await prisma.pegawai.create({
      data: {
        nip: a.nip,
        nama: a.nama,
        passwordHash: hash,
        role: a.role,
        cabangId: cabang.id,
        jabatanId: jabatan.id,
        harusGantiPassword: false,
      },
    });
    console.log(`✓ dibuat: ${a.nip} (${a.role}) — ${a.nama}`);
  }

  console.log(`\nLogin dengan NIP di atas, password: ${SANDI}`);
  console.log('Bersihkan dengan: pnpm exec tsx scripts/uji-siapkan-sosmed.ts --hapus');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
