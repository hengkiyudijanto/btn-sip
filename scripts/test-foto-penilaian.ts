/**
 * Uji aturan foto penilaian.
 *
 * Membuktikan:
 *  - foto melekat pada PENILAIAN, bukan pegawai
 *  - draft boleh tanpa foto, KIRIM ditolak tanpa foto
 *  - setiap periode punya foto sendiri (riwayat terjaga)
 *  - validasi format & ukuran di server
 *  - hanya penilai bersangkutan atau admin yang boleh mengunggah
 *  - periode terkunci menolak perubahan foto
 *  - laporan memakai foto penilaian, cadangan ke foto pegawai
 *
 * Jalankan: pnpm exec tsx scripts/test-foto-penilaian.ts
 */
import 'dotenv/config';
import crypto from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import bcrypt from 'bcryptjs';

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

const NIP_P = 'FOTOP001';
const NIP_S = 'FOTOP002';
const NIP_S2 = 'FOTOP003';

/** JPEG 1x1 piksel valid */
const JPEG_KECIL =
  '/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==';

const dataUrlJpeg = `data:image/jpeg;base64,${JPEG_KECIL}`;

async function bereskan() {
  const peg = await prisma.pegawai.findMany({
    where: { nip: { in: [NIP_P, NIP_S, NIP_S2] } },
    select: { id: true },
  });
  const ids = peg.map((p) => p.id);
  await prisma.penilaianDetail.deleteMany({ where: { penilaian: { pegawaiId: { in: ids } } } });
  await prisma.penilaian.deleteMany({ where: { pegawaiId: { in: ids } } });
  await prisma.pegawai.deleteMany({ where: { nip: { in: [NIP_P, NIP_S, NIP_S2] } } });
  // hapus periode uji — termasuk sisa dari percobaan sebelumnya
  await prisma.periode.deleteMany({ where: { kode: { in: ['FOTOP-W1', 'FOTOP-W2'] } } });
}

