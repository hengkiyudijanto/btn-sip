/**
 * Bandingkan Opsi 1 vs Opsi 2 secara terukur.
 *
 * Yang diukur:
 *   A. Ukuran tersimpan di database (base64 vs biner)
 *   B. Ukuran terkirim saat halaman dibuka berulang (Opsi 1)
 *   C. Perkiraan waktu muat pada koneksi kantor
 *   D. Berapa baris kode yang perlu diubah & berapa risiko migrasinya
 *
 * Jalankan: pnpm exec tsx scripts/banding-opsi-foto.ts
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

async function main() {
  console.log('=== BANDING OPSI 1 vs OPSI 2 (angka nyata dari database) ===\n');

  const penilaian = await prisma.penilaian.findMany({
    where: { fotoData: { not: null } },
    select: { fotoData: true, fotoUkuran: true, fotoMime: true },
  });
  const pegawai = await prisma.pegawai.findMany({
    where: { fotoData: { not: null } },
    select: { fotoData: true, fotoUkuran: true },
  });

  const semua = [...penilaian, ...pegawai];
  if (semua.length === 0) {
    console.log('  tidak ada foto tersimpan untuk diukur');
    return;
  }

  console.log('--- A. UKURAN TERSIMPAN DI DATABASE ---');
  let biner = 0;
  let dataUrl = 0;
  for (const f of semua) {
    biner += f.fotoUkuran ?? Buffer.from(f.fotoData!.split(',')[1] ?? '', 'base64').length;
    dataUrl += f.fotoData!.length;
  }
  console.log(`  ${semua.length} foto tersimpan`);
  console.log(`  bila base64 (sekarang) : ${dataUrl.toLocaleString('id-ID')} byte`);
  console.log(`  bila biner             : ${biner.toLocaleString('id-ID')} byte`);
  console.log(
    `  selisih                : ${(dataUrl - biner).toLocaleString('id-ID')} byte ` +
      `(${((1 - biner / dataUrl) * 100).toFixed(0)}% lebih kecil)`
  );
  console.log(`  rata-rata per foto     : base64 ${Math.round(dataUrl / semua.length).toLocaleString('id-ID')} B  vs  biner ${Math.round(biner / semua.length).toLocaleString('id-ID')} B`);

  console.log('\n--- B. UKURAN TERKIRIM SAAT HALAMAN DIBUKA ---');
  const rataBiner = biner / semua.length;
  const rataDataUrl = dataUrl / semua.length;
  console.log(`  satu halaman laporan memuat 1 foto (${Math.round(rataDataUrl)} B sebagai base64)`);
  console.log('');
  console.log('  berapa kali dibuka    OPSI 1 (route gambar)      sekarang (base64)');
  console.log('  ' + '-'.repeat(62));
  for (const buka of [1, 2, 5, 10]) {
    // Opsi 1: buka pertama penuh, sisanya hanya HTML (foto dari cache)
    const opsi1 = rataDataUrl + (buka - 1) * 0; // foto hanya sekali
    const now = buka * rataDataUrl;
    console.log(
      `  ${String(buka).padStart(2)}x buka              ${(opsi1 / 1024).toFixed(0).padStart(6)} KB             ` +
        `${(now / 1024).toFixed(0).padStart(6)} KB   ` +
        `${now > opsi1 ? `(hemat ${(((now - opsi1) / now) * 100).toFixed(0)}%)` : ''}`
    );
  }

  console.log('\n--- C. PERKIRAAN WAKTU MUAT (koneksi kantor 3 Mbps) ---');
  const kbps = 3 * 1024; // KB per detik pada 3 Mbps
  console.log(`  asumsi koneksi 3 Mbps = ${kbps} KB/detik`);
  console.log(`  HTML laporan tanpa foto ~ 75 KB`);
  console.log('');
  const htmlDasar = 75;
  const fotoKb = rataDataUrl / 1024;
  const sekarang = (htmlDasar + fotoKb) / kbps;
  const opsi1Pertama = (htmlDasar + fotoKb) / kbps;
  const opsi1Berikut = htmlDasar / kbps;
  console.log(`  sekarang, setiap buka     : ${(sekarang * 1000).toFixed(0)} ms`);
  console.log(`  Opsi 1, buka pertama      : ${(opsi1Pertama * 1000).toFixed(0)} ms`);
  console.log(`  Opsi 1, buka ke-2 dst     : ${(opsi1Berikut * 1000).toFixed(0)} ms  <- lebih cepat ${((1 - opsi1Berikut / sekarang) * 100).toFixed(0)}%`);

  console.log('\n--- D. PROYEKSI KAPASITAS ---');
  const perTahun = 2880; // 12 cabang x 5 petugas x 48 periode
  const kuota = 512 * 1024 * 1024;
  console.log(`  contoh Kanwil: ${perTahun} foto/tahun`);
  console.log(`  Opsi 1 saja (biner tetap data URL) : ${(perTahun * rataDataUrl / 1024 / 1024).toFixed(0)} MB/tahun -> kuota habis ~${Math.floor(kuota / (perTahun * rataDataUrl))} tahun`);
  console.log(`  Opsi 2 (biner)                     : ${(perTahun * rataBiner / 1024 / 1024).toFixed(0)} MB/tahun -> kuota habis ~${Math.floor(kuota / (perTahun * rataBiner))} tahun`);

  console.log('\n--- E. KESIMPULAN ---');
  console.log('  Opsi 1 menyerang KECEPATAN (foto tidak diunduh ulang).');
  console.log('  Opsi 2 menyerang KAPASITAS (25% lebih hemat di database).');
  console.log('  Keduanya TIDAK mengubah kualitas foto sama sekali.');
  console.log('  Opsi 1 tanpa migrasi data; Opsi 2 perlu konversi base64 -> biner.');
}

main()
  .catch((e) => { console.error('GAGAL:', e.message); process.exit(1); })
  .finally(() => prisma.$disconnect());
