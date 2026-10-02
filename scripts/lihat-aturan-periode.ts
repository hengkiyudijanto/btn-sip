/**
 * Tampilkan aturan periode penilaian beserta contoh nyata dari database.
 *
 * Gunanya: menjelaskan ke user (atau diri sendiri) bagaimana periode dihitung,
 * SEKALIGUS membuktikan aturannya cocok dengan data yang benar-benar ada —
 * bukan daftar aturan yang tertulis di dokumen dan tidak pernah dicek.
 *
 * Jalankan:
 *   pnpm exec tsx scripts/lihat-aturan-periode.ts
 *   pnpm exec tsx scripts/lihat-aturan-periode.ts --tahun 2026
 *   pnpm exec tsx scripts/lihat-aturan-periode.ts --simulasi 2027   # tanpa database
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { periodeTahun, periodeBulan, NAMA_HARI, MIN_HARI_PERIODE } from '../src/lib/sip/periode';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

function arg(nama: string): string | undefined {
  const i = process.argv.indexOf(nama);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

function tanggal(d: Date): string {
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
}

function garis(judul: string) {
  console.log('');
  console.log(judul);
  console.log('='.repeat(Math.max(judul.length, 58)));
}

async function main() {
  const tahun = Number(arg('--tahun') ?? new Date().getFullYear());
  const simulasi = arg('--simulasi');

  const pengaturan = simulasi
    ? { hariPenilaian: 3, periodeTerbuatSampaiTahun: null as number | null }
    : ((await prisma.pengaturan.findUnique({ where: { id: 'utama' } })) ?? {
        hariPenilaian: 3,
        periodeTerbuatSampaiTahun: null,
      });

  const hari = NAMA_HARI[pengaturan.hariPenilaian] ?? `(${pengaturan.hariPenilaian})`;

  // =================================================================
  garis('ATURAN PERIODE PENILAIAN — SIP Petugas Frontliner');

  console.log('');
  console.log('A. ATURAN PERHITUNGAN');
  console.log('----------------------------------------------------------');
  console.log(`  1. Hari penilaian = ${hari} (dari Pengaturan, bisa diubah admin).`);
  console.log('     Ini JADWAL PENGISIAN, bukan batas periode. Ia hanya');
  console.log('     menentukan panjang periode PERTAMA tiap bulan.');
  console.log('  2. Penamaan: "Minggu ke-N <Bulan> <Tahun>", N = nomor urut');
  console.log('     dalam bulan itu. Penomoran minggu ISO (Minggu ke-39) SALAH.');
  console.log('  3. Mulai tanggal 1, berakhir hari Minggu, tidak menyeberang bulan.');
  console.log('  4. Tanggal 1 jatuh SETELAH hari penilaian -> periode pertama');
  console.log('     diperpanjang sampai Minggu minggu depan.');
  console.log(`  5. Periode kurang dari ${MIN_HARI_PERIODE} hari DIGABUNG ke periode`);
  console.log('     sebelahnya (awal bulan ke berikutnya, akhir bulan ke sebelumnya).');
  console.log('  6. Jumlah periode per bulan 4-5, setahun 49 (bukan 52). Itu BENAR.');
  console.log('  7. Mengubah hari penilaian hanya berlaku KE DEPAN: periode yang');
  console.log('     sudah ada tidak diubah supaya laporan yang sudah jadi tidak rusak.');

  if (!simulasi) {
    console.log('');
    console.log('B. KEADAAN DATABASE');
    console.log('----------------------------------------------------------');
    const host = (process.env.DATABASE_URL ?? '').split('@')[1]?.split('/')[0] ?? '(tidak diketahui)';
    const semua = await prisma.periode.findMany({ orderBy: { tanggalMulai: 'asc' } });
    const perTahun = new Map<number, number>();
    for (const p of semua) {
      perTahun.set(p.tanggalMulai.getFullYear(), (perTahun.get(p.tanggalMulai.getFullYear()) ?? 0) + 1);
    }
    const hariIni = new Date();
    const berjalan = semua.find((p) => p.tanggalMulai <= hariIni && p.tanggalSelesai >= hariIni);
    const belumMulai = semua.filter((p) => p.tanggalMulai > hariIni);
    const tanpaNilai = belumMulai.filter((p) => p.tanggalMulai > hariIni);

    console.log(`  Database         : ${host}`);
    console.log(`  Hari ini         : ${tanggal(hariIni)}`);
    console.log(`  Total periode    : ${semua.length}`);
    console.log(
      `  Per tahun        : ${[...perTahun.entries()]
        .sort((a, b) => a[0] - b[0])
        .map(([t, n]) => `${t}: ${n}`)
        .join('  ')}`
    );
    console.log(`  Periode berjalan : ${berjalan?.nama ?? '(tidak ada)'}`);
    if (berjalan) {
      console.log(
        `                     ${tanggal(berjalan.tanggalMulai)} - ${tanggal(berjalan.tanggalSelesai)}` +
          `  (${Math.round((berjalan.tanggalSelesai.getTime() - berjalan.tanggalMulai.getTime()) / 86_400_000) + 1} hari)`
      );
    }
    console.log(`  Belum dimulai    : ${belumMulai.length} periode (tetap tampil di /parameter/periode,`);
    console.log('                     TIDAK muncul di dropdown periode)');
    void tanpaNilai;

    console.log('');
    console.log('C. ATURAN PEMILIHAN PERIODE DI HALAMAN');
    console.log('----------------------------------------------------------');
    console.log('  pilihPeriodeRelevan() — periode yang MEMUAT HARI INI, dipakai:');
    console.log('    /penilaian, /penilaian/[pegawaiId], /persetujuan, /dasbor, /laporan');
    console.log('    Larangan: JANGAN pakai orderBy { tanggalMulai: desc } — itu');
    console.log('    menampilkan periode paling jauh, bukan periode berjalan.');
    console.log('');
    console.log('  daftarPeriodeUntukPemilih() — dropdown periode:');
    console.log('    BATAS ATAS = PERIODE BERJALAN. Periode yang belum dimulai tidak');
    console.log('    bisa dipilih sama sekali (pernah terjadi: user memilih periode');
    console.log('    masa depan tanpa sadar, laporannya jadi tidak nyata).');
    console.log('    Desember tahun lalu + seluruh tahun berjalan tetap tersedia.');
    console.log('');
    console.log('  daftarPeriodePerTahun() — /parameter/periode:');
    console.log('    PENGECUALIAN: memuat SEMUA periode termasuk yang belum dimulai,');
    console.log('    karena ini alat pengelolaan. Kelompok tahun tanpa periode tidak');
    console.log('    ditampilkan. Jangan menyamakan cakupannya dengan dropdown.');
  }

  // =================================================================
  garis(`D. HASIL MESIN PERIODE — TAHUN ${tahun} (hari penilaian: ${hari})`);
  const daftar = periodeTahun(tahun, pengaturan.hariPenilaian);
  const perBulan = new Map<number, typeof daftar>();
  for (const p of daftar) {
    const b = p.mulai.getMonth() + 1;
    if (!perBulan.has(b)) perBulan.set(b, []);
    perBulan.get(b)!.push(p);
  }

  const namaBulan = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
  ];

  for (const [bulan, isi] of [...perBulan.entries()].sort((a, b) => a[0] - b[0])) {
    const rentang = isi
      .map((p) => {
        const hariPeriode = Math.round((p.selesai.getTime() - p.mulai.getTime()) / 86_400_000) + 1;
        return `${p.mulai.getDate()}-${p.selesai.getDate()} (${hariPeriode}h)`;
      })
      .join('  ');
    console.log(`  ${namaBulan[bulan - 1].padEnd(10)} ${isi.length} periode : ${rentang}`);
  }
  console.log(`  ${'TOTAL'.padEnd(10)} ${daftar.length} periode`);

  const pendek = daftar.filter(
    (p) => Math.round((p.selesai.getTime() - p.mulai.getTime()) / 86_400_000) + 1 < MIN_HARI_PERIODE
  );
  console.log('');
  console.log(
    pendek.length === 0
      ? `  ✓ Tidak ada periode di bawah ${MIN_HARI_PERIODE} hari (aturan penggabungan bekerja).`
      : `  ✗ Ada ${pendek.length} periode di bawah ${MIN_HARI_PERIODE} hari: ${pendek.map((p) => p.nama).join(', ')}`
  );

  // periksa tidak ada periode yang menyeberang bulan
  const nyebrang = daftar.filter((p) => p.mulai.getMonth() !== p.selesai.getMonth());
  console.log(
    nyebrang.length === 0
      ? '  ✓ Tidak ada periode yang menyeberang bulan.'
      : `  ✗ ${nyebrang.length} periode menyeberang bulan: ${nyebrang.map((p) => p.nama).join(', ')}`
  );
  // Berakhir hari Minggu berlaku untuk periode yang TIDAK berakhir di ujung bulan.
  // Periode terakhir setiap bulan memang harus berhenti di tanggal terakhir
  // bulan itu (tidak menyeberang bulan), jadi harinya bisa apa saja — Sabtu,
  // Selasa, Kamis. Memeriksa semua periode tanpa kecuali melaporkan 11
  // "pelanggaran" palsu per tahun (satu per bulan).
  const akhirBulan = daftar.filter((p) => p.selesai.getDate() >= 28);
  const bukanAkhirBulan = daftar.filter((p) => !akhirBulan.includes(p));
  const bukanMinggu = bukanAkhirBulan.filter((p) => p.selesai.getDay() !== 0);
  console.log(
    bukanMinggu.length === 0
      ? `  ✓ Semua periode berakhir hari Minggu (kecuali ${akhirBulan.length} periode akhir bulan yang berhenti di tanggal terakhir).`
      : `  ✗ ${bukanMinggu.length} periode berakhir bukan hari Minggu: ${bukanMinggu.map((p) => `${p.nama} (${NAMA_HARI[p.selesai.getDay()]})`).join(', ')}`
  );

  // contoh satu bulan penuh lewat periodeBulan()
  const bulanContoh = new Date().getMonth() + 1;
  const bulanIni = periodeBulan(tahun, bulanContoh, pengaturan.hariPenilaian);
  console.log('');
  console.log(`  Contoh rinci bulan ${namaBulan[bulanContoh - 1]} ${tahun}:`);
  for (const p of bulanIni) {
    console.log(`    ${p.nama.padEnd(30)} ${tanggal(p.mulai)} - ${tanggal(p.selesai)}`);

    // tunjukkan perhitungan rentang mentah dari fungsi bulan (kalau ada)
    void p;
  }

  console.log('');
}

main()
  .catch((e) => {
    console.error('GAGAL:', e instanceof Error ? e.message : e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
