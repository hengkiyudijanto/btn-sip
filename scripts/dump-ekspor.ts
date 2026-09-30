import 'dotenv/config';
import crypto from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import bcrypt from 'bcryptjs';

const BASE = 'http://localhost:3100';
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});
const h = (t: string) => crypto.createHash('sha256').update(t).digest('hex');

async function main() {
  const cabang = await prisma.cabang.findFirst({ where: { aktif: true } });
  const hash = await bcrypt.hash('X1234567', 10);
  const nipA = 'DUMP00001';
  const nipB = 'DUMP00002';

  for (const nip of [nipA, nipB]) {
    await prisma.penilaianDetail.deleteMany({ where: { penilaian: { pegawai: { nip } } } });
    await prisma.penilaian.deleteMany({ where: { pegawai: { nip } } });
    await prisma.pegawai.deleteMany({ where: { nip } });
  }

  const a = await prisma.pegawai.create({
    data: { nip: nipA, nama: 'Andi Dump', passwordHash: hash, role: 'PEGAWAI',
      harusGantiPassword: false, aktif: true, cabangId: cabang!.id },
  });
  const b = await prisma.pegawai.create({
    data: { nip: nipB, nama: 'Siti; Dump "Uji"', passwordHash: hash, role: 'PEGAWAI',
      harusGantiPassword: false, aktif: true, cabangId: cabang!.id },
  });

  const spv = await prisma.pegawai.findFirst({ where: { role: { in: ['SUPERVISOR', 'ADMIN'] } } });
  const hariIni = new Date();
  const periode =
    (await prisma.periode.findFirst({
      where: { tanggalMulai: { lte: hariIni }, tanggalSelesai: { gte: hariIni } },
    })) ??
    (await prisma.periode.findFirst({
      where: { tanggalMulai: { gt: hariIni } },
      orderBy: { tanggalMulai: 'asc' },
    }));

  await prisma.penilaian.create({
    data: { pegawaiId: a.id, penilaiId: spv!.id, periodeId: periode!.id, status: 'FINAL',
      nilaiPenampilan: 5, nilaiKemampuan: 4.8, nilaiSikap: 5, nilaiAkhir: 4.93, rating: 'Istimewa',
      detail: { create: [{ kodeAspek: 'A1', nilaiMentah: 99, skor: 5, bobotAspek: 0.4 }] } },
  });
  await prisma.penilaian.create({
    data: { pegawaiId: b.id, penilaiId: spv!.id, periodeId: periode!.id, status: 'DRAFT',
      nilaiPenampilan: 3.5, nilaiKemampuan: 3.4, nilaiSikap: 3.6, nilaiAkhir: 3.51, rating: 'Cukup',
      detail: { create: [{ kodeAspek: 'A1', nilaiMentah: 80, skor: 2, bobotAspek: 0.4 }] } },
  });

  const token = crypto.randomBytes(32).toString('base64url');
  await prisma.sesi.create({
    data: { tokenHash: h(token), pegawaiId: spv!.id, expiresAt: new Date(Date.now() + 600000) },
  });

  const res = await fetch(`${BASE}/laporan/ekspor?periode=${periode!.id}`, {
    headers: { cookie: 'sip_sesi=' + token },
  });
  const buf = Buffer.from(await res.arrayBuffer());
  writeFileSync('/tmp/rekap-dump.csv', buf);
  console.log('berkas disimpan: /tmp/rekap-dump.csv\n');
  console.log('=== ISI BERKAS (baris demi baris) ===');
  buf.toString('utf8').split('\r\n').forEach((l, i) => {
    console.log(`${String(i).padStart(2)}| ${l}`);
  });

  for (const nip of [nipA, nipB]) {
    await prisma.penilaianDetail.deleteMany({ where: { penilaian: { pegawai: { nip } } } });
    await prisma.penilaian.deleteMany({ where: { pegawai: { nip } } });
    await prisma.pegawai.deleteMany({ where: { nip } });
  }
  await prisma.sesi.deleteMany({ where: { pegawaiId: spv!.id } });
}

main()
  .catch((e) => {
    console.error('GAGAL:', e.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
