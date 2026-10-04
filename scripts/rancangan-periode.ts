/**
 * Rancangan aturan periode v2 — untuk PERSETUJUAN, bukan dipakai produksi.
 *
 * Aturan yang diusulkan pemilik aplikasi (2 Okt 2026):
 *
 *   A. Tanggal 1 selalu menjadi awal pekan.
 *   B. Satu pekan = MINGGU sampai SABTU.
 *   C. Kalau akhir bulan jatuh SEBELUM atau TEPAT hari penilaian (Rabu),
 *      maka sampai hari itu menjadi pekan SEBELUMNYA.
 *   D. Kalau awal bulan (tgl 1) jatuh pada hari penilaian (Rabu) atau hari
 *      sebelum Minggu (Senin–Sabtu, jadi bukan Minggu), maka dari tanggal
 *      itu sampai Sabtu minggu depannya menjadi pekan 1.
 *
 * Cara membaca C dan D tanpa saling meniadakan:
 *   - D menentukan BATAS AKHIR pekan-1: Sabtu di minggu depannya.
 *   - C menentukan KAPAN seluruh periode digeser: kalau sisa hari di ujung
 *     bulan hanya sampai hari penilaian, periode terakhir bulan itu
 *     berhenti di situ.
 *
 * Skrip ini hanya MENCETAK hasil, tidak menyentuh database.
 *
 * Jalankan: pnpm exec tsx scripts/rancangan-periode.ts [tahun]
 */
import { NAMA_HARI } from '../src/lib/sip/periode';

const NAMA_BULAN = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

/** 0=Minggu, 1=Senin, ... 6=Sabtu */
const HARI_PENILAIAN = 3; // Rabu

/** Pekan yang lebih pendek dari ini digabung ke pekan tetangganya. */
const MIN_HARI_PERIODE = 5;

type Periode = { mulai: Date; selesai: Date; hari: number; sumber: string };

function jumlahHariBulan(tahun: number, bulan: number): number {
  return new Date(tahun, bulan, 0).getDate();
}

function selisihHari(a: Date, b: Date): number {
  const A = new Date(a.getFullYear(), a.getMonth(), a.getDate()).getTime();
  const B = new Date(b.getFullYear(), b.getMonth(), b.getDate()).getTime();
  return Math.round((B - A) / 86_400_000);
}

function tambahHari(d: Date, n: number): Date {
  const s = new Date(d);
  s.setDate(s.getDate() + n);
  return s;
}

/** Sabtu pada minggu yang memuat tanggal tersebut (Minggu=0 … Sabtu=6). */
function sabtuMingguItu(tgl: Date): Date {
  const jarakKeSabtu = (6 - tgl.getDay() + 7) % 7;
  return tambahHari(tgl, jarakKeSabtu);
}

/**
 * Hitung periode satu bulan menurut aturan yang diusulkan.
 * Mengembalikan periode + catatan aturan mana yang dipakai.
 */
