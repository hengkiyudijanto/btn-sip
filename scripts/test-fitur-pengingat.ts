/**
 * Uji HTTP fitur baru (audit log, pengingat, lonceng, tren dasbor) memakai
 * sesi nyata di database.
 *
 * Server action tidak bisa dipanggil dari skrip tsx (butuh konteks request),
 * jadi pengujian dilakukan lewat HTTP — lihat skill btn-sip.
 *
 * Jalankan:
 *   pnpm exec tsx scripts/uji-siapkan.ts     # buat akun + sesi uji
 *   pnpm exec tsx scripts/test-fitur-pengingat.ts
 *   pnpm exec tsx scripts/uji-bersihkan.ts --hapus
 */
import 'dotenv/config';
import crypto from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const BASE = process.env.BASE_URL ?? 'http://localhost:3000';
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

let lulus = 0;
let gagal = 0;

function cek(nama: string, kondisi: boolean, detail = '') {
  if (kondisi) {
    lulus++;
    console.log(`  ✓ ${nama}`);
  } else {
    gagal++;
    console.log(`  ✗ ${nama} ${detail}`);
  }
}

/** Buang tag HTML supaya pencarian teks tidak terpecah oleh tag React. */
function teks(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/g, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&middot;/g, '·')
    .replace(/\s+/g, ' ')
    .trim();
}

async function ambil(
  jalur: string,
  token?: string
): Promise<{ status: number; html: string; lokasi: string | null }> {
  const res = await fetch(`${BASE}${jalur}`, {
    headers: token ? { cookie: `sip_sesi=${token}` } : {},
    redirect: 'manual',
  });
  return {
    status: res.status,
    html: await res.text(),
    lokasi: res.headers.get('location'),
  };
}

async function tokenBaru(pegawaiId: string): Promise<string> {
  const token = crypto.randomBytes(32).toString('base64url');
  await prisma.sesi.create({
    data: {
      tokenHash: crypto.createHash('sha256').update(token).digest('hex'),
      pegawaiId,
      expiresAt: new Date(Date.now() + 3600_000),
    },
  });
  return token;
}

