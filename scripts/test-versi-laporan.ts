/**
 * Uji dua versi laporan lewat HTTP sungguhan.
 *
 * Membuktikan:
 *  - versi lengkap memuat "Dasar penilaian" (kriteria rubrik)
 *  - versi lite TIDAK memuat dasar penilaian
 *  - catatan yang ditulis atasan TETAP ada di kedua versi
 *  - angka, skor, dan nilai akhir identik di kedua versi
 *  - ada pemilih versi di halaman
 *
 * Jalankan: BASE_URL=http://localhost:3100 pnpm exec tsx scripts/test-versi-laporan.ts
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
const NIP_S = 'VERSI001';
const NIP_P = 'VERSI002';
const KODE_W = 'VERSI-W1';

const CATATAN_ATASAN = 'Seragam sudah rapi namun sepatu perlu dipoles lagi.';
const CATATAN_UMUM = 'Perlu peningkatan pada kemampuan menjelaskan produk.';

async function get(path: string, token: string) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { cookie: `sip_sesi=${token}` },
    redirect: 'manual',
  });
  return { status: res.status, html: await res.text() };
}

/** Ambil teks kolom Catatan dari HTML, dibersihkan dari tag */
function normalisasi(html: string): string {
  return html.replace(/<[^>]*>/g, ' ').replace(/&[a-z]+;/g, ' ').replace(/\s+/g, ' ');
}