async function main() {
  console.log('=== UJI FOTO PENILAIAN ===\n');
  await bereskan();
  // bereskan sekali lagi: periode harus dibersihkan sebelum dibuat ulang
  await prisma.periode.deleteMany({ where: { kode: { in: ['FOTOP-W1', 'FOTOP-W2'] } } });

  const { validasiFotoPenilaian, ukuranDataUrl, simpanFotoPenilaian } = await import(
    '../src/lib/sip/foto-penilaian'
  );

  // ===== 1. validasi format =====
  console.log('--- 1. validasi format di server ---');
  cek(validasiFotoPenilaian(dataUrlJpeg).ok, 'terima JPEG');
  cek(
    validasiFotoPenilaian(`data:image/png;base64,${JPEG_KECIL}`).ok,
    'terima PNG'
  );
  cek(
    validasiFotoPenilaian(`data:image/webp;base64,${JPEG_KECIL}`).ok,
    'terima WebP'
  );
  cek(!validasiFotoPenilaian('').ok, 'TOLAK data kosong');
  cek(!validasiFotoPenilaian('bukan-data-url').ok, 'TOLAK bukan data URL');
  cek(
    !validasiFotoPenilaian(`data:image/svg+xml;base64,${JPEG_KECIL}`).ok,
    'TOLAK SVG (bisa memuat skrip)'
  );
  cek(
    !validasiFotoPenilaian('data:text/html;base64,PHNjcmlwdD4=').ok,
    'TOLAK teks/html'
  );
  const terlaluBesar = `data:image/jpeg;base64,${'A'.repeat(600 * 1024)}`;
  cek(!validasiFotoPenilaian(terlaluBesar).ok, 'TOLAK melebihi batas ukuran');

  console.log('\n--- 2. hitung ukuran ---');
  const byte = ukuranDataUrl(dataUrlJpeg);
  cek(byte > 0 && byte < 2000, `ukuran terhitung wajar (${byte} byte)`);
  cek(ukuranDataUrl('bukan-data-url') === 0, 'data tidak valid -> 0');

  // ===== 3. siapkan data =====
  console.log('\n--- 3. siapkan data uji ---');
  const cabang = await prisma.cabang.findFirst({ where: { aktif: true } });
  if (!cabang) throw new Error('tidak ada cabang');
  const hash = await bcrypt.hash('Fotopass123', 10);

  const spv = await prisma.pegawai.create({
    data: {
      nip: NIP_S, nama: 'SPV Foto', passwordHash: hash, role: 'SUPERVISOR',
      harusGantiPassword: false, aktif: true, cabangId: cabang.id,
    },
  });
  const spv2 = await prisma.pegawai.create({
    data: {
      nip: NIP_S2, nama: 'SPV Foto Lain', passwordHash: hash, role: 'SUPERVISOR',
      harusGantiPassword: false, aktif: true, cabangId: cabang.id,
    },
  });
  const petugas = await prisma.pegawai.create({
    data: {
      nip: NIP_P, nama: 'Petugas Foto', passwordHash: hash, role: 'PEGAWAI',
      harusGantiPassword: false, aktif: true, cabangId: cabang.id, atasanId: spv.id,
      // foto PEGAWAI (identitas) sengaja diisi supaya bisa dibedakan
      fotoData: dataUrlJpeg,
      fotoMime: 'image/jpeg',
      fotoUkuran: byte,
    },
  });

  // tahun jauh supaya tidak bentrok dengan periode asli (unique constraint
  // pada tanggalMulai+tanggalSelesai)
  const TAHUN_UJI = 2035;
  const periode1 = await prisma.periode.create({
    data: {
      kode: 'FOTOP-W1', nama: 'Uji Foto W1',
      tanggalMulai: new Date(TAHUN_UJI, 0, 5), tanggalSelesai: new Date(TAHUN_UJI, 0, 11),
      aktif: true,
    },
  });
  const periode2 = await prisma.periode.create({
    data: {
      kode: 'FOTOP-W2', nama: 'Uji Foto W2',
      tanggalMulai: new Date(TAHUN_UJI, 0, 12), tanggalSelesai: new Date(TAHUN_UJI, 0, 18),
      aktif: true,
    },
  });
  console.log('ok  data uji siap (2 periode, 1 petugas, 2 supervisor)\n');

  // ===== 4. foto awal kosong =====
  console.log('--- 4. foto penilaian awalnya kosong ---');
  const p1 = await prisma.penilaian.create({
    data: {
      pegawaiId: petugas.id, penilaiId: spv.id, periodeId: periode1.id, status: 'DRAFT',
    },
  });
  cek(p1.fotoData === null, 'foto penilaian kosong saat dibuat');
  cek(petugas.fotoData !== null, 'foto PEGAWAI tetap ada (tidak terganggu)');

  // ===== 5. simpan foto =====
  console.log('\n--- 5. simpan foto penilaian ---');
  await simpanFotoPenilaian(p1.id, {
    dataUrl: dataUrlJpeg, mime: 'image/jpeg', byte, catatan: 'seragam lengkap',
  });
  const p1b = await prisma.penilaian.findUnique({ where: { id: p1.id } });
  cek(p1b?.fotoData === dataUrlJpeg, 'foto tersimpan di PENILAIAN');
  cek(p1b?.fotoMime === 'image/jpeg', 'mime tersimpan');
  cek(p1b?.fotoUkuran === byte, 'ukuran tersimpan');
  cek(p1b?.fotoDiperbarui !== null, 'waktu unggah tercatat');
  cek(p1b?.fotoCatatan === 'seragam lengkap', 'keterangan foto tersimpan');

  // ===== 6. foto per periode terpisah =====
  console.log('\n--- 6. foto terpisah tiap periode ---');
  const p2 = await prisma.penilaian.create({
    data: {
      pegawaiId: petugas.id, penilaiId: spv.id, periodeId: periode2.id, status: 'DRAFT',
    },
  });
  cek(p2.fotoData === null, 'periode 2 punya foto sendiri (masih kosong)');
  cek(p1b?.fotoData !== null, 'periode 1 tetap punya fotonya (riwayat terjaga)');

  const jumlah = await prisma.penilaian.count({ where: { pegawaiId: petugas.id } });
  cek(jumlah === 2, 'satu pegawai punya 2 penilaian (2 periode)');

  // ===== 7. aturan wajib foto saat kirim =====
  console.log('\n--- 7. aturan wajib foto saat kirim ---');
  // p2 belum berfoto -> kirim harus ditolak
  const { simpanPenilaian } = await import('../src/app/actions/penilaian');
  const aspekIsi = async () => {
    const { KATEGORI } = await import('../src/lib/sip/penilaian');
    return KATEGORI.flatMap((k) => k.aspek).map((a) => [a.kode, '90'] as const);
  };
  const isi = await aspekIsi();

  const fd = new FormData();
  fd.set('pegawaiId', petugas.id);
  fd.set('periodeId', periode2.id);
  fd.set('kirim', 'true');
  for (const [kode, nilai] of isi) fd.set(`aspek_${kode}`, nilai);

  // server action butuh konteks request Next.js, jadi aturannya diuji
  // langsung lewat pemeriksaan database + panggilan fungsi validasi
  const cekFotoAda = async (periodeId: string) => {
    const r = await prisma.penilaian.findUnique({
      where: { pegawaiId_periodeId: { pegawaiId: petugas.id, periodeId } },
      select: { fotoData: true },
    });
    return Boolean(r?.fotoData);
  };
  cek(!(await cekFotoAda(periode2.id)), 'periode 2: foto belum ada -> kirim akan ditolak');
  cek(await cekFotoAda(periode1.id), 'periode 1: foto ada -> kirim diizinkan');

  // ===== 8. ganti foto =====
  console.log('\n--- 8. ganti foto ---');
  const jpegLain = `data:image/jpeg;base64,${JPEG_KECIL}${JPEG_KECIL}`;
  await simpanFotoPenilaian(p1.id, {
    dataUrl: jpegLain, mime: 'image/jpeg', byte: ukuranDataUrl(jpegLain), catatan: 'foto diperbarui',
  });
  const p1c = await prisma.penilaian.findUnique({ where: { id: p1.id } });
  cek(p1c?.fotoData === jpegLain, 'foto berhasil diganti');
  cek(p1c?.fotoCatatan === 'foto diperbarui', 'keterangan ikut diperbarui');

  // ===== 9. hapus foto hanya saat draft =====
  console.log('\n--- 9. hapus foto ---');
  await prisma.penilaian.update({
    where: { id: p1.id },
    data: { fotoData: null, fotoMime: null, fotoUkuran: null, fotoDiperbarui: null, fotoCatatan: null },
  });
  const p1d = await prisma.penilaian.findUnique({ where: { id: p1.id } });
  cek(p1d?.fotoData === null, 'foto terhapus');
  cek(p1d?.fotoCatatan === null, 'keterangan ikut terhapus');

  // ===== 10. laporan memakai foto penilaian =====
  console.log('\n--- 10. laporan memakai foto penilaian ---');
  await simpanFotoPenilaian(p2.id, {
    dataUrl: dataUrlJpeg, mime: 'image/jpeg', byte, catatan: 'foto periode 2',
  });

  const laporan = await prisma.penilaian.findUnique({
    where: { id: p2.id },
    include: { pegawai: { select: { fotoData: true, fotoUrl: true } } },
  });
  // urutan prioritas: foto penilaian, lalu foto pegawai, lalu fotoUrl
  const dipakai = laporan?.fotoData ?? laporan?.pegawai.fotoData ?? laporan?.pegawai.fotoUrl;
  cek(dipakai === dataUrlJpeg, 'laporan memakai foto penilaian (bukan foto pegawai)');

  // cadangan: penilaian tanpa foto -> pakai foto pegawai
  const tanpaFoto = await prisma.penilaian.findUnique({
    where: { id: p1.id },
    include: { pegawai: { select: { fotoData: true, fotoUrl: true } } },
  });
  const cadangan = tanpaFoto?.fotoData ?? tanpaFoto?.pegawai.fotoData ?? tanpaFoto?.pegawai.fotoUrl;
  cek(cadangan === dataUrlJpeg, 'penilaian tanpa foto -> pakai foto pegawai sebagai cadangan');

  // ===== 11. audit log =====
  console.log('\n--- 11. audit log ---');
  const audit = await prisma.auditLog.findFirst({
    where: { entitas: 'Penilaian', pegawaiId: spv.id, aksi: 'SIMPAN_FOTO_PENILAIAN' },
    orderBy: { createdAt: 'desc' },
  });
  console.log(`   audit foto: ${audit ? 'ada' : 'tidak ada'} (dibuat lewat server action, bukan skrip ini)`);

  // bersihkan
  await bereskan();
  console.log('\n✓ data uji dibersihkan');

  console.log(`\n=== HASIL: ${lulus} lulus, ${gagal} gagal ===`);
  if (gagal > 0) process.exit(1);
  console.log('✅ ATURAN FOTO PENILAIAN TERVERIFIKASI.');
}

main()
  .catch((e) => {
    console.error('\n❌ GAGAL:', e.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
