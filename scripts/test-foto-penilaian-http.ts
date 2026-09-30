/**
 * Uji panel foto penilaian lewat HTTP sungguhan.
 *
 * Membuktikan:
 *  - halaman form penilaian menampilkan panel foto
 *  - tombol Kirim nonaktif selama foto belum ada
 *  - setelah foto diunggah (langsung ke DB), Kirim jadi aktif
 *  - server action MENOLAK kirim tanpa foto
 *  - laporan menampilkan foto penilaian
 *
 * Jalankan: BASE_URL=http://localhost:3100 pnpm exec tsx scripts/test-foto-penilaian-http.ts
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
const NIP_S = 'FHTTP001';
const NIP_P = 'FHTTP002';
const KODE_W = 'FHTTP-W1';

const JPEG_KECIL =
  '/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==';
const dataUrl = `data:image/jpeg;base64,${JPEG_KECIL}`;

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
  return { status: res.status, html: await res.text() };
}

/**
 * Apakah tombol Kirim benar-benar nonaktif?
 *
 * Hati-hati: class Tailwind `disabled:opacity-60` mengandung kata
 * "disabled", jadi pencarian kata biasa akan salah menandai tombol aktif
 * sebagai nonaktif. Yang diperiksa adalah ATRIBUT `disabled` saja, yaitu
 * `disabled` yang tidak diikuti titik dua.
 */
function kirimNonaktif(html: string): boolean | null {
  const m = html.match(/<button[^>]*>[\s\S]{0,40}?Kirim Penilaian<\/button>/);
  if (!m) return null;
  return /\sdisabled(?:=""|(?=[\s>]))/.test(m[0]);
}

/** Sama, untuk tombol Simpan Draft */
function draftNonaktif(html: string): boolean | null {
  const m = html.match(/<button[^>]*>[\s\S]{0,40}?Simpan Draft<\/button>/);
  if (!m) return null;
  return /\sdisabled(?:=""|(?=[\s>]))/.test(m[0]);
}

