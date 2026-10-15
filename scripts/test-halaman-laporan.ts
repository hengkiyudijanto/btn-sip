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
  if (!pegawai) {
    throw new Error(
      `Pegawai ${nip} tidak ditemukan.\n` +
        '   Skrip ini butuh DATA DEMO. Jalankan dulu:\n' +
        '     pnpm exec tsx scripts/seed-demo.ts\n' +
        '   Lalu bersihkan setelah selesai:\n' +
        '     pnpm exec tsx scripts/seed-demo.ts --hapus'
    );
  }

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

  // Data demo ada di periode LAMPAU (DEMO-W40), sementara /laporan defaultnya
  // periode BERJALAN — jadi tanpa ?periode= halaman menampilkan periode lain dan
  // pegawai demo tidak akan muncul. Periode diminta eksplisit.
  const periodeDemo = await prisma.periode.findFirst({ where: { kode: 'DEMO-W40' } });
  if (!periodeDemo) throw new Error('periode DEMO-W40 tidak ada — jalankan scripts/seed-demo.ts dulu');
  console.log(`(periode demo: ${periodeDemo.nama} — ${periodeDemo.kode})\n`);

  // 1. Halaman daftar laporan
  const r1 = await get(`${BASE}/laporan?periode=${periodeDemo.id}`, token);
  console.log(`1. /laporan                    → ${r1.status}`);
  cek(r1.html.includes('Laporan'), 'judul "Laporan" ada');
  cek(r1.html.includes('Andi Pratama'), 'petugas "Andi Pratama" tampil');
  cek(r1.html.includes('Siti Nurhaliza'), 'petugas "Siti Nurhaliza" tampil');
  cek(r1.html.includes('Budi Santoso'), 'petugas "Budi Santoso" tampil');
  cek(r1.html.includes('Rata-rata'), 'kartu rekap rata-rata ada');
  // Kategori diambil dari data nyata, bukan ditulis tetap: ketiga pegawai demo
  // bernilai 4,60 (Sangat Baik), 3,27 dan 2,15 (Kurang) — tidak ada yang "Istimewa".
  cek(r1.html.includes('Sangat Baik'), 'badge kategori "Sangat Baik" ada');
  cek(r1.html.includes('Kurang'), 'badge kategori "Kurang" ada');
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
  // "Mengetahui" SENGAJA dihapus dari laporan (keputusan pemilik aplikasi): laporan
  // hanya memuat dua kolom tanda tangan, Pegawai dan Atasan. Assert lama menuntut
  // kolom itu ada dan nama manager tampil — keduanya membalik keputusan user.
  cek(!r2.html.includes('Mengetahui'), 'kolom mengetahui TIDAK ada (sudah dihapus atas permintaan user)');
  cek(r2.html.includes('Dewi Kartika'), 'nama penilai (supervisor) tampil');
  cek(!r2.html.includes('Hendra Wijaya'), 'nama manager TIDAK diambil query laporan (relasi mengetahui dilepas)');
  // Rating diambil dari database, bukan ditulis tetap: nilai akhir Andi 4,60 = "Sangat Baik".
  cek(r2.html.includes('Sangat Baik'), 'rating sesuai nilai akhir tampil');
  cek(r2.html.includes('Cetak'), 'tombol cetak ada');
  cek(r2.html.includes('sip-laporan'), 'kelas CSS cetak terpasang');

  // 4. Hitung jumlah kolom skor — harus 3 (satu per kategori A/B/C).
  //    Header-nya "Skor 1–5": awalan "Angka" sudah dihapus atas permintaan user,
  //    dan tanda hubungnya ditulis sebagai &ndash; di HTML.
  const jumlahHeaderSkor = (r2.html.match(/Skor 1(?:&ndash;|–)5/g) ?? []).length;
  console.log(`\n3. Kemunculan header "Skor 1-5": ${jumlahHeaderSkor} (harus >= 3, satu per kategori)`);
  cek(jumlahHeaderSkor >= 3, 'kolom skor ada untuk tiap kategori');
  cek(!r2.html.includes('Angka Skor'), 'awalan "Angka" sudah tidak dipakai di header kolom skor');

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

let lulus = 0;
let gagal = 0;
function cek(kondisi: boolean, label: string) {
  console.log(`   ${kondisi ? 'ok ' : 'XX '} ${label}`);
  if (kondisi) lulus++;
  else gagal++;
}

main()
  .then(() => {
    if (gagal > 0) {
      console.error(`\n❌ HASIL: ${lulus} lulus, ${gagal} gagal`);
      process.exit(1);
    }
    // Ringkasan dicetak juga saat lulus supaya skrip ini bisa dirangkum dengan
    // grep yang sama seperti skrip uji lain ("HASIL: N lulus, M gagal").
    // Sebelumnya hanya mencetak "SELESAI", sehingga tampak seperti tidak ada output.
    console.log(`\n=== HASIL: ${lulus} lulus, ${gagal} gagal ===`);
  })
  .catch((e) => {
    console.error('\n❌ GAGAL:', e.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
