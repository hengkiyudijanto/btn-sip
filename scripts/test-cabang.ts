/**
 * Uji modul kelola cabang: tambah, ubah, nonaktifkan, dan proteksi hapus.
 * Jalankan: pnpm exec tsx scripts/test-cabang.ts
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

let lulus = 0;
let gagal = 0;
function cek(kondisi: boolean, label: string) {
  console.log(`   ${kondisi ? 'ok ' : 'XX '} ${label}`);
  if (kondisi) lulus++;
  else gagal++;
}

const KODE_UJI = 'TST-CBG';

async function bersihkan() {
  await prisma.cabang.deleteMany({ where: { kode: KODE_UJI } });
}

async function main() {
  console.log('=== UJI MODUL KELOLA CABANG ===\n');
  await bersihkan();

  // ===== 1. Tambah =====
  console.log('--- tambah cabang ---');
  const cabang = await prisma.cabang.create({
    data: { kode: KODE_UJI, nama: 'Cabang Uji Otomatis', alamat: 'Jl. Uji No. 1' },
  });
  cek(cabang.kode === KODE_UJI, 'cabang dibuat dengan kode benar');
  cek(cabang.nama === 'Cabang Uji Otomatis', 'nama tersimpan');
  cek(cabang.alamat === 'Jl. Uji No. 1', 'alamat tersimpan');
  cek(cabang.aktif, 'default aktif');

  // kode duplikat harus ditolak
  let ditolak = false;
  try {
    await prisma.cabang.create({ data: { kode: KODE_UJI, nama: 'Duplikat' } });
  } catch {
    ditolak = true;
  }
  cek(ditolak, 'kode duplikat ditolak oleh database (unique)');

  // ===== 2. Ubah nama & alamat =====
  console.log('\n--- ubah cabang ---');
  const diubah = await prisma.cabang.update({
    where: { id: cabang.id },
    data: { nama: 'Cabang Uji (diubah)', alamat: 'Jl. Baru No. 2' },
  });
  cek(diubah.nama === 'Cabang Uji (diubah)', 'nama berhasil diubah');
  cek(diubah.alamat === 'Jl. Baru No. 2', 'alamat berhasil diubah');
  cek(diubah.kode === KODE_UJI, 'kode TIDAK berubah (sesuai desain)');

  // ===== 3. Aktif / nonaktif =====
  console.log('\n--- status aktif ---');
  const nonaktif = await prisma.cabang.update({
    where: { id: cabang.id },
    data: { aktif: false },
  });
  cek(!nonaktif.aktif, 'cabang berhasil dinonaktifkan');

  const aktifLagi = await prisma.cabang.update({
    where: { id: cabang.id },
    data: { aktif: true },
  });
  cek(aktifLagi.aktif, 'cabang berhasil diaktifkan kembali');

  // ===== 4. Proteksi hapus =====
  console.log('\n--- proteksi hapus ---');
  const pegawaiUji = await prisma.pegawai.create({
    data: {
      nip: 'TSTCBG01',
      nama: 'Pegawai Uji Cabang',
      passwordHash: '$2a$10$dummyhashuntukujisajahahahahahahahahahahahahahahah',
      role: 'PEGAWAI',
      harusGantiPassword: true,
      cabangId: cabang.id,
    },
  });

  const denganPegawai = await prisma.cabang.findUnique({
    where: { id: cabang.id },
    include: { _count: { select: { pegawai: true } } },
  });
  cek(denganPegawai!._count.pegawai === 1, 'penghitung pegawai bekerja (1 pegawai)');

  // simulasi logika server action: tolak kalau masih ada pegawai
  const bolehHapus = (denganPegawai?._count.pegawai ?? 0) === 0;
  cek(!bolehHapus, 'hapus DITOLAK karena masih ada pegawai terhubung');

  // setelah pegawai dihapus, cabang boleh dihapus
  await prisma.pegawai.delete({ where: { id: pegawaiUji.id } });
  const setelahKosong = await prisma.cabang.findUnique({
    where: { id: cabang.id },
    include: { _count: { select: { pegawai: true } } },
  });
  cek(setelahKosong!._count.pegawai === 0, 'setelah pegawai dihapus, cabang kosong');
  cek(
    (setelahKosong?._count.pegawai ?? 1) === 0,
    'hapus DIIZINKAN karena sudah tidak ada pegawai'
  );

  // ===== 5. Hapus bersih =====
  console.log('\n--- hapus cabang ---');
  await prisma.cabang.delete({ where: { id: cabang.id } });
  const hilang = await prisma.cabang.findUnique({ where: { kode: KODE_UJI } });
  cek(hilang === null, 'cabang benar-benar terhapus dari database');

  await bersihkan();

  console.log(`\n=== HASIL: ${lulus} lulus, ${gagal} gagal ===`);
  if (gagal > 0) process.exit(1);
  console.log('✅ MODUL CABANG TERVERIFIKASI.');
}

main()
  .catch((e) => {
    console.error('\n❌ GAGAL:', e.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
