/**
 * Uji aturan usulan v4 + keputusan pemilik aplikasi (3 Okt 2026):
 *
 *   A. Satu pekan = MINGGU sampai SABTU.
 *   B. Sisa 1-3 hari di ujung bulan (berakhir Minggu/Senin/Selasa) DIBUANG ke
 *      pekan sebelumnya → bulan berakhir tepat di Sabtu.
 *      Sisa 4-6 hari menjadi pekan TERSENDIRI.
 *   C. Awal bulan:
 *        - tgl 1 hari KAMIS  → Kamis-Sabtu digabung ke pekan berikutnya
 *        - tgl 1 hari RABU   → pekan TERSENDIRI (Rabu-Sabtu), karena pekan
 *          berikutnya tetap punya hari penilaian Rabu sendiri
 *        - tgl 1 hari lain   → pekan-1 = tgl 1 sampai Sabtu
 *   D. tgl 1 hari MINGGU → pekan-1 tepat 7 hari (Minggu-Sabtu).
 *
 * Skrip ini hanya MENCETAK. Tidak menyentuh database.
 *
 * Jalankan: pnpm exec tsx scripts/rancangan-periode-v4.ts [tahun] [bulan-rinci]
 */
import { NAMA_HARI } from '../src/lib/sip/periode';

const NAMA_BULAN = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

type Pekan = { mulai: Date; selesai: Date; hari: number; catatan: string };

const MINGGU = 0;
const RABU = 3;
const KAMIS = 4;
const SABTU = 6;

function tambah(d: Date, n: number): Date {
  const s = new Date(d);
  s.setDate(s.getDate() + n);
  return s;
}

function jumlahHariBulan(tahun: number, bulan: number): number {
  return new Date(tahun, bulan, 0).getDate();
}

/** Aturan usulan: buang sisa 1-3 hari; Rabu/Kamis di awal bulan diperlakukan khusus. */
export function potongBulan(tahun: number, bulan: number): Pekan[] {
  const akhirBulan = new Date(tahun, bulan - 1, jumlahHariBulan(tahun, bulan));
  const tgl1 = new Date(tahun, bulan - 1, 1);
  const hasil: Pekan[] = [];

  // ===== B: sisa di ujung bulan =====
  // Sabtu terakhir yang masih di dalam bulan ini.
  const geserKeSabtu = akhirBulan.getDay() === SABTU ? 0 : (akhirBulan.getDay() + 1) % 7;
  const sabtuTerakhir = tambah(akhirBulan, -geserKeSabtu);
  const sisa = Math.round((akhirBulan.getTime() - sabtuTerakhir.getTime()) / 86_400_000);
  // sisa 1-3 hari (berakhir Minggu/Senin/Selasa) → dibuang ke pekan sebelumnya
  const akhirEfektif = sisa >= 1 && sisa <= 3 ? sabtuTerakhir : new Date(akhirBulan);

  // ===== C & D: bagian awal bulan =====
  let mulai = new Date(tgl1);
  let catatanAwal = '';

  if (tgl1.getDay() === MINGGU) {
    // D: pekan-1 Minggu-Sabtu penuh, tidak ada perlakuan khusus
  } else if (tgl1.getDay() === KAMIS) {
    // C: Kamis-Sabtu digabung ke pekan berikutnya
    const sabtuAwal = tambah(tgl1, 2);
    mulai = tambah(sabtuAwal, 1); // Minggu berikutnya
    catatanAwal = `pekan-1 = ${tgl1.getDate()}-${sabtuAwal.getDate()} ${NAMA_BULAN[bulan - 1].slice(0, 3)} (Kamis-Sabtu) digabung ke pekan ini`;
  } else if (tgl1.getDay() === RABU) {
    // C khusus: Rabu-Sabtu jadi pekan tersendiri karena pekan berikutnya
    // tetap punya hari penilaian Rabu sendiri.
    const sabtuAwal = tambah(tgl1, 3);
    hasil.push({
      mulai: new Date(tgl1),
      selesai: sabtuAwal,
      hari: 4,
      catatan: 'pekan tersendiri (Rabu-Sabtu) — pekan depan punya Rabu sendiri',
    });
    mulai = tambah(sabtuAwal, 1);
  } else if (tgl1.getDay() === KAMIS + 1 || tgl1.getDay() === KAMIS + 2) {
    // KEPUTUSAN PEMILIK APLIKASI: tgl 1 hari Jumat atau Sabtu — yaitu hari
    // SETELAH Rabu — digabung ke pekan DEPANNYA, karena penilaian dilakukan
    // pada hari Rabu dan pekan berikutnya punya Rabu sendiri.
    const sabtuAwal = tambah(tgl1, (SABTU - tgl1.getDay() + 7) % 7);
    mulai = tambah(sabtuAwal, 1); // lompat ke Minggu berikutnya
    catatanAwal = `pekan-1 = ${tgl1.getDate()}-${sabtuAwal.getDate()} ${NAMA_BULAN[bulan - 1].slice(0, 3)} (${NAMA_HARI[tgl1.getDay()]}-Sabtu) digabung ke pekan ini`;
  } else {
    // tgl 1 hari lain: pekan-1 = tgl 1 sampai Sabtu
    const sabtuAwal = tambah(tgl1, (SABTU - tgl1.getDay() + 7) % 7);
    hasil.push({
      mulai: new Date(tgl1),
      selesai: sabtuAwal,
      hari: Math.round((sabtuAwal.getTime() - tgl1.getTime()) / 86_400_000) + 1,
      catatan: `pekan-1 mulai tgl 1 (${NAMA_HARI[tgl1.getDay()]})`,
    });
    mulai = tambah(sabtuAwal, 1);
  }

  // ===== pekan lanjutan =====
  while (mulai <= akhirEfektif) {
    const sabtu = tambah(mulai, 6);
    const selesai = sabtu > akhirEfektif ? new Date(akhirEfektif) : sabtu;
    hasil.push({
      mulai: new Date(mulai),
      selesai,
      hari: Math.round((selesai.getTime() - mulai.getTime()) / 86_400_000) + 1,
      catatan:
        catatanAwal ||
        (selesai.getDay() === SABTU ? 'Minggu–Sabtu penuh' : 'sisa 4-6 hari (pekan tersendiri)'),
    });
    catatanAwal = '';
    const next = tambah(selesai, 1);
    if (next > akhirEfektif) break;
    mulai = next;
  }

  return hasil;
}