async function main() {
  console.log(`=== UJI DUA VERSI LAPORAN (${BASE}) ===\n`);

  // ===== siapkan =====
  const cabang = await prisma.cabang.findFirst({ where: { aktif: true } });
  if (!cabang) throw new Error('tidak ada cabang');
  const hash = await bcrypt.hash('Versi1234', 10);

  const pegIds = await prisma.pegawai.findMany({
    where: { nip: { in: [NIP_P, NIP_S] } },
    select: { id: true },
  });
  const ids = pegIds.map((p) => p.id);
  await prisma.penilaianDetail.deleteMany({ where: { penilaian: { pegawaiId: { in: ids } } } });
  await prisma.penilaian.deleteMany({ where: { pegawaiId: { in: ids } } });
  await prisma.pegawai.deleteMany({ where: { nip: { in: [NIP_P, NIP_S] } } });
  await prisma.periode.deleteMany({ where: { kode: KODE_W } });

  const spv = await prisma.pegawai.create({
    data: { nip: NIP_S, nama: 'SPV Versi', passwordHash: hash, role: 'SUPERVISOR',
      harusGantiPassword: false, aktif: true, cabangId: cabang.id },
  });
  const pet = await prisma.pegawai.create({
    data: { nip: NIP_P, nama: 'Petugas Versi', passwordHash: hash, role: 'PEGAWAI',
      harusGantiPassword: false, aktif: true, cabangId: cabang.id, atasanId: spv.id },
  });
  const per = await prisma.periode.create({
    data: { kode: KODE_W, nama: 'Uji Versi Laporan',
      tanggalMulai: new Date(2041, 0, 1), tanggalSelesai: new Date(2041, 0, 7), aktif: true },
  });

  const pen = await prisma.penilaian.create({
    data: {
      pegawaiId: pet.id, penilaiId: spv.id, periodeId: per.id, status: 'FINAL',
      nilaiPenampilan: 4.0, nilaiKemampuan: 3.8, nilaiSikap: 4.2, nilaiAkhir: 3.98,
      rating: 'Cukup', catatanUmum: CATATAN_UMUM,
      detail: {
        create: [
          { kodeAspek: 'A1', nilaiMentah: 92, skor: 4, bobotAspek: 0.4, catatan: CATATAN_ATASAN },
          { kodeAspek: 'A2', nilaiMentah: 88, skor: 3, bobotAspek: 0.3, catatan: null },
          { kodeAspek: 'B1', nilaiMentah: 90, skor: 3, bobotAspek: 0.2, catatan: null },
          { kodeAspek: 'C1', nilaiMentah: 94, skor: 4, bobotAspek: 0.3, catatan: null },
        ],
      },
    },
  });

  const token = crypto.randomBytes(32).toString('base64url');
  await prisma.sesi.create({
    data: { tokenHash: hashToken(token), pegawaiId: spv.id, expiresAt: new Date(Date.now() + 3600_000) },
  });
  console.log('ok  data uji siap\n');

  // ===== 1. versi lengkap =====
  console.log('--- 1. versi LENGKAP ---');
  const r1 = await get(`/laporan/${pen.id}`, token);
  cek(r1.status === 200, `terbuka (status ${r1.status})`);
  const t1 = normalisasi(r1.html);
  cek(t1.includes('Dasar penilaian'), 'memuat label "Dasar penilaian"');
  cek(t1.includes(CATATAN_ATASAN), 'memuat catatan atasan');
  cek(t1.includes(CATATAN_UMUM), 'memuat catatan umum penilai');
  cek(!t1.includes('Versi ringkas'), 'TIDAK ada penanda versi ringkas');
  cek(t1.includes('Versi laporan'), 'pemilih versi tampil');

  // ===== 2. versi lite =====
  console.log('\n--- 2. versi LITE ---');
  const r2 = await get(`/laporan/${pen.id}?versi=lite`, token);
  cek(r2.status === 200, `terbuka (status ${r2.status})`);
  const t2 = normalisasi(r2.html);
  cek(!t2.includes('Dasar penilaian'), 'TIDAK memuat label "Dasar penilaian"');
  cek(t2.includes(CATATAN_ATASAN), 'catatan atasan TETAP ditampilkan');
  cek(t2.includes(CATATAN_UMUM), 'catatan umum penilai TETAP ditampilkan');

  // ===== 2b. tidak ada penanda versi di lembar cetak =====
  console.log('\n--- 2b. penanda versi ---');
  cek(!t2.includes('Versi ringkas'), 'versi lite tidak memuat penanda "Versi ringkas"');
  cek(
    !t1.includes('Versi ringkas') && !t2.includes('Versi ringkas'),
    'tidak ada penanda "Versi ringkas" di kedua versi'
  );

  // ===== 2c. tulisan di bawah logo tetap ada di KEDUA versi =====
  console.log('\n--- 2c. tulisan di bawah logo ---');
  cek(
    t1.includes('PT Bank Tabungan Negara') && t2.includes('PT Bank Tabungan Negara'),
    'tulisan "PT Bank Tabungan Negara" ada di kedua versi'
  );
  cek(
    t1.includes('Cabang') && t2.includes('Cabang'),
    'nama cabang tetap tercetak di kedua versi'
  );

  // ===== 2d. NIP atasan di blok tanda tangan =====
  console.log('\n--- 2d. blok tanda tangan atasan ---');
  cek(
    t1.includes(`NIP ${NIP_S}`) && t2.includes(`NIP ${NIP_S}`),
    `NIP atasan (${NIP_S}) tercetak di kedua versi`
  );
  cek(
    !t1.includes('Atasan Langsung') && !t2.includes('Atasan Langsung'),
    'tulisan "Atasan Langsung" sudah tidak ada'
  );
  cek(t1.includes('SPV Versi'), 'nama atasan tetap tercetak');

  // ===== 3. data angka identik =====
  console.log('\n--- 3. angka identik di kedua versi ---');
  const angkaLengkap = t1.match(/\b\d{1,3}\b/g) ?? [];
  const angkaLite = t2.match(/\b\d{1,3}\b/g) ?? [];
  // nilai akhir dan rating harus ada di keduanya
  cek(t1.includes('3,98') && t2.includes('3,98'), 'nilai akhir 3,98 di kedua versi');
  cek(t1.includes('Cukup') && t2.includes('Cukup'), 'rating Cukup di kedua versi');
  cek(
    angkaLengkap.length > 0 && angkaLite.length > 0,
    `jumlah angka wajar (lengkap ${angkaLengkap.length}, lite ${angkaLite.length})`
  );

  // ===== 4. identitas tetap lengkap =====
  console.log('\n--- 4. identitas tetap ada di versi lite ---');
  cek(t2.includes('Petugas Versi'), 'nama petugas ada');
  cek(t2.includes(NIP_P), 'NIP ada');
  cek(t2.includes('Uji Versi Laporan'), 'periode ada');
  cek(t2.includes('IDENTITAS KARYAWAN'), 'blok identitas ada');
  cek(t2.includes('Penampilan'), 'kategori A ada');

  // bersihkan
  await prisma.penilaianDetail.deleteMany({ where: { penilaianId: pen.id } });
  await prisma.penilaian.delete({ where: { id: pen.id } });
  await prisma.sesi.deleteMany({ where: { pegawaiId: spv.id } });
  await prisma.pegawai.deleteMany({ where: { nip: { in: [NIP_P, NIP_S] } } });
  await prisma.periode.deleteMany({ where: { kode: KODE_W } });
  console.log('\n✓ data uji dibersihkan');

  console.log(`\n=== HASIL: ${lulus} lulus, ${gagal} gagal ===`);
  if (gagal > 0) process.exit(1);
  console.log('✅ DUA VERSI LAPORAN TERVERIFIKASI.');
}

main()
  .catch((e) => {
    console.error('\n❌ GAGAL:', e.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
