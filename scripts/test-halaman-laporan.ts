/**
 * Uji halaman laporan lewat HTTP dengan sesi login nyata.
 * Membuat sesi langsung di database (jalur yang sama dengan aplikasi),
 * lalu memanggil halaman laporan memakai cookie tersebut.
 *
 * Jalankan: pnpm exec tsx scripts/test-halaman-laporan.ts
 */
import 'dotenv/config';
import crypto from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const BASE = process.env.BASE_URL ?? 'http://localhost:3100';
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

function hashToken(t: string) {
  return crypto.createHash('sha256').update(t).digest('hex');
}

async function buatSesi(nip: string) {
  const pegawai = await prisma.pegawai.findUnique({ where: { nip } });
  if (!pegawai) throw new Error(`Pegawai ${nip} tidak ditemukan`);

  const token = crypto.randomBytes(32).toString('base64url');
  await prisma.sesi.create({
    data: {
      tokenHash: hashToken(token),
      pegawaiId: pegawai.id,
      expiresAt: new Date(Date.now() + 3600_000),
    },
  });
  return { token, pegawai };
}

async function get(url: string, token: string) {
  const res = await fetch(url, {
    headers: { cookie: `sip_sesi=${token}` },
    redirect: 'manual',
  });
  const html = await res.text();
  return { status: res.status, html, lokasi: res.headers.get('location') };
}

async function main() {
  console.log('=== UJI HALAMAN LAPORAN (HTTP) ===\n');

  const { token, pegawai } = await buatSesi('90000001');
  console.log(`Sesi dibuat untuk: ${pegawai.nama} (${pegawai.role})\n`);

  // 1. Halaman daftar laporan
  const r1 = await get(`${BASE}/laporan`, token);
  console.log(`1. /laporan                    → ${r1.status}`);
  cek(r1.html.includes('Laporan'), 'judul "Laporan" ada');
  cek(r1.html.includes('Andi Pratama'), 'petugas "Andi Pratama" tampil');
  cek(r1.html.includes('Siti Nurhaliza'), 'petugas "Siti Nurhaliza" tampil');
  cek(r1.html.includes('Budi Santoso'), 'petugas "Budi Santoso" tampil');
  cek(r1.html.includes('Rata-rata'), 'kartu rekap rata-rata ada');
  cek(r1.html.includes('Istimewa'), 'badge rating Istimewa ada');
  cek(r1.html.includes('5,00'), 'nilai format Indonesia (5,00) ada');

  // 2. Ambil id penilaian dari database
  const penilaian = await prisma.penilaian.findFirst({
    where: { pegawai: { nip: '80000001' } },
    select: { id: true },
  });
  if (!penilaian) throw new Error('Penilaian demo tidak ditemukan');

  // 3. Halaman cetak laporan
  const r2 = await get(`${BASE}/laporan/${penilaian.id}`, token);
  console.log(`\n2. /laporan/[id]               → ${r2.status}`);
  cek(r2.html.includes('SISTEM INFORMASI PENILAIAN'), 'kop laporan ada');
  cek(r2.html.includes('IDENTITAS'), 'ada kata IDENTITAS');
  cek(r2.html.includes('PENAMPILAN'), 'blok A PENAMPILAN ada');
  cek(r2.html.includes('KEMAMPUAN'), 'blok B KEMAMPUAN ada');
  cek(r2.html.includes('SIKAP'), 'blok C SIKAP ada');
  cek(r2.html.includes('TOTAL PENILAIAN'), 'blok D TOTAL PENILAIAN ada');
  cek(r2.html.includes('LEMBAR KOMITMEN'), 'LEMBAR KOMITMEN ada');
  cek(r2.html.includes('Tanda Tangan Pegawai'), 'kolom ttd pegawai ada');
  cek(r2.html.includes('Tanda Tangan Atasan'), 'kolom ttd atasan ada');
  cek(r2.html.includes('Mengetahui'), 'kolom mengetahui ada');
  cek(r2.html.includes('Dewi Kartika'), 'nama penilai (supervisor) tampil');
  cek(r2.html.includes('Hendra Wijaya'), 'nama manager (mengetahui) tampil');
  cek(r2.html.includes('Istimewa'), 'rating Istimewa tampil');
  cek(r2.html.includes('Cetak'), 'tombol cetak ada');
  cek(r2.html.includes('sip-laporan'), 'kelas CSS cetak terpasang');

  // 4. Hitung jumlah kolom "Angka Skor" — harus 3 (satu per kategori A/B/C).
  //    HTML punya 2 elemen per kolom: <th> dan versi render tabel mobile,
  //    jadi 3 kolom x 2 = 6 kemunculan.
  const jumlahAngkaSkor = (r2.html.match(/Angka Skor/g) ?? []).length;
  console.log(`\n3. Kemunculan "Angka Skor": ${jumlahAngkaSkor} (3 kolom x 2 render = 6)`);
  cek(jumlahAngkaSkor === 6, 'tepat 3 kolom skor untuk 3 kategori');

  // 5. Cek nilai akhir di semua halaman
  const p = await prisma.penilaian.findFirst({
    where: { pegawai: { nip: '80000001' } },
    select: { nilaiAkhir: true, rating: true },
  });
  console.log(`\n4. Nilai akhir di DB: ${p?.nilaiAkhir} (${p?.rating})`);
  const nilaiStr = (p?.nilaiAkhir ?? 0).toFixed(2).replace('.', ',');
  cek(r2.html.includes(nilaiStr), `nilai akhir "${nilaiStr}" tampil di halaman cetak`);

  // 6. Uji proteksi: pegawai biasa tidak boleh lihat laporan orang lain
  const { token: tokenPegawai } = await buatSesi('80000003');
  const r3 = await get(`${BASE}/laporan/${penilaian.id}`, tokenPegawai);
  console.log(`\n5. Proteksi akses (pegawai lain buka laporan Andi) → ${r3.status} → ${r3.lokasi ?? '(tidak redirect)'}`);
  cek(r3.status === 307 && r3.lokasi === '/dasbor', 'pegawai lain dialihkan ke /dasbor');

  // 7. Bersihkan sesi uji
  await prisma.sesi.deleteMany({
    where: { pegawai: { nip: { in: ['90000001', '80000003'] } } },
  });
  console.log('\n✓ sesi uji dibersihkan');

  console.log('\n✅ UJI HALAMAN LAPORAN SELESAI.');
}

let gagal = 0;
function cek(kondisi: boolean, label: string) {
  console.log(`   ${kondisi ? 'ok ' : 'XX '} ${label}`);
  if (!kondisi) gagal++;
}

main()
  .then(() => {
    if (gagal > 0) {
      console.error(`\n❌ ${gagal} pemeriksaan GAGAL`);
      process.exit(1);
    }
  })
  .catch((e) => {
    console.error('\n❌ GAGAL:', e.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
