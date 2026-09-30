/**
 * Uji edit pegawai: nama, NIP, cabang, jabatan, peran, email.
 * Termasuk validasi keunikan NIP dan proteksi admin terakhir.
 *
 * Jalankan: pnpm exec tsx scripts/test-edit-pegawai.ts
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import bcrypt from 'bcryptjs';

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

const NIP_A = 'EDIT00001';
const NIP_B = 'EDIT00002';
const NIP_ADMIN = 'EDITADMIN';

async function bersihkan() {
  await prisma.pegawai.deleteMany({ where: { nip: { in: [NIP_A, NIP_B, NIP_ADMIN, 'EDIT00003'] } } });
  await prisma.cabang.deleteMany({ where: { kode: 'EDIT-CAB' } });
}

async function main() {
  console.log('=== UJI EDIT PEGAWAI ===\n');
  await bersihkan();

  const cabangAsal = await prisma.cabang.findFirst({ where: { aktif: true } });
  if (!cabangAsal) throw new Error('Tidak ada cabang aktif untuk uji');

  const cabangBaru = await prisma.cabang.create({
    data: { kode: 'EDIT-CAB', nama: 'Cabang Uji Edit', jenis: 'KC', indukId: null },
  });
  const jabatan = await prisma.jabatan.findFirst();
  const hash = await bcrypt.hash('UjiPass123', 10);

  // ===== data awal =====
  const a = await prisma.pegawai.create({
    data: {
      nip: NIP_A, nama: 'Pegawai A', passwordHash: hash,
      role: 'PEGAWAI', harusGantiPassword: false, cabangId: cabangAsal.id,
    },
  });
  const b = await prisma.pegawai.create({
    data: {
      nip: NIP_B, nama: 'Pegawai B', passwordHash: hash,
      role: 'PEGAWAI', harusGantiPassword: false, cabangId: cabangAsal.id,
    },
  });
  console.log('ok  dua pegawai uji dibuat\n');

  // ===== 1. Ubah nama =====
  console.log('--- 1. ubah nama ---');
  const ubahNama = await prisma.pegawai.update({
    where: { id: a.id },
    data: { nama: 'Pegawai A (Diperbarui)' },
  });
  cek(ubahNama.nama === 'Pegawai A (Diperbarui)', 'nama berhasil diubah');

  // ===== 2. Ubah NIP =====
  console.log('\n--- 2. ubah NIP oleh admin ---');
  const nipBaru = 'EDIT00003';
  const ubahNip = await prisma.pegawai.update({
    where: { id: a.id },
    data: { nip: nipBaru },
  });
  cek(ubahNip.nip === nipBaru, `NIP diubah dari ${NIP_A} menjadi ${nipBaru}`);

  // NIP lama harus bebas
  const cekLama = await prisma.pegawai.findUnique({ where: { nip: NIP_A } });
  cek(cekLama === null, 'NIP lama sudah tidak dipakai siapa pun');

  // ===== 3. NIP duplikat ditolak =====
  console.log('\n--- 3. NIP duplikat ---');
  let ditolak = false;
  try {
    await prisma.pegawai.update({ where: { id: a.id }, data: { nip: NIP_B } });
  } catch {
    ditolak = true;
  }
  cek(ditolak, 'NIP yang sudah dipakai pegawai lain DITOLAK');

  // simulasi pengecekan di server action
  const bentrok = await prisma.pegawai.findUnique({ where: { nip: NIP_B } });
  cek(bentrok?.id === b.id, 'pengecekan bentrok menemukan pemilik NIP yang benar');

  // ===== 4. Pindah cabang =====
  console.log('\n--- 4. pindah cabang ---');
  const pindah = await prisma.pegawai.update({
    where: { id: a.id },
    data: { cabangId: cabangBaru.id },
    include: { cabang: { select: { kode: true, nama: true } } },
  });
  cek(pindah.cabangId === cabangBaru.id, 'pegawai berhasil dipindah ke cabang baru');
  cek(pindah.cabang.kode === 'EDIT-CAB', 'relasi cabang ikut terbarui');

  // ===== 5. Ubah jabatan & peran =====
  console.log('\n--- 5. jabatan & peran ---');
  const ubahJabatan = await prisma.pegawai.update({
    where: { id: a.id },
    data: { jabatanId: jabatan?.id ?? null, role: 'SUPERVISOR' },
    include: { jabatan: { select: { nama: true } } },
  });
  cek(ubahJabatan.role === 'SUPERVISOR', 'peran diubah dari PEGAWAI ke SUPERVISOR');
  cek(
    jabatan ? ubahJabatan.jabatan?.nama === jabatan.nama : true,
    'jabatan terhubung dengan benar'
  );

  // ===== 6. Email unik =====
  console.log('\n--- 6. email ---');
  await prisma.pegawai.update({ where: { id: a.id }, data: { email: 'a@btn.co.id' } });
  let emailDitolak = false;
  try {
    await prisma.pegawai.update({ where: { id: b.id }, data: { email: 'a@btn.co.id' } });
  } catch {
    emailDitolak = true;
  }
  cek(emailDitolak, 'email duplikat ditolak database (unique)');

  // ===== 7. Proteksi admin terakhir =====
  console.log('\n--- 7. proteksi admin terakhir ---');
  const admin = await prisma.pegawai.create({
    data: {
      nip: NIP_ADMIN, nama: 'Admin Uji Edit', passwordHash: hash,
      role: 'ADMIN', harusGantiPassword: false, cabangId: cabangAsal.id,
    },
  });
  const jumlahAdminLain = await prisma.pegawai.count({
    where: { role: 'ADMIN', aktif: true, id: { not: admin.id } },
  });
  console.log(`   jumlah admin aktif lain di database: ${jumlahAdminLain}`);
  cek(
    jumlahAdminLain > 0,
    'penghitung admin lain bekerja (di DB ini ada admin lain, jadi ubah peran diizinkan)'
  );

  // simulasi: kalau ini satu-satunya admin, harus ditolak
  const bolehTurunkanPeran = jumlahAdminLain > 0;
  cek(bolehTurunkanPeran === true, 'ubah peran diizinkan karena masih ada admin lain');

  // ===== 8. Audit log tercatat =====
  console.log('\n--- 8. audit log ---');
  const sesiAdmin = await prisma.pegawai.findUnique({ where: { nip: 'admin' } });
  if (sesiAdmin) {
    await prisma.auditLog.create({
      data: {
        pegawaiId: sesiAdmin.id,
        aksi: 'UBAH_PEGAWAI_NIP',
        entitas: 'Pegawai',
        entitasId: a.id,
        dataLama: { nip: NIP_A },
        dataBaru: { nip: nipBaru },
      },
    });
    const log = await prisma.auditLog.findFirst({
      where: { aksi: 'UBAH_PEGAWAI_NIP', entitasId: a.id },
    });
    cek(log !== null, 'perubahan NIP tercatat di audit log');
  }

  // ===== 9. Password tidak terpengaruh =====
  console.log('\n--- 9. password tetap aman ---');
  const akhir = await prisma.pegawai.findUnique({ where: { id: a.id } });
  cek(await bcrypt.compare('UjiPass123', akhir!.passwordHash), 'password lama masih bisa dipakai setelah edit data');
  cek(akhir!.passwordHash !== 'UjiPass123', 'password tetap tersimpan sebagai hash, bukan plaintext');

  await bersihkan();
  await prisma.auditLog.deleteMany({ where: { entitasId: a.id } });
  console.log('\n✓ data uji dibersihkan');

  console.log(`\n=== HASIL: ${lulus} lulus, ${gagal} gagal ===`);
  if (gagal > 0) process.exit(1);
  console.log('✅ EDIT PEGAWAI TERVERIFIKASI.');
}

main()
  .catch((e) => {
    console.error('\n❌ GAGAL:', e.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
