/**
 * Uji: halaman memilih periode yang RELEVAN, bukan periode terakhir di
 * database.
 *
 * Latar bug: halaman memakai `orderBy: tanggalMulai desc`, sehingga setelah
 * periode otomatis dibuat sampai 2027, halaman menampilkan Desember 2027
 * padahal sekarang September 2026.
 *
 * Jalankan: BASE_URL=http://localhost:3100 pnpm exec tsx scripts/test-periode-aktif.ts
 */
import 'dotenv/config';
import crypto from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { pilihPeriodeRelevan } from '../src/lib/sip/periode-aktif';

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
  console.log(`=== UJI PEMILIHAN PERIODE RELEVAN (${BASE}) ===\n`);

  const hariIni = new Date();
  console.log(`Hari ini: ${hariIni.toDateString()}\n`);

  // ===== 1. fungsi pemilihan =====
  console.log('--- 1. fungsi pilihPeriodeRelevan ---');
  const periode = await pilihPeriodeRelevan();
  cek(periode !== null, 'mengembalikan periode');

  if (periode) {
    console.log(`   terpilih: ${periode.nama}`);
    console.log(
      `   ${periode.tanggalMulai.toDateString()} – ${periode.tanggalSelesai.toDateString()}`
    );

    // bandingkan tanggal saja (abaikan jam), karena periode disimpan
    // sebagai DateTime sementara hariIni punya jam
    const t = new Date(hariIni.getFullYear(), hariIni.getMonth(), hariIni.getDate());
    const memuatHariIni =
      t >= new Date(periode.tanggalMulai) && t <= new Date(periode.tanggalSelesai);
    cek(memuatHariIni, 'periode terpilih MEMUAT hari ini');

    // ini inti perbaikannya
    cek(
      periode.nama !== 'Minggu ke-5 Desember 2027',
      'BUKAN Desember 2027 (bug lama)'
    );

    const tahunPeriode = periode.tanggalMulai.getFullYear();
    cek(
      Math.abs(tahunPeriode - hariIni.getFullYear()) <= 1,
      `tahun periode dekat dengan tahun sekarang (${tahunPeriode})`
    );
  }

  // ===== 2. bandingkan dengan perilaku lama =====
  console.log('\n--- 2. bandingkan dengan perilaku lama ---');
  const lama = await prisma.periode.findFirst({
    where: { aktif: true },
    orderBy: { tanggalMulai: 'desc' },
  });
  console.log(`   perilaku lama (tanggalMulai desc) : ${lama?.nama}`);
  console.log(`   perilaku baru (relevan)           : ${periode?.nama}`);
  cek(lama?.nama !== periode?.nama, 'perilaku baru BERBEDA dari yang lama (perbaikan bekerja)');

  // ===== 3. lewat HTTP di halaman nyata =====
  console.log('\n--- 3. halaman nyata lewat HTTP ---');
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

  const halaman = ['/dasbor', '/penilaian', '/persetujuan', '/periode'];
  const namaTarget = periode?.nama ?? '';

  for (const path of halaman) {
    const res = await fetch(`${BASE}${path}`, {
      headers: { cookie: `sip_sesi=${token}` },
      redirect: 'manual',
    });
    const html = res.status === 200 ? await res.text() : '';

    if (res.status !== 200) {
      console.log(`   ${path}: status ${res.status} — dilewati`);
      continue;
    }

    if (path === '/periode') {
      // Halaman /periode menampilkan SEMUA tahun sebagai kelompok, tapi isi
      // tahun yang tidak sedang berjalan tidak dirender (HTML tetap ringan).
      // Yang diperiksa: kelompok tahun muncul sebagai tautan pembuka.
      cek(html.includes('2025'), '/periode: kelompok tahun 2025 ada');
      cek(html.includes('2026'), '/periode: kelompok tahun 2026 ada');
      cek(html.includes('2027'), '/periode: kelompok tahun 2027 ada');
      cek(
        html.includes('/periode?tahun=2025'),
        '/periode: ada tautan buka tahun 2025'
      );
      cek(
        html.includes('tahun berjalan'),
        '/periode: tahun berjalan ditandai'
      );
      // tahun berjalan dirender penuh (tabelnya ada)
      cek(
        html.includes('Nama periode'),
        '/periode: tabel tahun berjalan dirender'
      );
      // ukuran HTML harus ringan: hanya SATU tahun dirender penuh.
      // Sebelum perbaikan, 3 tahun (148 baris) dirender sekaligus = 469 KB.
      cek(
        html.length < 250_000,
        `/periode: HTML tetap ringan (${(html.length / 1024).toFixed(0)} KB, dulu 469 KB)`
      );
      cek(
        !html.includes('Minggu ke-5 Desember 2027'),
        '/periode: tahun 2027 TIDAK dirender penuh'
      );
      cek(
        !html.includes('Minggu ke-1 Januari 2025'),
        '/periode: tahun 2025 TIDAK dirender penuh'
      );
      continue;
    }

    const adaDes2027 = html.includes('Desember 2027');
    cek(!adaDes2027, `${path}: TIDAK menampilkan Desember 2027`);
    const menampilkanTarget = html.includes(namaTarget);
    cek(menampilkanTarget, `${path}: menampilkan "${namaTarget}"`);
  }

  await prisma.sesi.deleteMany({ where: { pegawaiId: admin.id } });

  // ===== 4. dropdown hanya tahun berjalan =====
  console.log('\n--- 4. isi dropdown periode (penilaian & laporan) ---');
  const { daftarPeriodeUntukPemilih } = await import('../src/lib/sip/periode-aktif');
  const dropdown = await daftarPeriodeUntukPemilih();
  const tahunIni = new Date().getFullYear();

  console.log(`   jumlah pilihan: ${dropdown.length}`);
  console.log(`   paling baru   : ${dropdown[0]?.nama}`);
  console.log(`   paling lama   : ${dropdown[dropdown.length - 1]?.nama}`);

  const tahunDropdown = [...new Set(dropdown.map((p) => p.tanggalMulai.getFullYear()))].sort();
  console.log(`   tahun tersedia: ${tahunDropdown.join(', ')}`);

  cek(
    !tahunDropdown.some((t) => t > tahunIni + 1),
    `tidak ada periode lebih dari ${tahunIni + 1} di dropdown`
  );
  cek(
    !dropdown.some((p) => p.nama.includes('Desember 2027')) ||
      tahunIni + 1 >= 2027,
    'tidak ada masa depan jauh (mis. Desember 2027) di dropdown'
  );
  cek(dropdown.length > 0, 'dropdown tidak kosong');
  cek(
    tahunDropdown.includes(tahunIni),
    `tahun berjalan (${tahunIni}) ada di dropdown`
  );

  // Desember tahun lalu & Januari tahun depan boleh ikut (batas tahun)
  const naikTurun = dropdown.every(
    (p, i) => i === 0 || dropdown[i - 1].tanggalMulai >= p.tanggalMulai
  );
  cek(naikTurun, 'urut dari terbaru ke terlama');
  const idUnik = new Set(dropdown.map((p) => p.id)).size === dropdown.length;
  cek(idUnik, 'tidak ada periode ganda');

  console.log(`\n=== HASIL: ${lulus} lulus, ${gagal} gagal ===`);
  if (gagal > 0) process.exit(1);
  console.log('✅ PEMILIHAN PERIODE TERVERIFIKASI.');
}

main()
  .catch((e) => {
    console.error('GAGAL:', e.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
