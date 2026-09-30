/**
 * Uji halaman baru lewat HTTP: /persetujuan, /pegawai, /periode.
 * Memakai sesi login nyata (dibuat langsung di database).
 */
import 'dotenv/config';
import crypto from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const BASE = process.env.BASE_URL ?? 'http://localhost:3100';
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

const hashToken = (t: string) =>
  crypto.createHash('sha256').update(t).digest('hex');

let lulus = 0;
let gagal = 0;
function cek(kondisi: boolean, label: string) {
  console.log(`   ${kondisi ? 'ok ' : 'XX '} ${label}`);
  if (kondisi) lulus++;
  else gagal++;
}

async function buatSesi(nip: string) {
  const p = await prisma.pegawai.findUnique({ where: { nip } });
  if (!p) throw new Error(`Pegawai ${nip} tidak ada`);
  const token = crypto.randomBytes(32).toString('base64url');
  await prisma.sesi.create({
    data: { tokenHash: hashToken(token), pegawaiId: p.id, expiresAt: new Date(Date.now() + 3600_000) },
  });
  return { token, p };
}

async function get(path: string, token: string) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { cookie: `sip_sesi=${token}` },
    redirect: 'manual',
  });
  return { status: res.status, html: await res.text(), lokasi: res.headers.get('location') };
}

async function main() {
  console.log('=== UJI HALAMAN BARU (HTTP) ===\n');

  const sesiAdmin = await buatSesi('admin');
  const sesiMgr = await buatSesi('90000002');
  const sesiPeg = await buatSesi('80000002');

  // ================= /persetujuan =================
  console.log('--- /persetujuan ---');
  const r1 = await get('/persetujuan', sesiMgr.token);
  cek(r1.status === 200, `manager bisa akses (status ${r1.status})`);
  cek(r1.html.includes('Persetujuan Penilaian'), 'judul halaman ada');
  cek(r1.html.includes('Menunggu diketahui'), 'kartu status "Menunggu diketahui" ada');

  const r2 = await get('/persetujuan', sesiAdmin.token);
  cek(r2.status === 200, `admin bisa akses (status ${r2.status})`);

  // pegawai biasa HARUS dialihkan
  const r3 = await get('/persetujuan', sesiPeg.token);
  cek(r3.status === 307 && r3.lokasi === '/dasbor', `pegawai dialihkan ke dasbor (${r3.status} → ${r3.lokasi})`);

  // ================= /pegawai =================
  console.log('\n--- /pegawai ---');
  const r4 = await get('/pegawai', sesiAdmin.token);
  cek(r4.status === 200, `admin bisa akses (status ${r4.status})`);
  cek(r4.html.includes('Pengelolaan Pegawai'), 'judul halaman ada');
  cek(r4.html.includes('Impor massal'), 'panel impor ada untuk admin');
  cek(r4.html.includes('Tambah Pegawai'), 'tombol tambah pegawai ada');
  cek(r4.html.includes('Reset password'), 'tombol reset password ada');
  cek(r4.html.includes('Dewi Kartika'), 'daftar pegawai tampil');

  const r5 = await get('/pegawai', sesiMgr.token);
  cek(r5.status === 200, `manager bisa akses (status ${r5.status})`);
  cek(!r5.html.includes('Impor massal'), 'manager TIDAK melihat panel impor');

  const r6 = await get('/pegawai', sesiPeg.token);
  cek(r6.status === 307, `pegawai biasa dialihkan (status ${r6.status})`);

  // ================= /periode =================
  console.log('\n--- /periode ---');
  const r7 = await get('/periode', sesiAdmin.token);
  cek(r7.status === 200, `admin bisa akses (status ${r7.status})`);
  cek(r7.html.includes('Periode Penilaian'), 'judul halaman ada');
  cek(r7.html.includes('Beberapa minggu'), 'opsi buat massal ada');
  cek(r7.html.includes('Kunci'), 'tombol kunci ada');

  const r8 = await get('/periode', sesiMgr.token);
  cek(r8.status === 307 && r8.lokasi === '/dasbor', `manager dialihkan dari /periode (${r8.status})`);

  // ================= menu navigasi =================
  console.log('\n--- navigasi ---');
  const r9 = await get('/dasbor', sesiAdmin.token);
  cek(r9.html.includes('Persetujuan'), 'menu Persetujuan tampil untuk admin');
  cek(r9.html.includes('Periode'), 'menu Periode tampil untuk admin');

  const r10 = await get('/dasbor', sesiPeg.token);
  cek(!r10.html.includes('/persetujuan'), 'menu Persetujuan TIDAK tampil untuk pegawai');
  cek(!r10.html.includes('/periode'), 'menu Periode TIDAK tampil untuk pegawai');

  // bersihkan sesi uji
  await prisma.sesi.deleteMany({
    where: { pegawai: { nip: { in: ['admin', '90000002', '80000002'] } } },
  });

  console.log(`\n=== HASIL: ${lulus} lulus, ${gagal} gagal ===`);
  if (gagal > 0) process.exit(1);
  console.log('✅ SEMUA HALAMAN BARU BERFUNGSI.');
}

main()
  .catch((e) => {
    console.error('\n❌ GAGAL:', e.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
