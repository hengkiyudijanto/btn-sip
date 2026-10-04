/**
 * Tampilkan simulasi periode setahun penuh untuk diperiksa manusia.
 *
 * Jalankan:
 *   pnpm exec tsx scripts/simulasi-periode.ts              # tahun ini, Rabu
 *   pnpm exec tsx scripts/simulasi-periode.ts 2026 3       # 2026, hari penilaian Rabu
 *   pnpm exec tsx scripts/simulasi-periode.ts 2027 1       # 2027, hari penilaian Senin
 */
import { periodeBulan, NAMA_HARI, AMBANG_BUANG_SISA } from '../src/lib/sip/periode';

const arg = process.argv.slice(2);
const tahun = Number(arg[0]) || new Date().getFullYear();
const hariPenilaian = arg[1] !== undefined ? Number(arg[1]) : 3;

const NAMA_BULAN = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];
const SINGKAT = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];

console.log('='.repeat(72));
console.log(`SIMULASI PERIODE PENILAIAN ${tahun}`);
console.log(`Hari penilaian: ${NAMA_HARI[hariPenilaian]}`);
console.log(`Buang sisa ujung bulan: < ${AMBANG_BUANG_SISA} hari`);
console.log('='.repeat(72));
console.log();

let total = 0;
for (let b = 1; b <= 12; b++) {
  const daftar = periodeBulan(tahun, b, hariPenilaian);
  total += daftar.length;
  const tgl1 = new Date(tahun, b - 1, 1);
  console.log(
    `${NAMA_BULAN[b - 1].toUpperCase()} ${tahun}  ` +
      `(tgl 1 = ${SINGKAT[tgl1.getDay()]})  —  ${daftar.length} periode`
  );
  for (const p of daftar) {
    const hari = `${p.jumlahHari} hari`.padStart(7);
    console.log(
      `  ${p.nama.padEnd(28)} ${String(p.mulai.getDate()).padStart(2)} ${SINGKAT[p.mulai.getDay()]}` +
        ` – ${String(p.selesai.getDate()).padStart(2)} ${SINGKAT[p.selesai.getDay()]}   ${hari}`
    );
  }
  console.log();
}

console.log('='.repeat(72));
console.log(`TOTAL ${tahun}: ${total} periode`);
console.log('='.repeat(72));
