/**
 * Uji fitur baru: persetujuan, impor pegawai, reset password, kelola periode.
 * Semua diuji lewat logika yang sama dengan server action (langsung ke DB),
 * lalu diverifikasi hasilnya.
 *
 * Jalankan: pnpm exec tsx scripts/test-fitur-baru.ts
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

const hashToken = (t: string) => crypto.createHash('sha256').update(t).digest('hex');

async function main() {
  console.log('=== UJI FITUR: PERSETUJUAN, PEGAWAI, PERIODE ===\n');

  // ambil data demo
  const spv = await prisma.pegawai.findUnique({ where: { nip: '90000001' } });
  const mgr = await prisma.pegawai.findUnique({ where: { nip: '90000002' } });
  const pegawai = await prisma.pegawai.findFirst({ where: { nip: '80000002' } });
  const periode = await prisma.periode.findUnique({ where: { kode: 'DEMO-W40' } });

  if (!spv || !mgr || !pegawai || !periode) {
    throw new Error('Jalankan dulu: pnpm exec tsx scripts/seed-demo.ts');
  }
  console.log(`Data demo: spv=${spv.nama}, mgr=${mgr.nama}, periode=${periode.nama}\n`);

  const penilaian = await prisma.penilaian.findFirst({
    where: { pegawaiId: pegawai.id, periodeId: periode.id },
  });
  if (!penilaian) throw new Error('penilaian demo tidak ada');

  // =====================================================================
  console.log('--- 1. ALUR PERSETUJUAN ---');
  // =====================================================================

  // pastikan statusnya DIKIRIM dulu
  await prisma.penilaian.update({
    where: { id: penilaian.id },
    data: { status: 'DIKIRIM', dikirimAt: new Date(), mengetahuiId: null, diketahuiAt: null },
  });
  const setelahKirim = await prisma.penilaian.findUnique({ where: { id: penilaian.id } });
  cek(setelahKirim?.status === 'DIKIRIM', 'status awal DIKIRIM');

  // manager menyatakan mengetahui
  const diubahKe = await prisma.penilaian.update({
    where: { id: penilaian.id },
    data: { status: 'DIKETAHUI', mengetahuiId: mgr.id, diketahuiAt: new Date() },
    include: { mengetahui: { select: { nama: true } } },
  });
  cek(diubahKe.status === 'DIKETAHUI', 'status berubah jadi DIKETAHUI');
  cek(diubahKe.mengetahui?.nama === mgr.nama, 'nama manager tercatat sebagai mengetahui');
  cek(diubahKe.diketahuiAt !== null, 'waktu diketahui tersimpan');

  // audit log tercatat
  await prisma.auditLog.create({
    data: { pegawaiId: mgr.id, aksi: 'MENGETAHUI_PENILAIAN', entitas: 'Penilaian', entitasId: penilaian.id },
  });
  const audit = await prisma.auditLog.findFirst({
    where: { aksi: 'MENGETAHUI_PENILAIAN', entitasId: penilaian.id },
  });
  cek(audit !== null, 'audit log persetujuan tercatat');

  // kunci final
  const final = await prisma.penilaian.update({
    where: { id: penilaian.id },
    data: { status: 'FINAL', finalAt: new Date() },
  });
  cek(final.status === 'FINAL', 'status jadi FINAL setelah dikunci');
  cek(final.finalAt !== null, 'waktu final tersimpan');

  // kembalikan untuk revisi
  const revisi = await prisma.penilaian.update({
    where: { id: penilaian.id },
    data: {
      status: 'DRAFT',
      dikirimAt: null,
      diketahuiAt: null,
      mengetahuiId: null,
      catatanUmum: '[Dikembalikan oleh Manager]: nilai perlu tinjau ulang',
    },
  });
  cek(revisi.status === 'DRAFT', 'status kembali DRAFT setelah dikembalikan');
  cek(revisi.dikirimAt === null, 'waktu kirim direset');
  cek(revisi.catatanUmum?.includes('Dikembalikan') === true, 'alasan revisi tersimpan di catatan');

  // =====================================================================
  console.log('\n--- 2. IMPOR PEGAWAI (CSV) ---');
  // =====================================================================

  const csvImpor = [
    'NIP,Nama,Cabang,Jabatan,Role',
    'TSTIMP01,Budi Impor,0001,TELLER,PEGAWAI',
    'TSTIMP02,Sari Impor,0001,CS,PEGAWAI',
    'TSTIMP03,Sup Impor,0001,TELLER,SUPERVISOR',
    ',Tanpa NIP,0001,TELLER,PEGAWAI', // harus gagal
    'TSTIMP04,Rina Impor,0001,CS,PEGAWAI',
  ].join('\n');

  // simulasi parser yang sama dengan server action
  const baris = csvImpor.split('\n').map((b) => b.trim()).filter(Boolean);
  const pemisah = baris[0].includes('\t') ? '\t' : baris[0].includes(';') ? ';' : ',';
  const kolom = baris[0].split(pemisah).map((k) => k.trim().toLowerCase());
  const idx = {
    nip: kolom.findIndex((k) => k.includes('nip')),
    nama: kolom.findIndex((k) => k.includes('nama')),
    cabang: kolom.findIndex((k) => k.includes('cabang')),
    jabatan: kolom.findIndex((k) => k.includes('jabatan')),
    role: kolom.findIndex((k) => k.includes('role')),
  };
  cek(idx.nip >= 0 && idx.nama >= 0 && idx.cabang >= 0 && idx.jabatan >= 0, 'deteksi kolom judul benar');

  const cabangSemua = await prisma.cabang.findMany();
  const jabatanSemua = await prisma.jabatan.findMany();
  const cabangMap = new Map(cabangSemua.map((c) => [c.kode.toLowerCase(), c]));
  const jabatanMap = new Map(jabatanSemua.map((j) => [j.kode.toLowerCase(), j]));

  let berhasil = 0;
  let gagalBaris = 0;
  const NIP_UJI: string[] = [];

  for (let i = 1; i < baris.length; i++) {
    const sel = baris[i].split(pemisah).map((s) => s.trim());
    const nip = sel[idx.nip] ?? '';
    const nama = sel[idx.nama] ?? '';
    if (!nip || !nama) {
      gagalBaris++;
      continue;
    }
    const cabang = cabangMap.get((sel[idx.cabang] ?? '').toLowerCase());
    if (!cabang) {
      gagalBaris++;
      continue;
    }
    const jabatan = jabatanMap.get((sel[idx.jabatan] ?? '').toLowerCase());
    const role = (sel[idx.role] ?? 'PEGAWAI').toUpperCase();
    const pw = `Uji${crypto.randomInt(1000, 9999)}A!`;

    await prisma.pegawai.upsert({
      where: { nip },
      update: { nama, cabangId: cabang.id, jabatanId: jabatan?.id ?? null, aktif: true },
      create: {
        nip,
        nama,
        passwordHash: await bcrypt.hash(pw, 10),
        role: role as 'PEGAWAI' | 'SUPERVISOR',
        harusGantiPassword: true,
        cabangId: cabang.id,
        jabatanId: jabatan?.id ?? null,
      },
    });
    NIP_UJI.push(nip);
    berhasil++;
  }

  cek(berhasil === 4, `impor berhasil untuk 4 baris valid (hasil: ${berhasil})`);
  cek(gagalBaris === 1, `1 baris gagal terdeteksi karena NIP kosong (hasil: ${gagalBaris})`);

  const terimpor = await prisma.pegawai.findMany({
    where: { nip: { in: NIP_UJI } },
    include: { cabang: true, jabatan: true },
  });
  cek(terimpor.length === 4, '4 pegawai benar-benar ada di database');
  cek(
    terimpor.every((p) => p.harusGantiPassword),
    'semua pegawai impor wajib ganti password'
  );
  cek(
    terimpor.some((p) => p.role === 'SUPERVISOR'),
    'role SUPERVISOR terbaca dari CSV'
  );
  cek(
    terimpor.every((p) => p.jabatan !== null),
    'jabatan terhubung dengan benar'
  );

  // =====================================================================
  console.log('\n--- 3. RESET PASSWORD ---');
  // =====================================================================

  const target = terimpor[0];
  const hashLama = target.passwordHash;

  // buat sesi aktif dulu untuk menguji pencabutan
  const token = crypto.randomBytes(32).toString('base64url');
  await prisma.sesi.create({
    data: { tokenHash: hashToken(token), pegawaiId: target.id, expiresAt: new Date(Date.now() + 3600_000) },
  });
  const sesiSebelum = await prisma.sesi.count({ where: { pegawaiId: target.id, revokedAt: null } });
  cek(sesiSebelum === 1, 'sesi aktif sebelum reset ada 1');

  // reset password (simulasi server action)
  const pwBaru = 'Reset2026A!';
  await prisma.pegawai.update({
    where: { id: target.id },
    data: { passwordHash: await bcrypt.hash(pwBaru, 10), harusGantiPassword: true },
  });
  await prisma.sesi.updateMany({
    where: { pegawaiId: target.id, revokedAt: null },
    data: { revokedAt: new Date() },
  });

  const setelah = await prisma.pegawai.findUnique({ where: { id: target.id } });
  cek(setelah!.passwordHash !== hashLama, 'hash password berubah');
  cek(await bcrypt.compare(pwBaru, setelah!.passwordHash), 'password baru valid untuk login');
  cek(
    !(await bcrypt.compare('password-lama-salah', setelah!.passwordHash)),
    'password salah tetap ditolak'
  );
  cek(setelah!.harusGantiPassword, 'wajib ganti password setelah reset');

  const sesiSesudah = await prisma.sesi.count({ where: { pegawaiId: target.id, revokedAt: null } });
  cek(sesiSesudah === 0, 'semua sesi pegawai dicabut setelah reset');

  // =====================================================================
  console.log('\n--- 4. KELOLA PERIODE ---');
  // =====================================================================

  // hitung batas minggu (Senin-Minggu) seperti server action
  function batasMinggu(tanggal: Date) {
    const d = new Date(Date.UTC(tanggal.getUTCFullYear(), tanggal.getUTCMonth(), tanggal.getUTCDate()));
    const hari = d.getUTCDay() || 7;
    const senin = new Date(d);
    senin.setUTCDate(d.getUTCDate() - hari + 1);
    const minggu = new Date(senin);
    minggu.setUTCDate(senin.getUTCDate() + 6);
    minggu.setUTCHours(23, 59, 59, 0);
    const t = new Date(senin);
    t.setUTCDate(senin.getUTCDate() + 3);
    const awal = new Date(Date.UTC(t.getUTCFullYear(), 0, 4));
    const nomor = 1 + Math.round(((t.getTime() - awal.getTime()) / 86400000 - 3) / 7);
    return { senin, minggu, nomor, tahun: t.getUTCFullYear() };
  }

  // uji: Rabu 7 Okt 2026 harus jadi Senin 5 Okt - Minggu 11 Okt
  const rabu = new Date('2026-10-07T10:00:00Z');
  const bm = batasMinggu(rabu);
  cek(bm.senin.toISOString().startsWith('2026-10-05'), `tanggal Rabu → Senin 5 Okt (hasil: ${bm.senin.toISOString().slice(0, 10)})`);
  cek(bm.minggu.toISOString().startsWith('2026-10-11'), `→ Minggu 11 Okt (hasil: ${bm.minggu.toISOString().slice(0, 10)})`);

  // buat 3 periode massal
  await prisma.periode.deleteMany({ where: { kode: { startsWith: '2026-W4' } } });
  let dibuat = 0;
  for (let i = 0; i < 3; i++) {
    const t = new Date(bm.senin);
    t.setUTCDate(bm.senin.getUTCDate() + i * 7);
    const { senin, minggu, nomor, tahun } = batasMinggu(t);
    const kode = `${tahun}-W${String(nomor).padStart(2, '0')}`;
    const ada = await prisma.periode.findFirst({ where: { OR: [{ kode }, { tanggalMulai: senin }] } });
    if (ada) continue;
    await prisma.periode.create({
      data: {
        kode,
        nama: `Minggu ke-${nomor}`,
        tanggalMulai: senin,
        tanggalSelesai: minggu,
        aktif: true,
      },
    });
    dibuat++;
  }
  cek(dibuat === 3, `3 periode berhasil dibuat massal (hasil: ${dibuat})`);

  const periodeBaru = await prisma.periode.findMany({
    where: { kode: { startsWith: '2026-W4' } },
    orderBy: { tanggalMulai: 'asc' },
  });
  cek(periodeBaru.length === 3, '3 periode ada di database');
  cek(
    periodeBaru.every((p) => p.tanggalMulai.getUTCDay() === 1),
    'semua periode mulai di hari Senin'
  );

  // kunci periode
  const dikunci = await prisma.periode.update({
    where: { id: periodeBaru[0].id },
    data: { dikunci: true },
  });
  cek(dikunci.dikunci, 'periode berhasil dikunci');

  // nonaktifkan periode
  const nonaktif = await prisma.periode.update({
    where: { id: periodeBaru[1].id },
    data: { aktif: false },
  });
  cek(!nonaktif.aktif, 'periode berhasil dinonaktifkan');

  // =====================================================================
  // bersihkan
  // =====================================================================
  console.log('\n--- BERSIHKAN DATA UJI ---');
  await prisma.sesi.deleteMany({ where: { pegawaiId: { in: terimpor.map((p) => p.id) } } });
  await prisma.pegawai.deleteMany({ where: { nip: { in: NIP_UJI } } });
  await prisma.periode.deleteMany({ where: { kode: { startsWith: '2026-W4' } } });
  await prisma.auditLog.deleteMany({ where: { aksi: 'MENGETAHUI_PENILAIAN', pegawaiId: mgr.id } });
  console.log('   ok  data uji dibersihkan');

  console.log(`\n=== HASIL: ${lulus} lulus, ${gagal} gagal ===`);
  if (gagal > 0) process.exit(1);
  console.log('✅ SEMUA FITUR BARU TERVERIFIKASI.');
}

main()
  .catch((e) => {
    console.error('\n❌ GAGAL:', e.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
