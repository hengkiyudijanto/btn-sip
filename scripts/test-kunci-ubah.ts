/**
 * Uji kunci & ubah penilaian lewat HTTP sungguhan (bukan memanggil server
 * action dari skrip, karena Next.js butuh konteks request).
 *
 * Jalankan: BASE_URL=http://localhost:3100 pnpm exec tsx scripts/test-kunci-ubah.ts
 */
import 'dotenv/config';
import crypto from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import bcrypt from 'bcryptjs';

const BASE = process.env.BASE_URL ?? 'http://localhost:3100';
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

let lulus = 0;
let gagal = 0;
function cek(kondisi: boolean, label: string) {
  console.log(`   ${kondisi ? 'ok ' : 'XX '} ${label}`);
  if (kondisi) lulus++;
  else gagal++;
}

const hashToken = (t: string) => crypto.createHash('sha256').update(t).digest('hex');
const NIP_PETUGAS = 'KUNCI0001';
const NIP_ATASAN = 'KUNCI0002';

async function buatSesi(pegawaiId: string) {
  const token = crypto.randomBytes(32).toString('base64url');
  await prisma.sesi.create({
    data: { tokenHash: hashToken(token), pegawaiId, expiresAt: new Date(Date.now() + 3600_000) },
  });
  return token;
}

async function get(path: string, token: string) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { cookie: `sip_sesi=${token}` },
    redirect: 'manual',
  });
  return { status: res.status, html: await res.text(), headers: res.headers };
}

/**
 * Apakah ada tautan tombol Nilai/Ubah (bukan sekadar teks di keterangan)?
 * Atribut href dan title bisa muncul dalam urutan apa pun, jadi tag <a>
 * diambil utuh lalu diperiksa isinya.
 */
function adaTombolNilai(html: string) {
  const tautan = html.match(/<a\b[^>]*>[\s\S]{0,60}?<\/a>/g) ?? [];
  return tautan.some(
    (a) => /href="\/penilaian\/[^"]*\?periode=/.test(a) && />(Nilai|Ubah)</.test(a)
  );
}

/** Apakah tombol pada baris tertentu berlabel "Ubah" */
function adaTombolUbah(html: string) {
  const tautan = html.match(/<a\b[^>]*>[\s\S]{0,60}?<\/a>/g) ?? [];
  return tautan.some(
    (a) => /href="\/penilaian\/[^"]*\?periode=/.test(a) && />Ubah</.test(a)
  );
}

