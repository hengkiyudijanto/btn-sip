/**
 * Rancangan aturan periode v3 — definisi ulang dari pemilik aplikasi.
 *
 * ATURAN (3 Okt 2026):
 *   A. Satu pekan = MINGGU sampai SABTU.
 *   B. Batas bulan ditentukan oleh HARI RABU pekan itu:
 *        - Rabu masih bulan berjalan  → pekan itu milik bulan berjalan
 *        - Rabu sudah masuk bulan depan → pekan itu milik bulan depan
 *   C. Berarti pekan yang memuat tanggal 1 SELALU ikut bulan baru:
 *      Rabu-nya jatuh setelah tgl 1, jadi pasti bulan baru.
 *
 * Konsekuensinya (ini yang penting dipahami):
 *   - Ganti bulan SELALU di tengah pekan, tepat setelah Rabu.
 *   - Tiap bulan = blok utuh 4-5 pekan; pekan TIDAK PERNAH terpotong.
 *   - Pekan terakhir sebuah bulan bisa berakhir di tanggal 1-6 bulan berikutnya,
 *     dan pekan pertama bulan berikutnya mulai beberapa hari SEBELUM tanggal 1.
 *
 * Skrip ini hanya MENCETAK, tidak menyentuh database.
 *
 * Jalankan: pnpm exec tsx scripts/rancangan-periode.ts [tahun] [bulan-rinci]
 */
import { NAMA_HARI } from '../src/lib/sip/periode';

const NAMA_BULAN = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

type Pekan = { mulai: Date; selesai: Date; hari: number; rabu: Date };

function tambahHari(d: Date, n: number): Date {
  const s = new Date(d);
  s.setDate(s.getDate() + n);
  return s;
}

/** Minggu pada pekan yang memuat tanggal tersebut. */
function mingguPekan(tgl: Date): Date {
  return tambahHari(tgl, -((tgl.getDay() + 7) % 7));
}

function potong(bulan: number, tahun: number): Pekan[] {
  // Pekan pertama = pekan yang memuat tanggal 1 bulan & tahun ini.
  // Jangan memakai `new Date(tahun, bulan-1, 1)` sebagai titik awal pencarian
  // "minggu pekan" karena itu memakai data tanggal yang sudah dinormalkan;
  // cari mundur dari tanggal 1 secara eksplisit.
  const tgl1 = new Date(tahun, bulan - 1, 1);
  let cur = mingguPekan(tgl1);
  const hasil: Pekan[] = [];
  for (;;) {
    const sabtu = tambahHari(cur, 6);
    const rabu = tambahHari(cur, 3);
    // milik bulan ini jika Rabu-nya masih di bulan & tahun yang diminta
    const milik = rabu.getFullYear() === tahun && rabu.getMonth() === bulan - 1;
    if (!milik) break;
    hasil.push({ mulai: cur, selesai: sabtu, hari: 7, rabu });
    cur = tambahHari(cur, 7);
    // pengaman: jangan sampai berputar tanpa henti
    if (hasil.length > 8) break;
  }
  return hasil;
}

/** Tanggal 1 bulan berikutnya (untuk menampilkan batas). */
function bulanBerikutnya(bulan: number, tahun: number): { bulan: number; tahun: number } {
  return bulan === 12 ? { bulan: 1, tahun: tahun + 1 } : { bulan: bulan + 1, tahun };
}

function fmt(d: Date): string {
  return `${NAMA_HARI[d.getDay()]}, ${d.getDate()} ${NAMA_BULAN[d.getMonth()].slice(0, 3)}`;
}

function main() {
  const tahun = Number(process.argv[2] ?? new Date().getFullYear());
  const bulanRinci = Number(process.argv[3] ?? new Date().getMonth() + 1);

  console.log(`RANCANGAN ATURAN PERIODE v3 — ${tahun}`);
  console.log('='.repeat(80));
  console.log('A. Satu pekan = Minggu sampai Sabtu.');
  console.log('B. Batas bulan ditentukan oleh HARI RABU pekan itu:');
  console.log('   - Rabu masih bulan berjalan  → pekan milik bulan berjalan');
  console.log('   - Rabu sudah bulan depan     → pekan milik bulan depan');
  console.log('C. Pekan yang memuat tanggal 1 selalu ikut bulan baru.');
  console.log('');
  console.log('Akibatnya: ganti bulan selalu di tengah pekan (setelah Rabu),');
  console.log('tiap bulan = 4-5 pekan utuh, TIDAK ada pekan yang dipotong.');
  console.log('');

  let total = 0;
  for (let b = 1; b <= 12; b++) {
    const per = potong(b, tahun);
    total += per.length;
    const rentang = per.map((p) => `${p.mulai.getDate()}-${p.selesai.getDate()}`).join('  ');
    const nyebrang = per.filter((p) => p.mulai.getMonth() !== p.selesai.getMonth() || p.selesai.getMonth() !== b - 1).length;
    console.log(
      `${NAMA_BULAN[b - 1].padEnd(10)} ${per.length} pekan  ${rentang.padEnd(46)}${nyebrang ? `(${nyebrang} pekan menyeberang bulan)` : ''}`
    );
  }
  console.log('');
  console.log(`TOTAL: ${total} pekan setahun`);

  // ===== rincian satu bulan =====
  console.log('');
  const nex = bulanBerikutnya(bulanRinci, tahun);
  console.log(`RINCIAN ${NAMA_BULAN[bulanRinci - 1].toUpperCase()} ${tahun}`);
  console.log(`(bulan berikutnya: ${NAMA_BULAN[nex.bulan - 1]} ${nex.tahun})`);
  console.log('-'.repeat(80));
  for (const [i, p] of potong(bulanRinci, tahun).entries()) {
    const keBulanLain = p.selesai.getMonth() !== bulanRinci - 1;
    console.log(
      `  Minggu ke-${i + 1}  ${fmt(p.mulai)}  –  ${fmt(p.selesai)}   ` +
        `(Rabu pekan ini: ${p.rabu.getDate()} ${NAMA_BULAN[p.rabu.getMonth()].slice(0, 3)})` +
        (keBulanLain ? '  ← berakhir di bulan berikutnya' : '')
    );
  }

  // ===== contoh pekan yang menyeberang bulan =====
  console.log('');
  console.log('CONTOH PEKAN YANG MENYEBERANG BULAN (sepanjang tahun):');
  for (let b = 1; b <= 12; b++) {
    for (const p of potong(b, tahun)) {
      if (p.mulai.getMonth() !== p.selesai.getMonth()) {
        const rabuBulan = NAMA_BULAN[p.rabu.getMonth()];
        const akhirBulan = NAMA_BULAN[p.selesai.getMonth()];
        const pemilik = p.rabu.getMonth() === p.mulai.getMonth() ? NAMA_BULAN[p.mulai.getMonth()] : akhirBulan;
        console.log(
          `  ${p.mulai.getDate()} ${NAMA_BULAN[p.mulai.getMonth()].slice(0, 3)} – ${p.selesai.getDate()} ${akhirBulan.slice(0, 3)}` +
            `  | Rabu = ${p.rabu.getDate()} ${rabuBulan.slice(0, 3)} → milik ${pemilik}`
        );
      }
    }
  }
}

main();
