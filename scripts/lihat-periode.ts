import { periodeBulan } from '../src/lib/sip/periode';

const HARI = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];

const kasus: [number, number, string][] = [
  [2026, 10, 'Oktober'],
  [2026, 11, 'November'],
  [2026, 9, 'September'],
];

for (const [th, bl, label] of kasus) {
  console.log(`--- ${label} ${th} (hari penilaian Rabu) ---`);
  const tgl1 = new Date(th, bl - 1, 1);
  console.log(`  tgl 1 = ${HARI[tgl1.getDay()]} (getDay=${tgl1.getDay()})`);
  for (const p of periodeBulan(th, bl, 3)) {
    console.log(
      `  ${p.nama}: ${p.mulai.getDate()} ${HARI[p.mulai.getDay()]} – ` +
        `${p.selesai.getDate()} ${HARI[p.selesai.getDay()]}  [${p.jumlahHari} hari]`
    );
  }
  console.log();
}

console.log('=== Prakiraan: minggu di minggu yang memuat 1 Okt 2026 ===');
const t = new Date(2026, 9, 1);
const minggu = new Date(t);
minggu.setDate(minggu.getDate() + (6 - t.getDay()));
console.log(`  1 Okt 2026 = ${HARI[t.getDay()]}`);
console.log(`  Minggu di minggu itu = ${minggu.getDate()} ${HARI[minggu.getDay()]}`);
console.log(`  +7 hari = ${minggu.getDate() + 7}`);