async function main() {
  console.log(`=== UJI KUNCI & UBAH PENILAIAN (${BASE}) ===\n`);

  await prisma.penilaianDetail.deleteMany({ where: { penilaian: { pegawai: { nip: NIP_PETUGAS } } } });
  await prisma.penilaian.deleteMany({ where: { pegawai: { nip: NIP_PETUGAS } } });
  await prisma.pegawai.deleteMany({ where: { nip: { in: [NIP_PETUGAS, NIP_ATASAN] } } });

  const cabang = await prisma.cabang.findFirst({ where: { aktif: true } });
  if (!cabang) throw new Error('tidak ada cabang aktif');
  const hash = await bcrypt.hash('Kuncipass123', 10);

  const atasan = await prisma.pegawai.create({
    data: {
      nip: NIP_ATASAN, nama: 'Atasan Uji Kunci', passwordHash: hash,
      role: 'SUPERVISOR', harusGantiPassword: false, aktif: true, cabangId: cabang.id,
    },
  });
  const petugas = await prisma.pegawai.create({
    data: {
      nip: NIP_PETUGAS, nama: 'Petugas Uji Kunci', passwordHash: hash,
      role: 'PEGAWAI', harusGantiPassword: false, aktif: true, cabangId: cabang.id,
      atasanId: atasan.id,
    },
  });

  const bulanIni = new Date().getMonth() + 1;
  const tahunIni = new Date().getFullYear();
  const periodeIni = await prisma.periode.findFirst({
    where: {
      tanggalMulai: { gte: new Date(tahunIni, bulanIni - 1, 1) },
      tanggalSelesai: { lte: new Date(tahunIni, bulanIni - 1, 31, 23, 59) },
    },
    orderBy: { tanggalMulai: 'asc' },
  });
  const periodeLalu = await prisma.periode.findFirst({
    where: { tanggalSelesai: { lt: new Date(tahunIni, bulanIni - 1, 1) } },
    orderBy: { tanggalSelesai: 'desc' },
  });
  if (!periodeIni) throw new Error('tidak ada periode bulan ini');

  console.log('ok  data uji siap');
  console.log(`   periode bulan ini : ${periodeIni.nama}`);
  console.log(`   periode sebelumnya: ${periodeLalu?.nama ?? '(tidak ada)'}\n`);

  const token = await buatSesi(atasan.id);

  // ===== 1. periode bisa dipilih =====
  console.log('--- 1. periode bisa dipilih ---');
  const r1 = await get('/penilaian', token);
  cek(r1.status === 200, 'halaman penilaian terbuka');
  cek(r1.html.includes('Periode yang dinilai'), 'pemilih periode ada');
  cek(r1.html.includes('<select'), 'dropdown periode ada');
  cek(r1.html.includes(periodeIni.nama), 'periode bulan ini ada di dropdown');

  // ===== 2. pilih periode lain =====
  console.log('\n--- 2. memilih periode lain ---');
  if (periodeLalu) {
    const r2 = await get(`/penilaian?periode=${periodeLalu.id}`, token);
    cek(r2.status === 200, 'bisa buka periode lain lewat ?periode=');
    cek(r2.html.includes(periodeLalu.nama), `menampilkan ${periodeLalu.nama}`);

    console.log('\n--- 3. peringatan periode tidak sesuai ---');
    cek(
      r2.html.includes('bukan periode bulan berjalan') || r2.html.includes('sudah lewat'),
      'MUNCUL peringatan periode tidak sesuai bulan berjalan'
    );
    cek(r2.html.includes('⚠'), 'ikon peringatan tampil');
  }

  // ===== 4. periode berjalan tidak memunculkan peringatan =====
  console.log('\n--- 4. periode berjalan tanpa peringatan ---');
  // ambil periode yang benar-benar memuat HARI INI, bukan sekadar periode
  // pertama bulan ini — supaya tes tidak bergantung waktu server
  const hariIni = new Date();
  const periodeBerjalan = await prisma.periode.findFirst({
    where: {
      tanggalMulai: { lte: hariIni },
      tanggalSelesai: { gte: hariIni },
    },
  });
  if (periodeBerjalan) {
    console.log(`   periode berjalan: ${periodeBerjalan.nama}`);
    const rb = await get(`/penilaian?periode=${periodeBerjalan.id}`, token);
    cek(
      !rb.html.includes('bukan periode bulan berjalan') &&
        !rb.html.includes('sudah lewat') &&
        !rb.html.includes('belum dimulai'),
      'periode berjalan TIDAK memunculkan peringatan apa pun'
    );
  } else {
    console.log('   (tidak ada periode yang memuat hari ini — dilewati)');
  }

  // ===== 5. belum dinilai =====
  console.log('\n--- 5. status awal: belum dinilai ---');
  // pakai periodeIni (periode pertama bulan ini) sebagai acuan tampilan daftar
  const r5 = await get(`/penilaian?periode=${periodeIni.id}`, token);
  cek(r5.status === 200, 'daftar penilaian terbuka');
  cek(r5.html.includes('Belum dinilai'), 'status "Belum dinilai" tampil');
  cek(adaTombolNilai(r5.html), 'tautan tombol Nilai/Ubah tampil');

  // ===== 6. isi penilaian pertama =====
  console.log('\n--- 6. mengisi penilaian pertama ---');
  await prisma.penilaian.create({
    data: {
      pegawaiId: petugas.id,
      penilaiId: atasan.id,
      periodeId: periodeIni.id,
      status: 'DRAFT',
      nilaiPenampilan: 4.2, nilaiKemampuan: 4.0, nilaiSikap: 4.1, nilaiAkhir: 4.1,
      rating: 'Baik',
      detail: {
        create: [
          { kodeAspek: 'A1', nilaiMentah: 92, skor: 4, bobotAspek: 0.4 },
          { kodeAspek: 'B1', nilaiMentah: 88, skor: 3, bobotAspek: 0.2 },
        ],
      },
    },
  });

  const r6 = await get(`/penilaian?periode=${periodeIni.id}`, token);
  cek(!r6.html.includes('Belum dinilai'), 'status berubah dari "Belum dinilai"');
  cek(adaTombolUbah(r6.html), 'tombol berubah jadi "Ubah"');
  cek(r6.html.includes('Draft'), 'status Draft tampil');

  const jumlah1 = await prisma.penilaian.count({
    where: { pegawaiId: petugas.id, periodeId: periodeIni.id },
  });
  cek(jumlah1 === 1, 'tersimpan tepat 1 penilaian (tidak dobel)');

  // ===== 7. halaman form menampilkan nilai lama (bisa diubah) =====
  console.log('\n--- 7. form terbuka dengan nilai lama ---');
  const r7 = await get(`/penilaian/${petugas.id}?periode=${periodeIni.id}`, token);
  cek(r7.status === 200, `form penilaian terbuka (status ${r7.status})`);
  cek(r7.html.includes('92') || r7.html.includes('value="92"'), 'nilai lama 92 termuat di form');
  cek(!r7.html.includes('Periode ini terkunci'), 'tidak ada peringatan terkunci');

  // ===== 8. periode terkunci =====
  console.log('\n--- 8. periode terkunci ---');
  await prisma.periode.update({ where: { id: periodeIni.id }, data: { dikunci: true } });

  const r8 = await get(`/penilaian?periode=${periodeIni.id}`, token);
  cek(r8.html.includes('Periode ini terkunci'), 'peringatan terkunci tampil di daftar');
  cek(!adaTombolNilai(r8.html), 'TOMBOL Nilai/Ubah HILANG saat terkunci');
  cek(r8.html.includes('🔒'), 'ikon kunci tampil di baris petugas');

  const r8b = await get(`/penilaian/${petugas.id}?periode=${periodeIni.id}`, token);
  cek(
    r8b.html.includes('terkunci') || r8b.html.includes('🔒'),
    'peringatan terkunci juga muncul di halaman form'
  );

  // ===== 9. buka kunci =====
  console.log('\n--- 9. buka kunci ---');
  await prisma.periode.update({ where: { id: periodeIni.id }, data: { dikunci: false } });
  const r9 = await get(`/penilaian?periode=${periodeIni.id}`, token);
  cek(!r9.html.includes('Periode ini terkunci'), 'peringatan terkunci hilang');
  cek(adaTombolNilai(r9.html), 'tombol Nilai/Ubah muncul lagi');

  // ===== 10. nilai tetap utuh =====
  console.log('\n--- 10. data tidak rusak ---');
  const tetap = await prisma.penilaian.findUnique({
    where: { pegawaiId_periodeId: { pegawaiId: petugas.id, periodeId: periodeIni.id } },
    include: { detail: true },
  });
  cek(tetap?.nilaiAkhir === 4.1, 'nilai akhir tetap 4.1');
  cek(tetap?.detail.length === 2, 'detail aspek tetap 2 baris');

  // bersihkan
  await prisma.penilaianDetail.deleteMany({ where: { penilaian: { pegawaiId: petugas.id } } });
  await prisma.penilaian.deleteMany({ where: { pegawaiId: petugas.id } });
  await prisma.sesi.deleteMany({ where: { pegawaiId: { in: [atasan.id, petugas.id] } } });
  await prisma.pegawai.deleteMany({ where: { nip: { in: [NIP_PETUGAS, NIP_ATASAN] } } });
  console.log('\n✓ data uji dibersihkan');

  console.log(`\n=== HASIL: ${lulus} lulus, ${gagal} gagal ===`);
  if (gagal > 0) process.exit(1);
  console.log('✅ KUNCI & UBAH PENILAIAN TERVERIFIKASI.');
}

main()
  .catch((e) => {
    console.error('\n❌ GAGAL:', e.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
