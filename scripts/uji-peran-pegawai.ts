/**
 * Uji akses peran PEGAWAI: hanya boleh melihat nilainya SENDIRI.
 *
 * Bug yang dijaga skrip ini (4 Okt 2026): PEGAWAI dulu bisa membuka
 * /laporan dan /laporan/ranking. Karena cakupannya cabang sendiri, ia bisa
 * melihat nama, NIP, jabatan, dan NILAI seluruh rekan sekantornya.
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
  const admin = await prisma.pegawai.findFirst({ where: { nip: 'admin' } });
  if (!admin) throw new Error('akun admin tidak ada');

  // akun pegawai uji di cabang yang SAMA dengan admin (supaya kalau bocor,
  // ia memang bisa melihat rekan-rekannya)
  const lama = await prisma.pegawai.findFirst({ where: { nip: 'TSTPEG' } });
  if (lama) {
    await prisma.sesi.deleteMany({ where: { pegawaiId: lama.id } });
    await prisma.pegawai.delete({ where: { id: lama.id } });
  }
  const peg = await prisma.pegawai.create({
    data: {
      nip: 'TSTPEG',
      nama: 'Pegawai Uji',
      passwordHash: admin.passwordHash,
      role: 'PEGAWAI',
      aktif: true,
      harusGantiPassword: false,
      cabangId: admin.cabangId,
      jabatanId: admin.jabatanId,
    },
  });
  const token = crypto.randomBytes(32).toString('base64url');
  await prisma.sesi.create({
    data: {
      tokenHash: crypto.createHash('sha256').update(token).digest('hex'),
      pegawaiId: peg.id,
      expiresAt: new Date(Date.now() + 3600_000),
    },
  });
  const cookie = `sip_sesi=${token}`;

  // pembanding: admin harus bisa buka laporan, kalau tidak uji ini tidak sah
  const tokenAdmin = crypto.randomBytes(32).toString('base64url');
  await prisma.sesi.create({
    data: {
      tokenHash: crypto.createHash('sha256').update(tokenAdmin).digest('hex'),
      pegawaiId: admin.id,
      expiresAt: new Date(Date.now() + 3600_000),
    },
  });
  const rAdmin = await fetch(`${BASE}/laporan`, {
    headers: { cookie: `sip_sesi=${tokenAdmin}` },
    redirect: 'manual',
  });
  if (rAdmin.status !== 200) throw new Error(`pembanding admin gagal (${rAdmin.status})`);

  console.log('\n== PEGAWAI HARUS DITOLAK ==');
  // Halaman biasa menolak dengan 307 (redirect ke /dasbor). Route unduh
  // mengembalikan 403 karena ia bukan halaman. Keduanya = ditolak.
  for (const jalur of ['/laporan', '/laporan/ranking', '/laporan/ekspor', '/penilaian', '/persetujuan', '/pegawai', '/parameter/audit']) {
    const r = await fetch(`${BASE}${jalur}`, { headers: { cookie }, redirect: 'manual' });
    const ditolak = r.status === 307 || r.status === 403 || r.status === 404;
    cek(`ditolak ${jalur}`, ditolak, `status=${r.status}`);
  }

  // dan isi berkas ekspor tidak boleh berisi data siapa pun
  const re = await fetch(`${BASE}/laporan/ekspor`, { headers: { cookie } });
  const teks = await re.text();
  cek(
    'berkas ekspor tidak memuat NIP/nama petugas',
    !teks.includes('NIP') && !teks.includes('MARINA') && !teks.includes('RAHMAT'),
    `cuplikan: ${teks.slice(0, 80)}`
  );

  console.log('\n== PEGAWAI BOLEH DASBOR ==');
  const rd = await fetch(`${BASE}/dasbor`, { headers: { cookie }, redirect: 'manual' });
  cek('bisa buka /dasbor', rd.status === 200, `status=${rd.status}`);
  const hd = await rd.text();

  // Menu diperiksa dari DATA (saringMenu), bukan mencari kata di HTML:
  // kata "Pegawai" juga muncul sebagai label peran di bilah atas, sehingga
  // pencarian teks akan melaporkan kegagalan palsu.
  const { saringMenu } = await import('../src/components/menu');
  const menu = saringMenu('PEGAWAI');
  const label = menu.map((m) => m.label);
  cek('menu hanya Dasbor', label.length === 1 && label[0] === 'Dasbor', `dapat: ${label.join(', ')}`);
  cek('menu Laporan TIDAK ada', !label.includes('Laporan'));
  cek('menu Penilaian TIDAK ada', !label.includes('Penilaian'));
  cek('menu Pegawai TIDAK ada', !label.includes('Pegawai'));
  cek('menu Parameter TIDAK ada', !label.includes('Parameter'));
  cek('label peran "Pegawai" tampil di bilah atas', hd.includes('Pegawai') && hd.includes('Dasbor'));

  console.log('\n== TIDAK ADA NILAI REKAN YANG BOCOR KE DASBOR ==');
  // dasbor pegawai: kartunya "Penilaian saya", bukan daftar rekan
  const adaNamaRekan = ['MARINA KADIR', 'RAHMAT', 'ARDIANSAH', 'HUSNIA PARADITHA']
    .filter((n) => hd.includes(n));
  cek('nama rekan sekerja tidak muncul di dasbor pegawai', adaNamaRekan.length === 0, `bocor: ${adaNamaRekan.join(', ')}`);

  console.log('\n== BERSIHKAN ==');
  await prisma.sesi.deleteMany({ where: { pegawaiId: { in: [peg.id, admin.id] } } });
  await prisma.pegawai.delete({ where: { id: peg.id } });
  cek('akun pegawai uji terhapus', (await prisma.pegawai.count({ where: { nip: 'TSTPEG' } })) === 0);

  console.log(`\n${lulus} lulus, ${gagal} gagal`);
  process.exitCode = gagal > 0 ? 1 : 0;
}

main()
  .catch((e) => {
    console.error('GAGAL:', e instanceof Error ? e.message : e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
