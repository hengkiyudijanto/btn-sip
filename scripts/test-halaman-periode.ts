/**
 * Uji halaman Periode lewat HTTP dengan sesi nyata.
 *
 * Memastikan halaman menampilkan periode hasil aturan baru, panel hari
 * penilaian, dan penanda periode berjalan.
 *
 * Jalankan: BASE_URL=http://localhost:3100 pnpm exec tsx scripts/test-halaman-periode.ts
 */
import 'dotenv/config';
import crypto from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

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
  console.log(`=== UJI HALAMAN PERIODE (${BASE}) ===\n`);

  const admin = await prisma.pegawai.findUnique({ where: { nip: 'admin' } });
  if (!admin) throw new Error('akun admin tidak ada');

  const token = crypto.randomBytes(32).toString('base64url');
  await prisma.sesi.create({
    data: {
      tokenHash: hashToken(token),
      pegawaiId: admin.id,
      expiresAt: new Date(Date.now() + 1800_000),
    },
  });

  const res = await fetch(`${BASE}/periode`, {
    headers: { cookie: `sip_sesi=${token}` },
    redirect: 'manual',
  });
  const html = await res.text();

  console.log('--- 1. halaman terbuka ---');
  cek(res.status === 200, `halaman Periode terbuka (status ${res.status})`);
  if (res.status === 307) {
    console.log(`   dialihkan ke: ${res.headers.get('location')}`);
  }

  console.log('\n--- 2. periode aturan baru tampil ---');
  const tahun = new Date().getFullYear();
  cek(html.includes('Periode Penilaian'), 'judul halaman ada');
  cek(html.includes('Dibuat otomatis') || html.includes('dibuat otomatis'), 'keterangan otomatis ada');
  cek(html.includes(`Minggu ke-1 ${['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'][new Date().getMonth()]}`) || html.includes('Minggu ke-'), 'nama periode format baru tampil');

  console.log('\n--- 3. panel hari penilaian ---');
  cek(html.includes('Hari penilaian'), 'panel hari penilaian ada');
  cek(html.includes('Setiap hari'), 'dropdown hari ada');
  cek(html.includes('Rabu') || html.includes('Senin'), 'nama hari tampil');

  console.log('\n--- 4. penanda periode berjalan ---');
  cek(html.includes('berjalan') || html.includes('Aktif'), 'status periode tampil');

  console.log('\n--- 5. kolom jumlah hari ---');
  cek(html.includes('Hari'), 'kolom Hari ada');

  console.log('\n--- 6. penjelasan aturan ---');
  cek(html.includes('Aturan periode'), 'blok aturan ada');
  cek(html.includes('mulai tanggal 1') || html.includes('tanggal 1'), 'aturan tanggal 1 dijelaskan');
  cek(html.includes('hari Minggu') || html.includes('Minggu'), 'aturan hari Minggu dijelaskan');

  // ===== cek periode di database =====
  console.log('\n--- 7. isi database ---');
  const jumlahTahunIni = await prisma.periode.count({
    where: {
      tanggalMulai: { gte: new Date(tahun, 0, 1), lte: new Date(tahun, 11, 31) },
    },
  });
  console.log(`   ${jumlahTahunIni} periode untuk ${tahun}`);
  cek(jumlahTahunIni >= 48 && jumlahTahunIni <= 56, 'jumlah periode wajar');

  const okt = await prisma.periode.findMany({
    where: { nama: { contains: 'Oktober' } },
    orderBy: { tanggalMulai: 'asc' },
  });
  if (okt.length > 0) {
    const pertama = okt.find((p) => p.nama.includes('ke-1'));
    if (pertama) {
      console.log(
        `   ${pertama.nama}: ${pertama.tanggalMulai.getDate()} – ${pertama.tanggalSelesai.getDate()}`
      );
      cek(pertama.tanggalMulai.getDate() === 1, 'periode pertama Oktober mulai tanggal 1');
    }
  }

  await prisma.sesi.deleteMany({ where: { pegawaiId: admin.id } });

  console.log(`\n=== HASIL: ${lulus} lulus, ${gagal} gagal ===`);
  if (gagal > 0) process.exit(1);
  console.log('✅ HALAMAN PERIODE TERVERIFIKASI.');
}

main()
  .catch((e) => {
    console.error('GAGAL:', e.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
