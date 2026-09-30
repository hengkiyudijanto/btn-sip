/**
 * Uji halaman Laporan memilih periode yang relevan.
 *
 * Bug yang diperbaiki: halaman laporan memakai
 *   prisma.periode.findMany({ orderBy: { tanggalMulai: 'desc' }, take: 20 })
 * lalu memilih `daftarPeriode.find(p => p.aktif) ?? daftarPeriode[0]`.
 * Dengan 148 periode di database (2025-2027), 20 terakhir semuanya tahun
 * 2027 dan default-nya jatuh ke Desember 2027.
 *
 * Jalankan: BASE_URL=http://localhost:3100 pnpm exec tsx scripts/test-laporan-periode.ts
 */
import 'dotenv/config';
import crypto from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { pilihPeriodeRelevan, daftarPeriodeUntukPemilih } from '../src/lib/sip/periode-aktif';

const BASE = process.env.BASE_URL ?? 'http://localhost:3100';
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

const hashToken = (t: string) => crypto.createHash('sha256').update(t).digest('hex');

async function main() {
  console.log(`=== UJI PERIODE DI HALAMAN LAPORAN (${BASE}) ===\n`);

  // ===== 1. daftar periode untuk pemilih =====
  console.log('--- 1. daftar periode untuk pemilih ---');
  const daftar = await daftarPeriodeUntukPemilih();
  console.log(`   ${daftar.length} periode ditawarkan`);
  console.log(`   terbaru : ${daftar[0]?.nama}`);
  console.log(`   terlama : ${daftar[daftar.length - 1]?.nama}`);

  const ada2027Jauh = daftar.some((p) => p.nama.includes('Desember 2027'));
  cek(!ada2027Jauh, 'TIDAK menawarkan Desember 2027 (bug lama)');

  const tahunSekarang = new Date().getFullYear();
  const semuaDekat = daftar.every((p) => {
    const selisih = Math.abs(p.tanggalMulai.getFullYear() - tahunSekarang);
    return selisih <= 1;
  });
  cek(semuaDekat, `semua periode dekat dengan tahun sekarang (${tahunSekarang})`);
  cek(daftar.length > 0 && daftar.length < 60, `jumlah pilihan wajar (${daftar.length})`);

  // ===== 2. periode terpilih =====
  console.log('\n--- 2. periode terpilih default ---');
  const terpilih = await pilihPeriodeRelevan();
  console.log(`   terpilih: ${terpilih?.nama}`);
  cek(terpilih !== null, 'ada periode terpilih');
  cek(!terpilih?.nama.includes('2027'), 'BUKAN periode tahun 2027');

  // ===== 3. halaman lewat HTTP =====
  console.log('\n--- 3. halaman laporan lewat HTTP ---');
  const hariIni = new Date();
  const admin = await prisma.pegawai.findUnique({ where: { nip: 'admin' } });
  if (!admin) throw new Error('admin tidak ada');
  const token = crypto.randomBytes(32).toString('base64url');
  await prisma.sesi.create({
    data: {
      tokenHash: hashToken(token),
      pegawaiId: admin.id,
      expiresAt: new Date(Date.now() + 1800_000),
    },
  });

  const res = await fetch(`${BASE}/laporan`, {
    headers: { cookie: `sip_sesi=${token}` },
    redirect: 'manual',
  });
  const html = res.status === 200 ? await res.text() : '';
  cek(res.status === 200, `halaman laporan terbuka (status ${res.status})`);

  cek(html.includes('Laporan'), 'judul halaman ada');

  // dropdown tidak boleh memuat periode JAUH (Desember 2027 dan seterusnya)
  const opsiHtml = html.match(/<option[^>]*>[^<]*<\/option>/g) ?? [];
  const namaJauh = opsiHtml.filter((o) => /Desember 2027|2028|2029/.test(o));
  const namaDekat = opsiHtml.filter((o) => o.includes(String(tahunSekarang)));
  console.log(`   ${opsiHtml.length} opsi di dropdown, ${namaDekat.length} opsi tahun ${tahunSekarang}`);
  cek(namaJauh.length === 0, `dropdown TIDAK memuat periode jauh (${namaJauh.length})`);
  cek(namaDekat.length > 0, `dropdown memuat periode tahun ${tahunSekarang}`);

  // semua opsi harus dalam jendela wajar: 3 bulan ke belakang s/d 6 ke depan
  const jendelaAwal = new Date(hariIni.getFullYear(), hariIni.getMonth() - 4, 1);
  const jendelaAkhir = new Date(hariIni.getFullYear(), hariIni.getMonth() + 7, 28);
  const dalamJendela = daftar.every(
    (p) => p.tanggalMulai >= jendelaAwal && p.tanggalMulai <= jendelaAkhir
  );
  cek(dalamJendela, 'semua pilihan berada dalam jendela 3 bulan ke belakang s/d 6 bulan ke depan');

  // periode terpilih harus yang relevan
  if (terpilih) {
    cek(html.includes(terpilih.nama), `halaman menampilkan "${terpilih.nama}"`);
  }
  cek(!html.includes('Minggu ke-5 Desember 2027'), 'TIDAK menampilkan Desember 2027');

  // ===== 4. peringatan periode =====
  console.log('\n--- 4. peringatan periode tidak sesuai ---');
  // pakai periode yang JELAS sudah lewat: minimal 5 hari sebelum hari ini
  const batas = new Date();
  batas.setDate(batas.getDate() - 5);
  const periodeLalu = await prisma.periode.findFirst({
    where: { tanggalSelesai: { lt: batas } },
    orderBy: { tanggalSelesai: 'desc' },
  });
  if (periodeLalu) {
    console.log(`   periode lewat: ${periodeLalu.nama}`);
    const r = await fetch(`${BASE}/laporan?periode=${periodeLalu.id}`, {
      headers: { cookie: `sip_sesi=${token}` },
      redirect: 'manual',
    });
    const h = await r.text();
    cek(h.includes('sudah lewat'), 'peringatan "sudah lewat" muncul');
    cek(h.includes('⚠'), 'ikon peringatan tampil');
  } else {
    console.log('   (tidak ada periode yang jelas lewat — dilewati)');
  }

  // ===== 5. periode berjalan tidak memunculkan peringatan =====
  console.log('\n--- 5. periode berjalan tanpa peringatan ---');
  const periodeBerjalan = await pilihPeriodeRelevan();
  if (periodeBerjalan) {
    const r = await fetch(`${BASE}/laporan?periode=${periodeBerjalan.id}`, {
      headers: { cookie: `sip_sesi=${token}` },
      redirect: 'manual',
    });
    const h = await r.text();
    cek(
      !h.includes('sudah lewat') && !h.includes('belum dimulai'),
      `periode berjalan (${periodeBerjalan.nama}) tanpa peringatan`
    );
  }

  await prisma.sesi.deleteMany({ where: { pegawaiId: admin.id } });

  console.log(`\n=== HASIL: ${lulus} lulus, ${gagal} gagal ===`);
  if (gagal > 0) process.exit(1);
  console.log('✅ PERIODE DI HALAMAN LAPORAN TERVERIFIKASI.');
}

main()
  .catch((e) => {
    console.error('GAGAL:', e.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
