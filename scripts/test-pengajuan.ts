/**
 * Uji alur pengajuan pegawai end-to-end.
 *
 * Membuktikan aturan keamanan:
 *  - supervisor BOLEH mengajukan, pegawai biasa TIDAK
 *  - cabang di luar wewenang DITOLAK
 *  - NIP yang sudah dipakai / sedang diajukan DITOLAK
 *  - password tersimpan ter-hash, tidak pernah plaintext
 *  - admin menyetujui -> pegawai dibuat dengan role PEGAWAI & wajib ganti password
 *  - NIP terpakai sejak pengajuan -> penolakan saat menyetujui
 *  - pegawai biasa TIDAK bisa menyetujui
 *
 * Jalankan: pnpm exec tsx scripts/test-pengajuan.ts
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

const NIP_SPV = 'AJU00001';
const NIP_SPV2 = 'AJU00002';
const NIP_PEG = 'AJU00003';
const NIP_ADMIN = 'admin';
const NIP_CALON = 'AJU99999';
const NIP_CALON2 = 'AJU99998';

async function bereskan() {
  const calon = await prisma.pegawai.findMany({
    where: { nip: { in: [NIP_CALON, NIP_CALON2] } },
    select: { id: true },
  });
  const ids = calon.map((c) => c.id);
  await prisma.penilaianDetail.deleteMany({
    where: { penilaian: { pegawaiId: { in: ids } } },
  });
  await prisma.penilaian.deleteMany({ where: { pegawaiId: { in: ids } } });
  await prisma.pengajuanPegawai.deleteMany({
    where: { nip: { in: [NIP_CALON, NIP_CALON2] } },
  });
  await prisma.pengajuanPegawai.deleteMany({
    where: { pengaju: { nip: { in: [NIP_SPV, NIP_SPV2, NIP_PEG] } } },
  });
  await prisma.pegawai.deleteMany({ where: { nip: { in: [NIP_CALON, NIP_CALON2] } } });
  await prisma.pegawai.deleteMany({ where: { nip: { in: [NIP_SPV, NIP_SPV2, NIP_PEG] } } });
  // cabang uji
  await prisma.cabang.deleteMany({ where: { kode: 'UJI-LUAR' } });
}

async function main() {
  console.log('=== UJI PENGAJUAN PEGAWAI ===\n');
  await bereskan();

  const {
    ajukanPegawai,
    setujuiPengajuan,
    tolakPengajuan,
    batalkanPengajuan,
    cabangYangBoleh,
  } = await import('../src/lib/sip/pengajuan');

  // ===== siapkan data =====
  const kc = await prisma.cabang.findFirst({
    where: { aktif: true, jenis: 'KC' },
    include: { induk: false },
  });
  const kcp = await prisma.cabang.findFirst({
    where: { aktif: true, jenis: 'KCP', indukId: kc?.id ?? undefined },
  });
  if (!kc) throw new Error('tidak ada cabang KC aktif');

  // Cabang di luar wewenang: database hanya punya satu rantai
  // (KANWIL SULAMPUA > KC MAMUJU > KCP POLEWALI), jadi cabang pembanding
  // dibuat sendiri untuk menguji pembatasan wewenang.
  const KODE_LUAR = 'UJI-LUAR';
  await prisma.cabang.deleteMany({ where: { kode: KODE_LUAR } });
  const cabangLain = await prisma.cabang.create({
    data: {
      kode: KODE_LUAR,
      nama: 'KC Uji Luar Wewenang',
      jenis: 'KC',
      indukId: kc.indukId, // saudara KC MAMUJU, bukan turunannya
      aktif: true,
    },
  });

  const jabatan = await prisma.jabatan.findFirst({ where: { kode: 'TELLER' } });

  console.log(`ok  KC: ${kc.kode} — ${kc.nama}`);
  console.log(`    KCP di bawahnya: ${kcp ? `${kcp.kode} — ${kcp.nama}` : '(tidak ada)'}`);
  console.log(`    KC lain (dibuat untuk uji): ${cabangLain.kode}\n`);

  const hash = await bcrypt.hash('Ujipass123', 10);
  const spv = await prisma.pegawai.create({
    data: {
      nip: NIP_SPV, nama: 'SPV Ajuan', passwordHash: hash, role: 'SUPERVISOR',
      harusGantiPassword: false, aktif: true, cabangId: kc.id,
    },
  });
  const spv2 = await prisma.pegawai.create({
    data: {
      nip: NIP_SPV2, nama: 'SPV Ajuan 2', passwordHash: hash, role: 'SUPERVISOR',
      harusGantiPassword: false, aktif: true,
      cabangId: cabangLain?.id ?? kc.id,
    },
  });
  const peg = await prisma.pegawai.create({
    data: {
      nip: NIP_PEG, nama: 'Pegawai Ajuan', passwordHash: hash, role: 'PEGAWAI',
      harusGantiPassword: false, aktif: true, cabangId: kc.id,
    },
  });
  const admin = await prisma.pegawai.findUnique({ where: { nip: NIP_ADMIN } });
  if (!admin) throw new Error('admin tidak ada');

  // ===== 1. cakupan cabang =====
  console.log('--- 1. cakupan cabang supervisor ---');
  const boleh = await cabangYangBoleh(spv.id, 'SUPERVISOR', kc.id);
  cek(boleh.includes(kc.id), 'cabang sendiri termasuk');
  if (kcp) cek(boleh.includes(kcp.id), 'KCP di bawahnya termasuk');
  if (cabangLain) cek(!boleh.includes(cabangLain.id), 'KC lain TIDAK termasuk');

  const bolehAdmin = await cabangYangBoleh(admin.id, 'ADMIN', kc.id);
  const totalCabang = await prisma.cabang.count();
  cek(bolehAdmin.length === totalCabang, `admin mencakup semua cabang (${bolehAdmin.length})`);

  // ===== 2. supervisor boleh mengajukan =====
  console.log('\n--- 2. supervisor mengajukan ---');
  const h1 = await ajukanPegawai(spv.id, {
    nip: NIP_CALON,
    nama: 'Calon Pegawai',
    password: 'Rahasia123',
    cabangId: kc.id,
    jabatanId: jabatan?.id,
    catatan: 'pegawai baru pindahan',
  });
  cek(h1.sukses === true, `pengajuan berhasil: ${h1.pesan ?? h1.error}`);

  const diajukan = await prisma.pengajuanPegawai.findUnique({
    where: { id: h1.pengajuanId! },
  });
  cek(diajukan?.status === 'MENUNGGU', 'status MENUNGGU');
  cek(
    diajukan?.passwordHash !== undefined && diajukan.passwordHash !== 'Rahasia123',
    'password TIDAK tersimpan sebagai teks biasa'
  );
  const cocok = await bcrypt.compare('Rahasia123', diajukan!.passwordHash);
  cek(cocok, 'password ter-hash dan bisa diverifikasi');

  // ===== 3. yang tidak boleh mengajukan =====
  console.log('\n--- 3. yang TIDAK boleh mengajukan ---');
  const h2 = await ajukanPegawai(peg.id, {
    nip: NIP_CALON2, nama: 'Calon Dua', password: 'Rahasia123', cabangId: kc.id,
  });
  cek(Boolean(h2.error), `pegawai biasa DITOLAK: "${h2.error}"`);

  // ===== 4. cabang di luar wewenang =====
  console.log('\n--- 4. cabang di luar wewenang ---');
  if (cabangLain) {
    // pakai NIP unik supaya tidak bentrok dengan uji NIP ganda di bagian 5
    const h3 = await ajukanPegawai(spv.id, {
      nip: 'NIPLUAR1', nama: 'Calon Luar', password: 'Rahasia123',
      cabangId: cabangLain.id,
    });
    cek(
      Boolean(h3.error) && /unit kerja|hanya/i.test(h3.error ?? ''),
      `cabang lain DITOLAK: "${h3.error}"`
    );
  }

  // ===== 5. NIP ganda =====
  console.log('\n--- 5. NIP ganda ---');
  const h4 = await ajukanPegawai(spv.id, {
    nip: NIP_SPV2, nama: 'NIP Bentrok', password: 'Rahasia123', cabangId: kc.id,
  });
  cek(Boolean(h4.error), `NIP sudah dipakai DITOLAK: "${h4.error}"`);

  const h5 = await ajukanPegawai(spv2.id, {
    nip: NIP_CALON, nama: 'NIP Sedang Diajukan', password: 'Rahasia123',
    cabangId: cabangLain?.id ?? kc.id,
  });
  cek(Boolean(h5.error), `NIP sedang diajukan orang lain DITOLAK: "${h5.error}"`);

  // ===== 6. validasi format =====
  console.log('\n--- 6. validasi masukan ---');
  const h6 = await ajukanPegawai(spv.id, {
    nip: 'ab', nama: 'NIP Pendek', password: 'Rahasia123', cabangId: kc.id,
  });
  cek(Boolean(h6.error), `NIP terlalu pendek DITOLAK`);

  const h7 = await ajukanPegawai(spv.id, {
    nip: 'NIPVALID1', nama: 'Ab', password: 'Rahasia123', cabangId: kc.id,
  });
  cek(Boolean(h7.error), `nama terlalu pendek DITOLAK`);

  const h8 = await ajukanPegawai(spv.id, {
    nip: 'NIPVALID2', nama: 'Nama Cukup', password: '123', cabangId: kc.id,
  });
  cek(Boolean(h8.error), `password terlalu pendek DITOLAK: "${h8.error}"`);

  const h9 = await ajukanPegawai(spv.id, {
    nip: 'NIPVALID3', nama: 'Nama Cukup', password: 'Rahasia123', cabangId: kc.id,
  });
  cek(h9.sukses === true, `password 8 karakter DITERIMA (${h9.error ?? 'sukses'})`);
  if (h9.sukses) {
    await prisma.pengajuanPegawai.deleteMany({ where: { nip: 'NIPVALID3' } });
  }

  // ===== 7. hanya admin yang menyetujui =====
  console.log('\n--- 7. hak menyetujui ---');
  const s1 = await setujuiPengajuan(spv.id, h1.pengajuanId!);
  cek(Boolean(s1.error), `supervisor TIDAK bisa menyetujui: "${s1.error}"`);

  // ===== 8. admin menyetujui =====
  console.log('\n--- 8. admin menyetujui ---');
  const s2 = await setujuiPengajuan(admin.id, h1.pengajuanId!, 'disetujui, data lengkap');
  cek(s2.sukses === true, `disetujui: ${s2.pesan ?? s2.error}`);

  const baru = await prisma.pegawai.findUnique({ where: { nip: NIP_CALON } });
  cek(baru !== null, 'pegawai baru dibuat');
  cek(baru?.role === 'PEGAWAI', `role dipaksa PEGAWAI (${baru?.role})`);
  cek(baru?.aktif === true, 'pegawai aktif');
  cek(baru?.harusGantiPassword === true, 'wajib ganti password saat login pertama');
  cek(baru?.cabangId === kc.id, 'ditempatkan di cabang yang diajukan');
  cek(
    baru?.passwordHash === diajukan?.passwordHash,
    'password ter-hash dipindah apa adanya (tidak ada yang melihat teks asli)'
  );

  const setelah = await prisma.pengajuanPegawai.findUnique({
    where: { id: h1.pengajuanId! },
  });
  cek(setelah?.status === 'DISETUJUI', 'status pengajuan DISETUJUI');
  cek(setelah?.pegawaiId === baru?.id, 'pengajuan tertaut ke pegawai hasil');

  // ===== 9. tidak bisa diputuskan dua kali =====
  console.log('\n--- 9. keputusan ganda ---');
  const s3 = await setujuiPengajuan(admin.id, h1.pengajuanId!);
  cek(Boolean(s3.error), `tidak bisa disetujui dua kali: "${s3.error}"`);
  const t3 = await tolakPengajuan(admin.id, h1.pengajuanId!, 'alasan apa saja');
  cek(Boolean(t3.error), `tidak bisa ditolak setelah disetujui: "${t3.error}"`);

  // ===== 10. penolakan wajib beralasan =====
  console.log('\n--- 10. penolakan ---');
  // NIP_CALON2 masih dipakai draf pengajuan gagal di bagian 4/5 kalau
  // kebetulan lolos, jadi pakai NIP yang pasti bersih
  const h10 = await ajukanPegawai(spv.id, {
    nip: 'NIPTOLAK1', nama: 'Calon Ditolak', password: 'Rahasia123', cabangId: kc.id,
  });
  cek(h10.sukses === true, `pengajuan untuk ditolak dibuat (${h10.error ?? 'sukses'})`);

  if (h10.pengajuanId) {
    const t1 = await tolakPengajuan(admin.id, h10.pengajuanId, 'no');
    cek(Boolean(t1.error), `alasan terlalu pendek DITOLAK: "${t1.error}"`);

    const t2 = await tolakPengajuan(admin.id, h10.pengajuanId, 'NIP tidak sesuai data kepegawaian');
    cek(t2.sukses === true, `ditolak dengan alasan: ${t2.pesan ?? t2.error}`);

    const calonDitolak = await prisma.pegawai.findUnique({ where: { nip: 'NIPTOLAK1' } });
    cek(calonDitolak === null, 'pegawai TIDAK dibuat saat pengajuan ditolak');
  }

  // ===== 11. pembatalan oleh pengaju sendiri =====
  console.log('\n--- 11. pembatalan ---');
  const h11 = await ajukanPegawai(spv.id, {
    nip: 'NIPBATAL1', nama: 'Calon Batal', password: 'Rahasia123', cabangId: kc.id,
  });
  if (h11.sukses) {
    const b1 = await batalkanPengajuan(spv2.id, h11.pengajuanId!);
    cek(Boolean(b1.error), `orang lain TIDAK bisa membatalkan: "${b1.error}"`);

    const b2 = await batalkanPengajuan(spv.id, h11.pengajuanId!);
    cek(b2.sukses === true, `pengaju sendiri BOLEH membatalkan: ${b2.pesan ?? b2.error}`);

    const hilang = await prisma.pengajuanPegawai.findUnique({
      where: { id: h11.pengajuanId! },
    });
    cek(hilang === null, 'pengajuan yang dibatalkan terhapus');
  }

  // ===== 12. NIP bentrok saat persetujuan =====
  console.log('\n--- 12. NIP bentrok sejak pengajuan dibuat ---');
  const h12 = await ajukanPegawai(spv.id, {
    nip: 'NIPBENT1', nama: 'Calon Bentrok', password: 'Rahasia123', cabangId: kc.id,
  });
  if (h12.sukses) {
    // buat pegawai lain dengan NIP itu setelah pengajuan dibuat
    const pengganggu = await prisma.pegawai.create({
      data: {
        nip: 'NIPBENT1', nama: 'Pengganggu', passwordHash: hash, role: 'PEGAWAI',
        harusGantiPassword: false, aktif: true, cabangId: kc.id,
      },
    });
    const s12 = await setujuiPengajuan(admin.id, h12.pengajuanId!);
    cek(Boolean(s12.error), `persetujuan DITOLAK karena NIP terpakai: "${s12.error}"`);

    await prisma.pegawai.delete({ where: { id: pengganggu.id } });
    await prisma.pengajuanPegawai.deleteMany({ where: { nip: 'NIPBENT1' } });
  }

  // ===== 13. audit log =====
  console.log('\n--- 13. audit log ---');
  const audit = await prisma.auditLog.findMany({
    where: { entitas: 'PengajuanPegawai' },
    orderBy: { createdAt: 'desc' },
  });
  const aksi = new Set(audit.map((a) => a.aksi));
  cek(aksi.has('AJUKAN_PEGAWAI'), 'AJUKAN_PEGAWAI tercatat');
  cek(aksi.has('SETUJUI_PENGAJUAN_PEGAWAI'), 'SETUJUI_PENGAJUAN_PEGAWAI tercatat');
  cek(aksi.has('TOLAK_PENGAJUAN_PEGAWAI'), 'TOLAK_PENGAJUAN_PEGAWAI tercatat');

  // bersihkan
  await prisma.auditLog.deleteMany({ where: { entitas: 'PengajuanPegawai' } });
  await bereskan();
  await prisma.pengajuanPegawai.deleteMany({
    where: { nip: { in: ['NIPVALID3', 'NIPBATAL1', 'NIPBENT1', 'NIPVALID1', 'NIPVALID2'] } },
  });
  console.log('\n✓ data uji dibersihkan');

  console.log(`\n=== HASIL: ${lulus} lulus, ${gagal} gagal ===`);
  if (gagal > 0) process.exit(1);
  console.log('✅ PENGAJUAN PEGAWAI TERVERIFIKASI.');
}

main()
  .catch((e) => {
    console.error('\n❌ GAGAL:', e.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