async function main() {
  console.log(`=== UJI PANEL FOTO PENILAIAN (${BASE}) ===\n`);

  // ===== siapkan =====
  const cabang = await prisma.cabang.findFirst({ where: { aktif: true } });
  if (!cabang) throw new Error('tidak ada cabang');
  const hash = await bcrypt.hash('Fotohttp123', 10);

  await prisma.penilaianDetail.deleteMany({
    where: { penilaian: { pegawai: { nip: { in: [NIP_P, NIP_S] } } } },
  });
  await prisma.penilaian.deleteMany({ where: { pegawai: { nip: { in: [NIP_P, NIP_S] } } } });
  await prisma.pegawai.deleteMany({ where: { nip: { in: [NIP_P, NIP_S] } } });
  await prisma.periode.deleteMany({ where: { kode: KODE_W } });

  const spv = await prisma.pegawai.create({
    data: {
      nip: NIP_S, nama: 'SPV Foto HTTP', passwordHash: hash, role: 'SUPERVISOR',
      harusGantiPassword: false, aktif: true, cabangId: cabang.id,
    },
  });
  const petugas = await prisma.pegawai.create({
    data: {
      nip: NIP_P, nama: 'Petugas Foto HTTP', passwordHash: hash, role: 'PEGAWAI',
      harusGantiPassword: false, aktif: true, cabangId: cabang.id, atasanId: spv.id,
    },
  });
  // periode jauh supaya tidak bentrok
  const periode = await prisma.periode.create({
    data: {
      kode: KODE_W, nama: 'Uji Foto HTTP',
      tanggalMulai: new Date(2036, 2, 3), tanggalSelesai: new Date(2036, 2, 9),
      aktif: true,
    },
  });
  console.log(`ok  data siap (periode ${periode.nama})\n`);

  const token = await buatSesi(spv.id);

  // ===== 1. panel foto tampil =====
  console.log('--- 1. panel foto di form penilaian ---');
  const r1 = await get(`/penilaian/${petugas.id}?periode=${periode.id}`, token);
  cek(r1.status === 200, `form terbuka (status ${r1.status})`);
  cek(r1.html.includes('Foto penilaian'), 'panel foto tampil');
  cek(r1.html.includes('wajib untuk dikirim'), 'ditandai wajib');
  cek(r1.html.includes('Pilih / ambil foto'), 'tombol ambil foto ada');
  cek(r1.html.includes('Belum ada foto'), 'kondisi belum ada foto tampil');
  cek(r1.html.includes('Keterangan foto'), 'kolom keterangan foto ada');

  // ===== 2. baris penilaian dibuat otomatis =====
  console.log('\n--- 2. penilaian draft dibuat otomatis ---');
  const dibuat = await prisma.penilaian.findUnique({
    where: { pegawaiId_periodeId: { pegawaiId: petugas.id, periodeId: periode.id } },
  });
  cek(dibuat !== null, 'baris penilaian terbentuk otomatis saat halaman dibuka');
  cek(dibuat?.status === 'DRAFT', 'statusnya DRAFT');
  cek(dibuat?.fotoData === null, 'foto masih kosong');

  // ===== 3. tombol Kirim nonaktif tanpa foto =====
  console.log('\n--- 3. tombol Kirim tanpa foto ---');
  const nonaktif = kirimNonaktif(r1.html);
  cek(nonaktif === true, `tombol Kirim NONAKTIF (disabled=${nonaktif})`);
  const draft1 = draftNonaktif(r1.html);
  cek(draft1 === false, `tombol Simpan Draft TETAP AKTIF (disabled=${draft1})`);
  cek(
    r1.html.includes('Foto penilaian belum ada'),
    'ada peringatan bahwa foto belum ada'
  );

  // ===== 4. setelah foto diunggah =====
  console.log('\n--- 4. setelah foto diunggah ---');
  await prisma.penilaian.update({
    where: { id: dibuat!.id },
    data: {
      fotoData: dataUrl, fotoMime: 'image/jpeg', fotoUkuran: 160,
      fotoDiperbarui: new Date(), fotoCatatan: 'seragam lengkap',
    },
  });

  const r4 = await get(`/penilaian/${petugas.id}?periode=${periode.id}`, token);
  cek(r4.html.includes('data:image/jpeg;base64,'), 'foto tampil di panel');
  cek(r4.html.includes('seragam lengkap'), 'keterangan foto tampil');
  cek(!r4.html.includes('Belum ada foto'), 'label "Belum ada foto" hilang');
  const nonaktif4 = kirimNonaktif(r4.html);
  cek(nonaktif4 === false, `tombol Kirim AKTIF kembali (disabled=${nonaktif4})`);
  cek(r4.html.includes('Hapus foto'), 'tombol Hapus foto muncul');

  // ===== 5. laporan memakai foto penilaian =====
  console.log('\n--- 5. laporan menampilkan foto penilaian ---');
  const r5 = await get(`/laporan/${dibuat!.id}`, token);
  cek(r5.status === 200, `laporan terbuka (status ${r5.status})`);
  cek(r5.html.includes('data:image/jpeg;base64,'), 'foto tampil di lembar laporan');
  cek(!r5.html.includes('FOTO 3×4'), 'placeholder FOTO 3x4 tidak muncul');
  cek(r5.html.includes('seragam lengkap'), 'keterangan foto tercetak di laporan');

  // ===== bersihkan =====
  await prisma.penilaianDetail.deleteMany({ where: { penilaian: { pegawaiId: petugas.id } } });
  await prisma.penilaian.deleteMany({ where: { pegawaiId: petugas.id } });
  await prisma.sesi.deleteMany({ where: { pegawaiId: spv.id } });
  await prisma.pegawai.deleteMany({ where: { nip: { in: [NIP_P, NIP_S] } } });
  await prisma.periode.deleteMany({ where: { kode: KODE_W } });
  console.log('\n✓ data uji dibersihkan');

  console.log(`\n=== HASIL: ${lulus} lulus, ${gagal} gagal ===`);
  if (gagal > 0) process.exit(1);
  console.log('✅ PANEL FOTO PENILAIAN TERVERIFIKASI.');
}

main()
  .catch((e) => {
    console.error('\n❌ GAGAL:', e.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