function fmt(d: Date): string {
  return `${d.getDate()} ${NAMA_BULAN[d.getMonth()].slice(0, 3)}`;
}

function main() {
  const tahun = Number(process.argv[2] ?? new Date().getFullYear());
  const bulanRinci = Number(process.argv[3] ?? new Date().getMonth() + 1);

  console.log(`ATURAN v4 — ${tahun}`);
  console.log('='.repeat(92));
  console.log('A. Pekan = Minggu–Sabtu');
  console.log('B. Sisa 1-3 hari di ujung bulan → dibuang ke pekan sebelumnya');
  console.log('   Sisa 4-6 hari → pekan tersendiri');
  console.log('C. Tgl 1 Kamis → digabung ke pekan berikutnya');
  console.log('   Tgl 1 Rabu  → pekan tersendiri (Rabu–Sabtu)');
  console.log('   Tgl 1 lainnya → pekan-1 = tgl 1 sampai Sabtu');
  console.log('');

  let total = 0;
  for (let b = 1; b <= 12; b++) {
    const per = potongBulan(tahun, b);
    total += per.length;
    const tgl1 = new Date(tahun, b - 1, 1);
    const teks = per
      .map((p) => `${p.mulai.getDate()}-${p.selesai.getDate()}${p.hari !== 7 ? `(${p.hari}h)` : ''}`)
      .join('  ');
    console.log(
      `${NAMA_BULAN[b - 1].padEnd(10)} tgl1=${NAMA_HARI[tgl1.getDay()].padEnd(6)} ${per.length} pekan  ${teks}`
    );
  }
  console.log('');
  console.log(`TOTAL: ${total} pekan setahun   (Nh) = pekan bukan 7 hari`);
  console.log('');

  console.log(`RINCIAN ${NAMA_BULAN[bulanRinci - 1].toUpperCase()} ${tahun}`);
  console.log('-'.repeat(92));
  for (const [i, p] of potongBulan(tahun, bulanRinci).entries()) {
    console.log(
      `  Pekan ke-${i + 1}  ${fmt(p.mulai)} – ${fmt(p.selesai)}  ` +
        `(${NAMA_HARI[p.mulai.getDay()]}→${NAMA_HARI[p.selesai.getDay()]}, ${p.hari} hari)  ${p.catatan}`
    );
  }
  console.log('');

  let lintas = 0;
  let pendek = 0;
  let totalHari = 0;
  const daftarPendek: string[] = [];
  for (let b = 1; b <= 12; b++) {
    for (const p of potongBulan(tahun, b)) {
      if (p.mulai.getMonth() !== p.selesai.getMonth()) lintas++;
      if (p.hari < 5) {
        pendek++;
        daftarPendek.push(`${NAMA_BULAN[b - 1]} ${p.mulai.getDate()}-${p.selesai.getDate()} (${p.hari}h)`);
      }
      totalHari += p.hari;
    }
  }
  console.log('PEMERIKSAAN:');
  console.log(`  pekan menyeberang bulan : ${lintas} ${lintas === 0 ? '✓' : '✗'}`);
  console.log(`  pekan < 5 hari          : ${pendek} ${pendek === 0 ? '✓' : ''}`);
  for (const d of daftarPendek) console.log(`      - ${d}`);
  console.log(`  total hari tercakup     : ${totalHari} dari 365 (selisih = sisa yang dibuang)`);
}

main();