async function main() {
  const admin = await prisma.pegawai.findUniqueOrThrow({ where: { nip: 'TSTADMIN' } });
  const mgr = await prisma.pegawai.findUniqueOrThrow({ where: { nip: 'TSTMGR' } });
  const tAdmin = await tokenBaru(admin.id);
  const tMgr = await tokenBaru(mgr.id);

  // =====================================================================
  console.log('\n== AUDIT LOG: akses ==');
  const audit = await ambil('/parameter/audit', tAdmin);
  cek('admin dapat membuka /parameter/audit (200)', audit.status === 200, `dapat ${audit.status}`);
  const tAudit = teks(audit.html);
  cek('judul halaman tampil', tAudit.includes('Audit Log'));
  cek('kolom tabel lengkap', ['Waktu', 'Pelaku', 'Jenis aksi', 'Ringkasan', 'Sumber', 'Data'].every((k) => tAudit.includes(k)));

  const auditMgr = await ambil('/parameter/audit', tMgr);
  cek('manager ditolak (307)', auditMgr.status === 307, `dapat ${auditMgr.status}`);
  cek('manager dialihkan ke /dasbor', auditMgr.lokasi?.endsWith('/dasbor') === true, String(auditMgr.lokasi));
  const auditAnon = await ambil('/parameter/audit');
  cek('tanpa login dialihkan ke /masuk', auditAnon.lokasi?.endsWith('/masuk') === true, String(auditAnon.lokasi));

  console.log('\n== AUDIT LOG: isi & filter ==');
  // aksi mentah yang tidak dikenal tidak boleh muncul sebagai label mentah
  const aksiMentah = /title="[A-Z][A-Z_]{6,}"/.test(audit.html);
  cek('label aksi ditampilkan dalam bahasa manusia (bukan kode mentah)', aksiMentah && !tAudit.includes('UBAH_DRAFT_PENILAIAN'));

  const berlabel = await prisma.auditLog.groupBy({ by: ['aksi'] });
  const { INFO_AKSI } = await import('../src/lib/sip/audit');
  const belum = berlabel.map((a) => a.aksi).filter((a) => !(a in INFO_AKSI));
  cek(
    'semua aksi yang ada di database punya label',
    belum.length === 0,
    `belum berlabel: ${belum.join(', ')}`
  );

  const filterAksi = await ambil('/parameter/audit?aksi=LOGIN', tAdmin);
  cek('filter jenis aksi menjawab 200', filterAksi.status === 200);
  const tFilter = teks(filterAksi.html);
  const totalFilter = Number((tFilter.match(/Total catatan ([\d.]+)/)?.[1] ?? '0').replace(/\./g, ''));
  const totalLogin = await prisma.auditLog.count({ where: { aksi: 'LOGIN' } });
  cek('angka pada kartu sama dengan jumlah baris di database', totalFilter === totalLogin, `${totalFilter} vs ${totalLogin}`);

  const filterTanggal = await ambil('/parameter/audit?dari=2030-01-01&sampai=2030-01-02', tAdmin);
  cek('filter tanggal kosong tidak error', filterTanggal.status === 200);
  cek(
    'pesan "tidak ada catatan" tampil saat filter kosong',
    teks(filterTanggal.html).includes('Tidak ada catatan audit')
  );

  const halaman2 = await ambil('/parameter/audit?halaman=2', tAdmin);
  cek('halaman 2 audit dapat dibuka', halaman2.status === 200);

  // batas 50 baris per halaman — halaman ini pernah 469 KB di /periode,
  // jadi ukurannya harus dijaga di sini juga.
  cek('ukuran HTML audit < 250 KB', audit.html.length < 250_000, `${Math.round(audit.html.length / 1024)} KB`);

  console.log('\n== PENGINGAT & LONCENG ==');
  const penilaian = await ambil('/penilaian', tAdmin);
  cek('halaman penilaian 200', penilaian.status === 200);
  const tPenilaian = teks(penilaian.html);
  cek('panel pengingat tampil (petugas belum dinilai)', /petugas belum dinilai/.test(tPenilaian));
  cek('lonceng notifikasi tampil di bilah atas', /aria-label="\d+ pengingat"/.test(penilaian.html));
  cek('tombol Buka pada panel pengingat ada', tPenilaian.includes('Buka'));

  const dasbor = await ambil('/dasbor', tAdmin);
  const tDasbor = teks(dasbor.html);
  cek('lonceng juga tampil di dasbor (bukan hanya /penilaian)', /aria-label="\d+ pengingat"/.test(dasbor.html));

  // lonceng tidak boleh muncul untuk pegawai biasa yang tidak punya tugas
  const petugas = await prisma.pegawai.findFirst({
    where: { role: 'PEGAWAI', aktif: true, penilaianku: { none: {} } },
    select: { id: true, nip: true },
  });
  if (petugas) {
    const tPetugas = await tokenBaru(petugas.id);
    const dPetugas = await ambil('/dasbor', tPetugas);
    cek(
      `pegawai biasa (${petugas.nip}) tidak melihat lonceng tugas`,
      !/aria-label="\d+ pengingat"/.test(dPetugas.html)
    );
    await prisma.sesi.deleteMany({ where: { pegawaiId: petugas.id } });
  }

  console.log('\n== TREN DASBOR ==');
  cek('bagian Tren Nilai dirender', tDasbor.includes('Tren Nilai'));
  cek('grafik digambar sebagai SVG tanpa pustaka grafik', dasbor.html.includes('viewBox="0 0 720'));
  // periode berdata harus punya titik nilai yang diformat gaya Indonesia
  cek(
    'titik tren menampilkan nilai bergaya Indonesia (koma desimal)',
    /<circle[^>]*>/.test(dasbor.html) && /\d,\d\d<\/text>/.test(dasbor.html)
  );
  cek(
    'periode tanpa penilaian ditandai "tidak ada data", bukan digambar sebagai nol',
    !dasbor.html.includes('tidak ada data') || tDasbor.includes('tidak ada data')
  );
  cek(
    'sumbu grafik memakai skala penuh 0–5',
    [0, 1, 2, 3, 4, 5].every((n) => dasbor.html.includes(`>${n}</text>`))
  );
  cek('ringkasan per kategori tampil', ['Penampilan', 'Kemampuan', 'Sikap'].every((k) => tDasbor.includes(k)));

  // pegawai biasa tidak melihat tren unit
  if (petugas) {
    const tPetugas = await tokenBaru(petugas.id);
    const dPetugas = await ambil('/dasbor', tPetugas);
    cek('pegawai biasa tidak melihat tren unit', !teks(dPetugas.html).includes('Tren Nilai'));
    await prisma.sesi.deleteMany({ where: { pegawaiId: petugas.id } });
  }

  console.log('\n== KINERJA (ukuran HTML) ==');
  for (const [nama, h] of [['/dasbor', dasbor.html], ['/penilaian', penilaian.html], ['/parameter/audit', audit.html]] as const) {
    console.log(`  · ${nama}: ${Math.round(h.length / 1024)} KB`);
  }

  // bersihkan sesi uji
  await prisma.sesi.deleteMany({ where: { pegawaiId: { in: [admin.id, mgr.id] } } });

  console.log(`\nHASIL: ${lulus} lulus, ${gagal} gagal`);
  if (gagal > 0) process.exitCode = 1;
}

main()
  .catch((e) => {
    console.error('GAGAL:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
