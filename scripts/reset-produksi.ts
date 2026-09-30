/**
 * Bersihkan database dari data uji lalu buat ulang akun admin.
 *
 * Gunakan ini pada database PRODUKSI setelah selesai pengembangan, supaya
 * akun demo (Andi/Siti/Budi/Dewi/Hendra) dan periode uji tidak tertinggal.
 *
 * Jalankan:
 *   ADMIN_PASSWORD='PasswordAnda123' pnpm exec tsx scripts/reset-produksi.ts
 *
 * Opsi tambahan:
 *   --simpan-demo   hanya reset admin, jangan hapus data demo
 *   --nama "Nama"   ganti nama admin (default: Administrator)
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

/** NIP yang dibuat oleh seed-demo.ts — inilah yang dibersihkan. */
const NIP_DEMO = ['80000001', '80000002', '80000003', '90000001', '90000002'];
/** Kode periode yang dibuat seed-demo.ts. */
const KODE_PERIODE_DEMO = ['DEMO-W40'];

async function main() {
  const simpanDemo = process.argv.includes('--simpan-demo');
  const password = process.env.ADMIN_PASSWORD;
  const namaArg = process.argv.indexOf('--nama');
  const namaAdmin = namaArg >= 0 ? process.argv[namaArg + 1] : 'Administrator';
  const nipAdmin = process.env.ADMIN_NIP ?? 'admin';

  const host = (process.env.DATABASE_URL ?? '').split('@')[1]?.split('/')[0];
  console.log('Database:', host);
  console.log('');

  if (!password) {
    console.error(
      '❌ ADMIN_PASSWORD belum diset.\n' +
        "   Contoh: ADMIN_PASSWORD='PasswordAnda123' pnpm exec tsx scripts/reset-produksi.ts"
    );
    process.exit(1);
  }
  if (password.length < 8) {
    console.error('❌ Password minimal 8 karakter.');
    process.exit(1);
  }

  // ============ 1. Bersihkan data demo ============
  if (!simpanDemo) {
    console.log('→ Membersihkan data demo...');

    const pegawaiDemo = await prisma.pegawai.findMany({
      where: { nip: { in: NIP_DEMO } },
      select: { id: true, nip: true, nama: true },
    });

    if (pegawaiDemo.length > 0) {
      const ids = pegawaiDemo.map((p) => p.id);

      // hapus penilaian beserta detailnya
      const penilaian = await prisma.penilaian.findMany({
        where: { OR: [{ pegawaiId: { in: ids } }, { penilaiId: { in: ids } }] },
        select: { id: true },
      });
      if (penilaian.length > 0) {
        const pids = penilaian.map((p) => p.id);
        await prisma.penilaianDetail.deleteMany({ where: { penilaianId: { in: pids } } });
        await prisma.penilaian.deleteMany({ where: { id: { in: pids } } });
        console.log(`   ✓ ${penilaian.length} penilaian dihapus`);
      }

      await prisma.sesi.deleteMany({ where: { pegawaiId: { in: ids } } });
      await prisma.auditLog.deleteMany({ where: { pegawaiId: { in: ids } } });
      await prisma.pegawai.deleteMany({ where: { id: { in: ids } } });
      console.log(`   ✓ ${pegawaiDemo.length} akun demo dihapus:`);
      for (const p of pegawaiDemo) console.log(`      ${p.nip} — ${p.nama}`);
    } else {
      console.log('   (tidak ada akun demo)');
    }

    const periodeDemo = await prisma.periode.deleteMany({
      where: { kode: { in: KODE_PERIODE_DEMO } },
    });
    if (periodeDemo.count > 0) {
      console.log(`   ✓ ${periodeDemo.count} periode demo dihapus`);
    }
  } else {
    console.log('→ Data demo DIPERTAHANKAN (opsi --simpan-demo)');
  }

  // ============ 2. Siapkan cabang & jabatan ============
  const cabang = await prisma.cabang.upsert({
    where: { kode: '0001' },
    update: {},
    create: { kode: '0001', nama: 'Kantor Pusat' },
  });

  const daftarJabatan = [
    { kode: 'TELLER', nama: 'Teller', namaEn: 'Teller' },
    { kode: 'CS', nama: 'Customer Service', namaEn: 'Customer Service' },
    { kode: 'SECURITY', nama: 'Security', namaEn: 'Security' },
    { kode: 'PB_TELLER', nama: 'Priority Banking Teller', namaEn: 'Priority Banking Teller' },
    { kode: 'PB_CS', nama: 'Priority Banking Customer Service', namaEn: 'Priority Banking Customer Service' },
  ];
  for (const j of daftarJabatan) {
    await prisma.jabatan.upsert({ where: { kode: j.kode }, update: {}, create: j });
  }
  console.log('   ✓ cabang 0001 & 5 jabatan siap');

  // ============ 3. Buat ulang akun admin ============
  console.log('');
  console.log('→ Membuat akun admin...');
  const hash = await bcrypt.hash(password, 12);

  const admin = await prisma.pegawai.upsert({
    where: { nip: nipAdmin },
    update: {
      nama: namaAdmin,
      passwordHash: hash,
      role: 'ADMIN',
      aktif: true,
      harusGantiPassword: true,
      cabangId: cabang.id,
    },
    create: {
      nip: nipAdmin,
      nama: namaAdmin,
      passwordHash: hash,
      role: 'ADMIN',
      harusGantiPassword: true,
      cabangId: cabang.id,
    },
  });

  // cabut semua sesi lama akun ini supaya tidak ada sesi menggantung
  await prisma.sesi.updateMany({
    where: { pegawaiId: admin.id, revokedAt: null },
    data: { revokedAt: new Date() },
  });

  console.log(`   ✓ admin: NIP ${admin.nip} — ${admin.nama}`);
  console.log('   ✓ wajib ganti password saat login pertama');
  console.log('   ✓ sesi lama dicabut');

  // ============ 4. Ringkasan akhir ============
  const sisa = await prisma.pegawai.count();
  const periodeAktif = await prisma.periode.count({ where: { aktif: true } });

  console.log('');
  console.log('=== RINGKASAN DATABASE ===');
  console.log(`   Total akun  : ${sisa}`);
  console.log(`   Periode aktif: ${periodeAktif}`);
  console.log('');
  console.log('✅ Selesai. Login dengan NIP admin dan password yang Anda isi.');
  if (periodeAktif === 0) {
    console.log('   Catatan: belum ada periode aktif — buat lewat menu Periode setelah login.');
  }
}

main()
  .catch((e) => {
    console.error('❌ GAGAL:', e.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
