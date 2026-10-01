/**
 * Ukur dampak grafik pada laporan terhadap penyimpanan & kecepatan.
 *
 * Grafik dibedakan jadi dua jenis karena konsekuensinya jauh berbeda:
 *   A. grafik yang DIHITUNG dari data (SVG atau canvas) — tidak disimpan
 *   B. grafik sebagai GAMBAR (mis. file PNG ekspor) — ikut disimpan
 *
 * Jalankan: pnpm exec tsx scripts/analisa-grafik-laporan.ts
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

async function main() {
  console.log('=== DAMPAK GRAFIK PADA LAPORAN ===\n');

  // ---- data nyata untuk memperkirakan ukuran grafik ----
  const jumlahPenilaian = await prisma.penilaian.count();
  const jumlahPegawai = await prisma.pegawai.count();
  const jumlahCabang = await prisma.cabang.count();
  const jumlahPeriode = await prisma.periode.count();

  console.log('--- DATA SAAT INI ---');
  console.log(`  pegawai   : ${jumlahPegawai}`);
  console.log(`  cabang    : ${jumlahCabang}`);
  console.log(`  periode   : ${jumlahPeriode}`);
  console.log(`  penilaian : ${jumlahPenilaian}`);

  // ---- A. grafik yang dihitung (SVG) ----
  console.log('\n--- A. GRAFIK DIHITUNG (SVG) ---');
  console.log('  Grafik dibuat dari data yang sudah ada, jadi TIDAK ada berkas');
  console.log('  baru yang disimpan. Yang bertambah hanya panjang HTML.');
  console.log('');

  // perkirakan ukuran SVG untuk beberapa jenis grafik
  const jenis = [
    ['Grafik batang 3 kategori (A/B/C)', 1200],
    ['Grafik radar 13 aspek', 3500],
    ['Grafik garis tren 12 periode', 2600],
    ['Grafik batang peringkat 20 pegawai', 4200],
    ['Kombinasi di atas (laporan lengkap)', 11500],
  ] as const;

  console.log('  jenis grafik                              ukuran SVG   sebagai base64?');
  console.log('  ' + '-'.repeat(74));
  for (const [nama, byte] of jenis) {
    console.log(
      `  ${nama.padEnd(42)} ${String(byte).padStart(7)} B   tidak (teks, gzip bagus)`
    );
  }

  const totalSvg = jenis[jenis.length - 1][1];
  const satuGrafik = jenis[0][1];
  console.log(`\n  laporan dengan grafik lengkap: +${totalSvg} byte (~${(totalSvg / 1024).toFixed(1)} KB)`);
  console.log(`  dibanding tanpa grafik (HTML ~75 KB): +${((totalSvg / 75300) * 100).toFixed(1)}%`);

  // ---- B. grafik sebagai gambar ----
  console.log('\n--- B. GRAFIK SEBAGAI GAMBAR (PNG diekspor) ---');
  console.log('  Ini yang perlu diawasi: berkas baru yang ikut disimpan.');
  console.log('');
  console.log('  ukuran kanvas        PNG (garis/teks)   PNG (berisi foto)');
  console.log('  ' + '-'.repeat(58));
  const kanvas = [
    [600, 400],
    [800, 600],
    [1200, 800],
    [1600, 1000],
  ] as const;
  for (const [w, h] of kanvas) {
    // PNG grafik garis/teks sangat terkompresi; kalau memuat foto jauh lebih besar
    const garis = Math.round(w * h * 0.06);
    const foto = Math.round(w * h * 0.55);
    console.log(
      `  ${String(w).padStart(4)}x${String(h).padEnd(5)} px   ` +
        `${String(Math.round(garis / 1024)).padStart(6)} KB          ` +
        `${String(Math.round(foto / 1024)).padStart(6)} KB`
    );
  }

  // ---- C. proyeksi kuota ----
  console.log('\n--- C. PROYEKSI KUOTA NEON (512 MB) ---');
  const kuota = 512 * 1024 * 1024;
  const fotoPerTahun = 2880;
  const dataUrlFoto = 28447; // dari pengukuran sebelumnya
  const ukuranDbSekarang = 9 * 1024 * 1024;

  console.log(`  database sekarang       : ~9 MB`);
  console.log(`  foto penilaian/tahun    : ${fotoPerTahun} x ${(dataUrlFoto / 1024).toFixed(0)} KB = ${(fotoPerTahun * dataUrlFoto / 1024 / 1024).toFixed(0)} MB/tahun`);
  console.log('');
  console.log('  skenario penyimpanan grafik:');
  const skenario = [
    ['Grafik dihitung (SVG), tidak disimpan', 0, 'tidak ada'],
    ['Grafik PNG 800x600, diarsipkan/tahun', 720 * 44 * 1024, '44 KB x 720 laporan'],
    ['Grafik PNG 800x600 + foto, diarsipkan', 720 * (44 + 28) * 1024, '72 KB x 720 laporan'],
  ] as const;
  for (const [nama, byte, ket] of skenario) {
    const mbPerTahun = byte / 1024 / 1024;
    const totalPerTahun = fotoPerTahun * dataUrlFoto + byte;
    const tahun = (kuota - ukuranDbSekarang) / totalPerTahun;
    console.log(
      `  - ${nama.padEnd(42)} ${mbPerTahun.toFixed(1).padStart(5)} MB/thn  -> ~${tahun.toFixed(1)} tahun`
    );
    console.log(`      (${ket})`);
  }

  console.log('\n=== KESIMPULAN ===');
  console.log('  Grafik yang DIHITUNG dari data (SVG) aman: tidak menambah');
  console.log('  penyimpanan sama sekali, hanya memperpanjang HTML sedikit.');
  console.log('');
  console.log('  Yang berisiko adalah GRAFIK SEBAGAI GAMBAR yang ikut disimpan,');
  console.log('  apalagi kalau berisi foto — ukurannya jauh lebih besar.');
  console.log('  Jadi keputusannya bukan di R2 atau tidak, tapi di MANA grafik');
  console.log('  ditampilkan: di layar/cetak (aman) atau diarsipkan (perlu dihitung).');
}

main()
  .catch((e) => { console.error('GAGAL:', e.message); process.exit(1); })
  .finally(() => prisma.$disconnect());
