/**
 * Bandingkan periode LAMA (di database) dengan periode menurut aturan MESIN
 * SEKARANG untuk rentang yang sama.
 *
 * Dipakai sebagai langkah AMAN sebelum mengganti periode produksi: lihat dulu
 * apa yang akan berubah, terutama periode yang sudah punya penilaian.
 *
 * Jalankan:
 *   pnpm exec tsx scripts/banding-periode-aturan.ts              # tahun berjalan
 *   pnpm exec tsx scripts/banding-periode-aturan.ts 2026 2025    # rentang tahun
 *   pnpm exec tsx scripts/banding-periode-aturan.ts 2026 2025 --ganti
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { ambilPengaturan } from '../src/lib/sip/pengaturan';
import { periodeBulan, jumlahHariBulan, selisihHari, NAMA_HARI } from '../src/lib/sip/periode';

const GANTI = process.argv.includes('--ganti');
const tahunArg = process.argv.filter((a) => /^\d{4}$/.test(a)).map(Number);
const tahunDari = Math.min(...(tahunArg.length ? tahunArg : [new Date().getFullYear()]));
const tahunSampai = Math.max(...(tahunArg.length ? tahunArg : [new Date().getFullYear()]));

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

function d(d: Date): string {
  return d.toISOString().slice(0, 10);
}

async function main() {
  const { hariPenilaian } = await ambilPengaturan();
  const host = (process.env.DATABASE_URL ?? '').split('@')[1]?.split('/')[0];
  console.log(`Database        : ${host}`);
  console.log(`Hari penilaian  : ${NAMA_HARI[hariPenilaian]}`);
  console.log(`Rentang tahun   : ${tahunDari} – ${tahunSampai}`);
  console.log(`Mode            : ${GANTI ? 'GANTI (menulis ke database)' : 'hanya membandingkan'}`);
  console.log('');

  const lama = await prisma.periode.findMany({
    where: { tanggalMulai: { gte: new Date(tahunDari, 0, 1), lte: new Date(tahunSampai, 11, 31) } },
    include: {
      penilaian: { select: { id: true, nilaiAkhir: true, status: true, pegawai: { select: { nip: true, nama: true } } } },
    },
    orderBy: { tanggalMulai: 'asc' },
  });

  let sama = 0;
  let beda = 0;
  let tanpaPenilaian = 0;
  const ringkasanBulan: string[] = [];
  const terdampak: { nama: string; penilaian: number; dari: string; jadi: string }[] = [];

  for (let tahun = tahunDari; tahun <= tahunSampai; tahun++) {
    for (let bulan = 1; bulan <= 12; bulan++) {
      const baru = periodeBulan(tahun, bulan, hariPenilaian);
      const lamaBulan = lama
        .filter((p) => p.tanggalMulai.getFullYear() === tahun && p.tanggalMulai.getMonth() === bulan - 1)
        .sort((a, b) => a.tanggalMulai.getTime() - b.tanggalMulai.getTime());

      if (lamaBulan.length === 0 && baru.length === 0) continue;

      const samaSemua =
        lamaBulan.length === baru.length &&
        lamaBulan.every(
          (p, i) => d(p.tanggalMulai) === d(baru[i].mulai) && d(p.tanggalSelesai) === d(baru[i].selesai)
        );

      if (samaSemua) {
        sama++;
        continue;
      }

      beda++;
      const lamaTeks = lamaBulan.map((p) => `${p.tanggalMulai.getDate()}-${p.tanggalSelesai.getDate()}`).join(' ');
      const baruTeks = baru.map((p) => `${p.mulai.getDate()}-${p.selesai.getDate()}`).join(' ');
      ringkasanBulan.push(
        `  ${String(tahun)}-${String(bulan).padStart(2, '0')}  lama(${lamaBulan.length}): ${lamaTeks.padEnd(34)} baru(${baru.length}): ${baruTeks}`
      );

      // periode lama yang sudah punya penilaian = wajib dilaporkan
      for (const p of lamaBulan) {
        if (p.penilaian.length > 0) {
          const cocok = baru.find((b) => b.mulai <= p.tanggalMulai && p.tanggalMulai <= b.selesai);
          terdampak.push({
            nama: p.nama,
            penilaian: p.penilaian.length,
            dari: `${d(p.tanggalMulai)} – ${d(p.tanggalSelesai)}`,
            jadi: cocok ? `${d(cocok.mulai)} – ${d(cocok.selesai)} (${cocok.nama})` : '(tidak ada padanan)',
          });
        }
      }
    }
  }

  // periode lama di rentang ini yang tidak punya penilaian (informasi)
  tanpaPenilaian = lama.filter((p) => p.penilaian.length === 0).length;

  console.log(`Bulan dengan susunan periode BERUBAH: ${beda}`);
  console.log(`Bulan yang sama antara lama & baru   : ${sama}`);
  console.log('');
  if (ringkasanBulan.length > 0) {
    console.log('Rincian perubahan:');
    for (const r of ringkasanBulan) console.log(r);
    console.log('');
  }

  console.log(`Periode lama di rentang ini TANPA penilaian: ${tanpaPenilaian}`);
  if (terdampak.length > 0) {
    console.log('');
    console.log('!! PERIODE YANG SUDAH PUNYA PENILAIAN dan tanggalnya bergeser:');
    for (const t of terdampak) {
      console.log(`   ${t.nama} (${t.penilaian} penilaian)  ${t.dari}`);
      console.log(`      → akan jadi: ${t.jadi}`);
    }
  } else {
    console.log('Tidak ada periode ber-penilaian yang tanggalnya bergeser.');
  }

  // ===== thitung total & perbandingan jumlah =====
  console.log('');
  let totalLama = 0;
  let totalBaru = 0;
  for (let tahun = tahunDari; tahun <= tahunSampai; tahun++) {
    for (let bulan = 1; bulan <= 12; bulan++) {
      totalBaru += periodeBulan(tahun, bulan, hariPenilaian).length;
    }
  }
  totalLama = lama.length;
  console.log(`Jumlah periode di database (rentang ini) : ${totalLama}`);
  console.log(`Jumlah periode menurut aturan baru       : ${totalBaru}`);

  if (!GANTI) {
    console.log('');
    console.log('(hanya membandingkan — tambahkan --ganti untuk menulis ke database)');
    return;
  }

  console.log('');
  console.log('Mengganti periode menurut aturan baru...');
  let dibuat = 0;
  let dilewati = 0;
  let dihapus = 0;

  for (let tahun = tahunDari; tahun <= tahunSampai; tahun++) {
    for (let bulan = 1; bulan <= 12; bulan++) {
      const baru = periodeBulan(tahun, bulan, hariPenilaian);
      for (const p of baru) {
        const ada = await prisma.periode.findFirst({
          where: { tanggalMulai: p.mulai, tanggalSelesai: p.selesai },
        });
        if (ada) {
          dilewati++;
          continue;
        }
        // kode unik kalau bentrok
        let kode = p.kode;
        let n = 2;
        while (await prisma.periode.findUnique({ where: { kode }, select: { id: true } })) {
          kode = `${p.kode}-${n}`;
          n++;
        }
        await prisma.periode.create({
          data: { kode, nama: p.nama, tanggalMulai: p.mulai, tanggalSelesai: p.selesai, aktif: true },
        });
        dibuat++;
      }
    }
  }

  // hapus periode lama pada rentang ini yang TIDAK dipakai penilaian
  const sisa = await prisma.periode.findMany({
    where: {
      tanggalMulai: { gte: new Date(tahunDari, 0, 1), lte: new Date(tahunSampai, 11, 31) },
      penilaian: { none: {} },
    },
    select: { id: true },
  });
  const hapus = await prisma.periode.deleteMany({ where: { id: { in: sisa.map((p) => p.id) } } });
  dihapus = hapus.count;

  console.log(`  dibuat : ${dibuat}`);
  console.log(`  dilewati (sudah ada): ${dilewati}`);
  console.log(`  dihapus (lama, tanpa penilaian): ${dihapus}`);

  const sisaBerpenilaian = await prisma.periode.count({
    where: {
      tanggalMulai: { gte: new Date(tahunDari, 0, 1), lte: new Date(tahunSampai, 11, 31) },
      penilaian: { some: {} },
    },
  });
  console.log(`  periode yang masih memuat penilaian: ${sisaBerpenilaian} (tidak dihapus)`);
}

main()
  .catch((e) => {
    console.error('GAGAL:', e instanceof Error ? e.message : e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

void selisihHari;
void jumlahHariBulan;
