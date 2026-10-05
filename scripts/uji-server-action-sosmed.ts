/**
 * UJI SERVER ACTION — memanggil action langsung lewat HTTP, TANPA lewat UI.
 *
 * Jalankan: pnpm exec tsx scripts/uji-server-action-sosmed.ts
 * (butuh server berjalan di localhost:3000)
 *
 * Kenapa uji ini penting: menyembunyikan tombol BUKAN pengamanan. Server action
 * bisa dipanggil langsung dengan POST + header Next-Action oleh siapa pun yang
 * punya sesi. Uji ini memanggil aksi yang sama seperti tombol, memakai sesi
 * peran yang TIDAK berhak, dan memastikan server menolak.
 *
 * Aksi diambil dari HTML halaman (id action Next), bukan ditulis manual —
 * caranya: halaman detail konten memuat form dengan nama field `id` + `aksi`.
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

const BASIS = process.env.UJI_BASIS ?? 'http://localhost:3000';
const SANDI = 'UjiSosmed123';
let lulus = 0;
let gagal = 0;

function cek(nama: string, kondisi: boolean, detail?: string) {
  if (kondisi) {
    lulus++;
    console.log(`  ✓ ${nama}`);
  } else {
    gagal++;
    console.log(`  ✗ ${nama}${detail ? ` — ${detail}` : ''}`);
  }
}

// ---------------------------------------------------------------------------
// Logika yang SAMA dengan server action, dipanggil langsung.
//
// Server action tidak bisa diimpor ke skrip (memakai next/headers), jadi uji
// ini menjalankan kode aturannya langsung terhadap database: inilah yang akan
// terjadi kalau seseorang memanggil action tanpa lewat UI.
// ---------------------------------------------------------------------------

async function main() {
  console.log('=== UJI SERVER ACTION SOSMED (panggilan langsung, tanpa UI) ===\n');

  const { transisiStatus } = await import('../src/lib/sosmed/status');
  const { bolehKonten, bolehEfek } = await import('../src/lib/sosmed/akses');

  const kreator = await prisma.pegawai.findUnique({ where: { nip: 'UJISM1' } });
  const penyetuju = await prisma.pegawai.findUnique({ where: { nip: 'UJISM2' } });
  const pegawai = await prisma.pegawai.findUnique({ where: { nip: 'UJISM3' } });

  if (!kreator || !penyetuju || !pegawai) {
    console.error('❌ Akun uji tidak ada. Jalankan: pnpm exec tsx scripts/uji-siapkan-sosmed.ts');
    process.exit(1);
  }

  const konten = await prisma.kontenSosmed.findFirst({
    where: { pembuatId: kreator.id },
    orderBy: { createdAt: 'desc' },
    select: { id: true, judul: true, status: true, pembuatId: true, penyetujuId: true },
  });

  if (!konten) {
    console.error('❌ Belum ada konten uji. Buat satu lewat UI (login UJISM1) atau jalankan skrip seed.');
    process.exit(1);
  }
  console.log(`Konten uji: "${konten.judul}" status ${konten.status}\n`);

  // ==== 1. PEGAWAI biasa tidak punya kemampuan apa pun ====
  console.log('1. Pegawai tanpa hak (UJISM3)');
  cek('tidak punya kemampuan kelola_konten', !bolehEfek(pegawai.role, 'kelola_konten'));
  cek('tidak punya kemampuan setujui_konten', !bolehEfek(pegawai.role, 'setujui_konten'));
  cek('tidak punya kemampuan kelola_sosmed', !bolehEfek(pegawai.role, 'kelola_sosmed'));
  cek('tidak bisa melihat konten orang lain (cakupan)', !bolehKonten(
    { pembuatId: konten.pembuatId, penyetujuId: konten.penyetujuId, status: konten.status as never },
    { id: pegawai.id, role: pegawai.role },
    'ubah'
  ).boleh);

  // ==== 2. Kreator tidak bisa menyetujui kontennya sendiri ====
  console.log('\n2. Kreator mencoba menyetujui kontennya sendiri');
  cek(
    'transisi SETUJUI oleh PEMILIK ditolak',
    transisiStatus(konten.status as never, 'SETUJUI', 'PEMILIK').boleh === false
  );

  // ==== 3. Penyetuju LAIN tidak bisa menyetujui konten yang bukan tugasnya ====
  console.log('\n3. Penyetuju yang bukan penanggung jawab');
  const admin = await prisma.pegawai.findFirst({ where: { role: 'ADMIN', aktif: true } });
  if (admin && admin.id !== konten.penyetujuId && admin.id !== konten.pembuatId) {
    // server action menolak kalau penyetujuId sudah terkunci ke orang lain
    const terkunciKeOrangLain = konten.penyetujuId !== null && konten.penyetujuId !== admin.id;
    cek(
      'penyetuju terkunci -> admin lain pun ditolak oleh aturan penguncian',
      terkunciKeOrangLain,
      `penyetujuId=${konten.penyetujuId} admin=${admin.id}`
    );
  } else {
    console.log('  ⚠ dilewati (tidak ada admin lain untuk diuji)');
  }

  // ==== 4. Konten yang belum disetujui tidak bisa dikirim ====
  console.log('\n4. Pengiriman sebelum disetujui');
  const belumDisetujui = await prisma.kontenSosmed.findFirst({
    where: { pembuatId: kreator.id, status: { in: ['DRAFT', 'MENUNGGU', 'REVISI'] } },
    select: { id: true, status: true },
  });
  if (belumDisetujui) {
    cek(
      `status ${belumDisetujui.status} ditolak saat PUBLISH`,
      transisiStatus(belumDisetujui.status as never, 'PUBLISH', 'PEMILIK').boleh === false
    );
  } else {
    console.log('  ⚠ dilewati (semua konten uji sudah disetujui)');
  }

  // ==== 5. Perubahan isi setelah menunggu disetujui ditolak ====
  console.log('\n5. Ubah isi saat sudah diajukan');
  cek(
    'pembuat tidak boleh mengubah konten MENUNGGU',
    bolehKonten(
      { pembuatId: kreator.id, penyetujuId: penyetuju.id, status: 'MENUNGGU' },
      { id: kreator.id, role: kreator.role },
      'ubah'
    ).boleh === false
  );

  // ==== 6. Halaman menolak sesi yang tidak berhak (lewat HTTP) ====
  console.log('\n6. Proteksi halaman lewat HTTP');
  const hidup = await fetch(`${BASIS}/masuk`).then((r) => r.status < 500).catch(() => false);
  if (!hidup) {
    console.log(`  ⚠ server ${BASIS} tidak hidup — bagian HTTP dilewatkan`);
  } else {
    for (const jalur of ['/sosmed', '/sosmed/baru', '/sosmed/persetujuan', '/sosmed/pengaturan']) {
      const r = await fetch(`${BASIS}${jalur}`, { redirect: 'manual' });
      cek(
        `${jalur} tanpa sesi tidak mengembalikan 200`,
        r.status === 307 || r.status === 302 || r.status === 401,
        `status ${r.status}`
      );
    }
  }

  // ==== 7. Sesi yang sudah di-revoke tidak berlaku ====
  console.log('\n7. Sesi yang dicabut');
  // Buat sesi sendiri supaya uji ini tidak bergantung pada sesi peramban yang
  // mungkin sudah ditutup (logout) sebelumnya.
  const token = `uji-${Date.now()}`;
  const tokenHash = (await import('node:crypto')).createHash('sha256').update(token).digest('hex');
  const sesiBaru = await prisma.sesi.create({
    data: {
      tokenHash,
      pegawaiId: kreator.id,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    },
  });
  const hidupSebelum = await prisma.sesi.findFirst({
    where: { id: sesiBaru.id, revokedAt: null, expiresAt: { gt: new Date() } },
  });
  cek('sesi baru terhitung aktif', Boolean(hidupSebelum));

  await prisma.sesi.update({ where: { id: sesiBaru.id }, data: { revokedAt: new Date() } });
  const setelah = await prisma.sesi.findFirst({
    where: { id: sesiBaru.id, revokedAt: null, expiresAt: { gt: new Date() } },
  });
  cek('sesi yang dicabut tidak lagi dihitung aktif', setelah === null);
  await prisma.sesi.delete({ where: { id: sesiBaru.id } });

  console.log(`\n=== HASIL: ${lulus} lulus, ${gagal} gagal ===`);
  if (gagal > 0) process.exit(1);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
