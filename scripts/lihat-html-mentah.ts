import 'dotenv/config';
import crypto from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});
const h = (t: string) => crypto.createHash('sha256').update(t).digest('hex');

async function main() {
  const cabang = await prisma.cabang.findFirst({ where: { aktif: true } });
  const hash = await bcrypt.hash('RawHtml12', 10);
  const nipS = 'RAW001';
  const nipP = 'RAW002';
  const kodeW = 'RAW-W1';

  await prisma.penilaianDetail.deleteMany({
    where: { penilaian: { pegawai: { nip: { in: [nipP, nipS] } } } },
  });
  await prisma.penilaian.deleteMany({ where: { pegawai: { nip: { in: [nipP, nipS] } } } });
  await prisma.pegawai.deleteMany({ where: { nip: { in: [nipP, nipS] } } });
  await prisma.periode.deleteMany({ where: { kode: kodeW } });

  const spv = await prisma.pegawai.create({
    data: { nip: nipS, nama: 'SPV Raw', passwordHash: hash, role: 'SUPERVISOR',
      harusGantiPassword: false, aktif: true, cabangId: cabang!.id },
  });
  const pet = await prisma.pegawai.create({
    data: { nip: nipP, nama: 'Petugas Raw', passwordHash: hash, role: 'PEGAWAI',
      harusGantiPassword: false, aktif: true, cabangId: cabang!.id, atasanId: spv.id },
  });
  const per = await prisma.periode.create({
    data: { kode: kodeW, nama: 'Uji Raw', tanggalMulai: new Date(2039, 5, 1),
      tanggalSelesai: new Date(2039, 5, 7), aktif: true },
  });

  const token = crypto.randomBytes(32).toString('base64url');
  await prisma.sesi.create({
    data: { tokenHash: h(token), pegawaiId: spv.id, expiresAt: new Date(Date.now() + 600000) },
  });

  const res = await fetch(`http://localhost:3100/penilaian/${pet.id}?periode=${per.id}`, {
    headers: { cookie: 'sip_sesi=' + token },
  });
  const html = await res.text();

  // cetak HTML mentah tombol Simpan Draft dan Kirim Penilaian
  console.log('=== HTML MENTAH TOMBOL ===');
  for (const nama of ['Simpan Draft', 'Kirim Penilaian']) {
    const i = html.indexOf(nama);
    if (i < 0) {
      console.log(`  "${nama}" TIDAK DITEMUKAN`);
      continue;
    }
    // mundur ke awal tag <button>
    const awal = html.lastIndexOf('<button', i);
    const akhir = html.indexOf('>', i) + 1;
    console.log(`\n  "${nama}":`);
    console.log('  ' + html.slice(awal, akhir).replace(/\s+/g, ' '));
  }

  await prisma.penilaianDetail.deleteMany({ where: { penilaian: { pegawaiId: pet.id } } });
  await prisma.penilaian.deleteMany({ where: { pegawaiId: pet.id } });
  await prisma.sesi.deleteMany({ where: { pegawaiId: spv.id } });
  await prisma.pegawai.deleteMany({ where: { nip: { in: [nipP, nipS] } } });
  await prisma.periode.deleteMany({ where: { kode: kodeW } });
}

main()
  .catch((e) => {
    console.error('GAGAL:', e.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
