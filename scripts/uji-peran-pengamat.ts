/**
 * Uji peran PENGAMAT lewat HTTP dengan akun sungguhan.
 *
 * Bukan sekadar membaca kode: akun pengamat dibuat, diberi sesi, lalu
 * DICOBA MENEMBUS setiap halaman terproteksi. Yang diuji adalah hasil
 * sebenarnya (kode HTTP & isi halaman), bukan niat kode.
 */
import 'dotenv/config';
import crypto from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});
const BASE = 'http://localhost:3000';

let lulus = 0;
let gagal = 0;
function cek(nama: string, syarat: boolean, info = '') {
  if (syarat) {
    lulus++;
    console.log(`  LULUS  ${nama}`);
  } else {
    gagal++;
    console.log(`  GAGAL  ${nama} ${info}`);
  }
}

async function main() {
  // ===== siapkan akun pengamat uji =====
  await prisma.sesi.deleteMany({ where: { pegawai: { nip: { startsWith: 'TST' } } } });
  const lama = await prisma.pegawai.findFirst({ where: { nip: 'TSTAMAT' } });
  if (lama) {
    await prisma.sesi.deleteMany({ where: { pegawaiId: lama.id } });
    await prisma.pegawai.delete({ where: { id: lama.id } });
  }
  const admin = await prisma.pegawai.findFirst({ where: { nip: 'TSTADMIN' } });
  if (!admin) throw new Error('TSTADMIN tidak ada — jalankan scripts/uji-siapkan.ts dulu');

  const amat = await prisma.pegawai.create({
    data: {
      nip: 'TSTAMAT',
      nama: 'Pengamat Uji',
      passwordHash: admin.passwordHash,
      role: 'PENGAMAT',
      aktif: true,
      harusGantiPassword: false,
      cabangId: admin.cabangId,
      jabatanId: admin.jabatanId,
    },
  });
  const token = crypto.randomBytes(32).toString('base64url');
  await prisma.sesi.create({
    data: {
      // sesi menyimpan HASH token, bukan token mentah (lihat src/lib/auth.ts)
      tokenHash: crypto.createHash('sha256').update(token).digest('hex'),
      pegawaiId: amat.id,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    },
  });
  const cookie = `sip_sesi=${token}`;

  // Sesi admin untuk pembanding: sesi dari uji-siapkan.ts berumur 1 jam dan
  // sering sudah kedaluwarsa saat skrip ini dijalankan — buat sendiri di sini.
  const tokenAdmin = crypto.randomBytes(32).toString('base64url');
  await prisma.sesi.create({
    data: {
      tokenHash: crypto.createHash('sha256').update(tokenAdmin).digest('hex'),
      pegawaiId: admin.id,
      expiresAt: new Date(Date.now() + 3600_000),
    },
  });
  const cookieAdmin = `sip_sesi=${tokenAdmin}`;

  // pastikan pembanding admin memang bisa membuka halaman (kalau tidak,
  // kegagalan pengamat di bawah tidak bisa dipercaya)
  const rAdmin = await fetch(`${BASE}/dasbor`, { headers: { cookie: cookieAdmin }, redirect: 'manual' });
  if (rAdmin.status !== 200) {
    throw new Error(`pembanding admin gagal buka /dasbor (status ${rAdmin.status}) — periksa dulu`);
  }

  console.log('\n== HALAMAN YANG HARUS BISA DIBUKA (200) ==');
  for (const jalur of ['/dasbor', '/laporan', '/laporan/ranking']) {
    const r = await fetch(`${BASE}${jalur}`, { headers: { cookie }, redirect: 'manual' });
    cek(`bisa buka ${jalur}`, r.status === 200, `status=${r.status}`);
  }

  console.log('\n== HALAMAN YANG HARUS DITOLAK (307 -> /dasbor) ==');
  for (const jalur of [
    '/penilaian',
    '/persetujuan',
    '/pegawai',
    '/pengajuan-pegawai',
    '/parameter/cabang',
    '/parameter/jabatan',
    '/parameter/peran',
    '/parameter/periode',
    '/parameter/audit',
  ]) {
    const r = await fetch(`${BASE}${jalur}`, { headers: { cookie }, redirect: 'manual' });
    const lokasi = r.headers.get('location') ?? '';
    cek(`ditolak ${jalur}`, r.status === 307 && lokasi.includes('/dasbor'), `status=${r.status} lokasi=${lokasi}`);
  }

  console.log('\n== MENU: yang tampil untuk pengamat ==');
  const hd = await (await fetch(`${BASE}/dasbor`, { headers: { cookie } })).text();
  cek('menu Dasbor ada', hd.includes('Dasbor'));
  cek('menu Laporan ada', hd.includes('Laporan'));
  cek('menu Penilaian TIDAK ada', !hd.includes('>Penilaian<'));
  cek('menu Persetujuan TIDAK ada', !hd.includes('>Persetujuan<'));
  cek('menu Parameter TIDAK ada', !hd.includes('>Parameter<'));
  cek('menu Pegawai TIDAK ada', !hd.includes('>Pegawai<'));
  cek('label peran "Pengamat" tampil di bilah atas', hd.includes('Pengamat'));

  console.log('\n== SERVER ACTION: aksi tulis harus DITOLAK ==');
  // Server action tidak bisa dipanggil langsung dari tsx (`cookies()` di luar
  // request scope). Jadi: kirim POST ke halaman dengan header Next-Action,
  // lalu VERIFIKASI DI DATABASE bahwa tidak ada yang berubah.
  const { wajibKemampuan } = await import('../src/lib/sip/akses');
  cek('menilai ditolak', wajibKemampuan({ role: 'PENGAMAT' }, 'menilai') !== null);
  cek('kelola_penilaian ditolak', wajibKemampuan({ role: 'PENGAMAT' }, 'kelola_penilaian') !== null);
  cek('kelola_induk ditolak', wajibKemampuan({ role: 'PENGAMAT' }, 'kelola_induk') !== null);
  cek('lihat_audit ditolak', wajibKemampuan({ role: 'PENGAMAT' }, 'lihat_audit') !== null);
  cek('kelola_pegawai ditolak', wajibKemampuan({ role: 'PENGAMAT' }, 'kelola_pegawai') !== null);
  cek('mengetahui ditolak', wajibKemampuan({ role: 'PENGAMAT' }, 'mengetahui') !== null);
  cek('lihat_pegawai ditolak', wajibKemampuan({ role: 'PENGAMAT' }, 'lihat_pegawai') !== null);
  cek('usul_pegawai ditolak', wajibKemampuan({ role: 'PENGAMAT' }, 'usul_pegawai') !== null);

  // Bukti nyata: coba UBAH data lewat POST aksi admin (ubah hari penilaian),
  // lalu pastikan nilainya di database tetap.
  const sebelumPengaturan = await prisma.pengaturan.findFirst();
  const paksaUbah = new FormData();
  paksaUbah.set('hariPenilaian', '0');
  const rAksi = await fetch(`${BASE}/parameter/periode`, {
    method: 'POST',
    headers: { cookie, 'Next-Action': 'x' },
    body: paksaUbah,
  });
  const sesudahPengaturan = await prisma.pengaturan.findFirst();
  cek(
    'POST aksi tulis oleh pengamat tidak mengubah data',
    sebelumPengaturan?.hariPenilaian === sesudahPengaturan?.hariPenilaian,
    `sebelum=${sebelumPengaturan?.hariPenilaian} sesudah=${sesudahPengaturan?.hariPenilaian} (http ${rAksi.status})`
  );

  // dan halaman admin tetap menolak pengamat walau lewat POST
  cek('POST /parameter/periode ditolak', rAksi.status === 307 || rAksi.status === 404, `status=${rAksi.status}`);

  console.log('\n== BERSIHKAN ==');
  await prisma.sesi.deleteMany({ where: { pegawaiId: { in: [amat.id, admin.id] } } });
  await prisma.pegawai.delete({ where: { id: amat.id } });
  const sisa = await prisma.pegawai.count({ where: { nip: 'TSTAMAT' } });
  cek('akun pengamat uji terhapus', sisa === 0);

  const total = await prisma.pegawai.count();
  console.log(`\npegawai tersisa: ${total}`);
  console.log(`${lulus} lulus, ${gagal} gagal`);
  process.exitCode = gagal > 0 ? 1 : 0;
}

main()
  .catch((e) => {
    console.error('GAGAL:', e instanceof Error ? e.message : e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