function periodeBulan(
  tahun: number,
  bulan: number,
  hariPenilaian: number = HARI_PENILAIAN
): Periode[] {
  const akhirBulan = new Date(tahun, bulan - 1, jumlahHariBulan(tahun, bulan));
  const awal = new Date(tahun, bulan - 1, 1);
  const potongan: Periode[] = [];

  const posisi = awal.getDay();
  // D: tgl 1 = hari penilaian, atau Senin..Sabtu (semua hari sebelum Minggu).
  //    Kalau tgl 1 jatuh Minggu, tidak termasuk → pekan-1 normal.
  const pakaiAturanD = posisi === hariPenilaian || (posisi >= 1 && posisi <= 6);

  let akhirPertama: Date;
  let sumber: string;
  if (pakaiAturanD) {
    // Sabtu di minggu DEPANNYA
    akhirPertama = tambahHari(sabtuMingguItu(awal), 7);
    sumber = `D (1 ${NAMA_HARI[posisi]} → Sabtu minggu depan)`;
  } else {
    // tgl 1 hari Minggu → pekan-1 = minggu itu sampai Sabtu
    akhirPertama = sabtuMingguItu(awal);
    sumber = `awal bulan hari Minggu (7 hari)`;
  }
  if (akhirPertama > akhirBulan) akhirPertama = new Date(akhirBulan);

  let mulai = new Date(awal);
  let akhir = new Date(akhirPertama);
  while (mulai <= akhirBulan) {
    const selesai = akhir > akhirBulan ? new Date(akhirBulan) : new Date(akhir);
    potongan.push({
      mulai: new Date(mulai),
      selesai,
      hari: selisihHari(mulai, selesai) + 1,
      sumber,
    });
    sumber = 'pekan lanjutan (Minggu–Sabtu)';

    const berikutnya = tambahHari(selesai, 1);
    if (berikutnya > akhirBulan) break;
    mulai = berikutnya;
    akhir = sabtuMingguItu(mulai);
  }

  // Penggabungan pekan pendek (opsi A yang dipilih pemilik aplikasi):
  // pekan yang lebih pendek dari MIN_HARI_PERIODE digabung —
  //   di AWAL bulan  → ke pekan BERIKUTNYA
  //   di AKHIR bulan → ke pekan SEBELUMNYA
  // Kasus nyata: 31 Mei 2026 jatuh Minggu, tidak kena aturan D, jadi pekan
  // terakhir bulan itu hanya 1 hari → digabung ke pekan sebelumnya.
  if (potongan.length >= 2) {
    const pertama = potongan[0];
    if (pertama.hari < MIN_HARI_PERIODE) {
      potongan[1].mulai = new Date(pertama.mulai);
      potongan[1].hari = selisihHari(potongan[1].mulai, potongan[1].selesai) + 1;
      potongan[1].sumber = 'gabungan awal bulan';
      potongan.shift();
    }
  }
  if (potongan.length >= 2) {
    const ter = potongan[potongan.length - 1];
    if (ter.hari < MIN_HARI_PERIODE) {
      potongan[potongan.length - 2].selesai = new Date(ter.selesai);
      potongan[potongan.length - 2].hari =
        selisihHari(potongan[potongan.length - 2].mulai, ter.selesai) + 1;
      potongan[potongan.length - 2].sumber = 'gabungan akhir bulan';
      potongan.pop();
    }
  }

  // C: kalau periode terakhir berakhir SEBELUM atau TEPAT hari penilaian
  //    → berhenti di hari penilaian, sisanya masuk periode sebelumnya.
  const terakhir = potongan[potongan.length - 1];
  if (terakhir.selesai.getDay() < hariPenilaian && potongan.length >= 2) {
    // hari penilaian terakhir yang masih di dalam bulan ini
    let hariPenilaianTerakhir = new Date(akhirBulan);
    while (hariPenilaianTerakhir.getDay() !== hariPenilaian) {
      hariPenilaianTerakhir = tambahHari(hariPenilaianTerakhir, -1);
    }
    if (hariPenilaianTerakhir >= terakhir.mulai && hariPenilaianTerakhir <= terakhir.selesai) {
      potongan[potongan.length - 1].selesai = new Date(hariPenilaianTerakhir);
      potongan[potongan.length - 1].hari =
        selisihHari(potongan[potongan.length - 1].mulai, hariPenilaianTerakhir) + 1;
      potongan[potongan.length - 1].sumber = `C (berhenti di hari penilaian)`;
    }
  }

  return potongan;
}

function main() {
  const tahun = Number(process.argv[2] ?? new Date().getFullYear());
  const hari = NAMA_HARI[HARI_PENILAIAN];

  console.log(`RANCANGAN ATURAN PERIODE v2 — ${tahun} (hari penilaian: ${hari})`);
  console.log('='.repeat(78));
  console.log('A. Tanggal 1 selalu awal pekan   B. Pekan = Minggu sampai Sabtu');
  console.log('C. Akhir bulan ≤ hari penilaian  → sampai hari itu pekan sebelumnya');
  console.log('D. Tgl 1 = hari penilaian / bukan Minggu → pekan-1 sampai Sabtu minggu depan');
  console.log('');

  let total = 0;
  for (let b = 1; b <= 12; b++) {
    const per = periodeBulan(tahun, b);
    total += per.length;
    const teks = per
      .map((p) => {
        const m = p.mulai.getDate();
        const s = p.selesai.getDate();
        const tanda = p.sumber.startsWith('C') ? '*' : '';
        return `${m}-${s}${tanda}`;
      })
      .join('  ');
    const awalTgl = new Date(tahun, b - 1, 1);
    console.log(
      `${NAMA_BULAN[b - 1].padEnd(10)} ${per.length} pekan  tgl1=${NAMA_HARI[awalTgl.getDay()].padEnd(6)} ${teks}`
    );
  }
  console.log('');
  console.log(`TOTAL: ${total} pekan setahun   (* = periode dipotong di hari penilaian / aturan C)`);
  console.log('');
  console.log('Perbandingan dengan aturan LAMA untuk bulan yang sama:');
  console.log('  aturan lama: akhir pekan hari Minggu, tgl 1 bisa jadi pekan panjang');
  console.log('  aturan baru: pekan Minggu–Sabtu, tgl 1 selalu di awal pekan');
  console.log('');

  // rincian untuk memeriksa bulan tertentu
  const bulanRinci = Number(process.argv[3] ?? 10);
  console.log(`RINCIAN ${NAMA_BULAN[bulanRinci - 1]} ${tahun}:`);
  for (const [i, p] of periodeBulan(tahun, bulanRinci).entries()) {
    const mulaiHari = NAMA_HARI[p.mulai.getDay()];
    const selesaiHari = NAMA_HARI[p.selesai.getDay()];
    console.log(
      `  Minggu ke-${i + 1}  ${String(p.mulai.getDate()).padStart(2)} ${NAMA_BULAN[bulanRinci - 1].slice(0, 3)}` +
        ` – ${String(p.selesai.getDate()).padStart(2)} ${NAMA_BULAN[bulanRinci - 1].slice(0, 3)}` +
        `  (${mulaiHari} → ${selesaiHari}, ${p.hari} hari)   [${p.sumber}]`
    );
  }
}

main();
