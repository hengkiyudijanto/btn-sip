/**
 * Bukti di PRODUKSI: berkas rekap ekspor menaruh baris yang SUDAH bernilai di ATAS
 * baris yang belum bernilai. Memakai sesi admin sungguhan + permintaan HTTP ke
 * server produksi, jadi yang diperiksa adalah kode yang benar-benar berjalan.
 *
 * Membuat data uji sendiri (DRAFT tanpa nilai + FINAL bernilai tinggi), memeriksa
 * urutan baris di berkas CSV, lalu membersihkan diri.
 */
import 'dotenv/config';
import crypto from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import bcrypt from 'bcryptjs';

const BASE = process.env.BASE_URL ?? 'https://btn-sip.vercel.app';
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });
const hashToken = (t: string) => crypto.createHash('sha256').update(t).digest('hex');

const NIP_KOSONG = 'URUTPROD01';
const NIP_NILAI = 'URUTPROD02';

let lulus = 0;
let gagal = 0;
function cek(kondisi: boolean, label: string) {
  console.log(`   ${kondisi ? 'ok ' : 'XX '} ${label}`);
  if (kondisi) lulus++;
  else gagal++;
}

async function bersihkan() {
  await prisma.penilaianDetail.deleteMany({ where: { penilaian: { pegawai: { nip: { in: [NIP_KOSONG, NIP_NILAI] } } } } });
  await prisma.penilaian.deleteMany({ where: { pegawai: { nip: { in: [NIP_KOSONG, NIP_NILAI] } } } });
  await prisma.sesi.deleteMany({ where: { pegawai: { nip: { in: [NIP_KOSONG, NIP_NILAI] } } } });
  await prisma.pegawai.deleteMany({ where: { nip: { in: [NIP_KOSONG, NIP_NILAI] } } });
}

async function main() {
  console.log(`=== URUTAN REKAP DI PRODUKSI (${BASE}) ===\n`);
  await bersihkan();

  const admin = await prisma.pegawai.findUnique({ where: { nip: 'admin' } });
  if (!admin) throw new Error('akun admin tidak ada');

  const h = new Date();
  const periode = await prisma.periode.findFirst({ where: { tanggalMulai: { lte: h }, tanggalSelesai: { gte: h } } });
  if (!periode) throw new Error('tidak ada periode berjalan');

  const hash = await bcrypt.hash('Urutprod123', 10);
  const kosong = await prisma.pegawai.create({
    data: { nip: NIP_KOSONG, nama: 'Zzz Belum Dinilai', passwordHash: hash, role: 'PEGAWAI', harusGantiPassword: false, aktif: true, cabangId: admin.cabangId },
  });
  const bernilai = await prisma.pegawai.create({
    data: { nip: NIP_NILAI, nama: 'Aaa Sudah Dinilai', passwordHash: hash, role: 'PEGAWAI', harusGantiPassword: false, aktif: true, cabangId: admin.cabangId },
  });

  await prisma.penilaian.create({
    data: { pegawaiId: kosong.id, penilaiId: admin.id, periodeId: periode.id, status: 'DRAFT' },
  });
  await prisma.penilaian.create({
    data: {
      pegawaiId: bernilai.id, penilaiId: admin.id, periodeId: periode.id, status: 'FINAL',
      nilaiPenampilan: 5, nilaiKemampuan: 5, nilaiSikap: 5, nilaiAkhir: 5.0, rating: 'Istimewa',
    },
  });
  console.log(`periode ${periode.nama}`);
  console.log('data uji: "Zzz Belum Dinilai" (DRAFT, tanpa nilai) + "Aaa Sudah Dinilai" (FINAL, nilai 5,00)\n');

  const token = crypto.randomBytes(32).toString('base64url');
  await prisma.sesi.create({
    data: { tokenHash: hashToken(token), pegawaiId: admin.id, expiresAt: new Date(Date.now() + 900_000) },
  });

  const res = await fetch(`${BASE}/laporan/ekspor?periode=${periode.id}`, {
    headers: { cookie: `sip_sesi=${token}`, 'user-agent': 'uji-urutan' },
    redirect: 'manual',
  });
  cek(res.status === 200, `unduhan berhasil (status ${res.status})`);
  const csv = await res.text();

  const baris = csv.split('\r\n').filter((l) => /^\d+;/.test(l));
  const ke = baris.findIndex((l) => l.includes('Aaa Sudah Dinilai'));
  const ks = baris.findIndex((l) => l.includes('Zzz Belum Dinilai'));
  console.log(`\n   baris bernilai di urutan : ${ke + 1}`);
  console.log(`   baris kosong di urutan   : ${ks + 1}`);
  cek(ke >= 0, 'pegawai bernilai ada di berkas');
  cek(ks >= 0, 'pegawai belum bernilai ada di berkas');
  cek(ke >= 0 && ks >= 0 && ke < ks, 'baris BERNILAI berada di ATAS baris yang belum bernilai');
  cek(baris[ke]?.startsWith('1;'), `baris bernilai menempati peringkat 1 (terbaca: "${baris[ke]?.slice(0, 40)}")`);

  await bersihkan();
  console.log('\n✓ data uji dibersihkan');
  console.log(`=== HASIL: ${lulus} lulus, ${gagal} gagal ===`);
  await prisma.$disconnect();
  if (gagal > 0) process.exit(1);
}

main().catch(async (e) => {
  console.error(e);
  await bersihkan().catch(() => {});
  process.exit(1);
});
