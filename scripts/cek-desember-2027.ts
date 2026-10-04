/**
 * Periksa kenapa "Minggu ke-5 Desember 2027" ada.
 * Jalankan: pnpm exec tsx scripts/cek-desember-2027.ts
 */
import { periodeBulan, AMBANG_BUANG_SISA, NAMA_HARI } from '../src/lib/sip/periode';

const HARI = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];

console.log('=== DESEMBER 2027 ===\n');
const t1 = new Date(2027, 11, 1);
console.log(`Tanggal 1 Desember 2027 = ${HARI[t1.getDay()]} (${NAMA_HARI[t1.getDay()]})`);
console.log(`Hari penilaian = Rabu\n`);

const daftar = periodeBulan(2027, 12, 3);
for (const p of daftar) {
  console.log(
    `  ${p.nama}: ${p.mulai.getDate()} ${HARI[p.mulai.getDay()]} – ` +
      `${p.selesai.getDate()} ${HARI[p.selesai.getDay()]}  [${p.jumlahHari} hari]`
  );
}

console.log(`\nBuang sisa ujung bulan: < ${AMBANG_BUANG_SISA} hari`);
console.log('\nMengapa Minggu ke-5 tidak digabung?');
const terakhir = daftar[daftar.length - 1];
console.log(`  periode terakhir: ${terakhir.jumlahHari} hari`);
console.log(
  `  ${terakhir.jumlahHari} hari (sisa ujung bulan)\n`
);

console.log('Kalau digabung, Minggu ke-4 akan jadi:');
const ke4 = daftar[daftar.length - 2];
const totalHari = ke4.jumlahHari + terakhir.jumlahHari;
console.log(
  `  ${ke4.mulai.getDate()} Des – ${terakhir.selesai.getDate()} Des = ${totalHari} hari`
);
console.log('  (aturan sekarang membatasi maksimal ~14 hari secara tidak langsung)');

console.log('\n=== RINGKASAN DESEMBER 2027 ===');
console.log(`  jumlah periode: ${daftar.length}`);
console.log(`  total hari: ${daftar.reduce((s, p) => s + p.jumlahHari, 0)} (Desember = 31 hari)`);
