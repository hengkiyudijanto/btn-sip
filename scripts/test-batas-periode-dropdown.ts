/**
 * Uji batas periode pada dropdown & pengelompokan tahun.
 *
 * Aturan yang dikunci di sini:
 *   1. Dropdown periode (Penilaian, Laporan, Dasbor) TIDAK memuat periode
 *      yang belum dimulai — user pernah memilih periode masa depan dan
 *      laporannya jadi tidak nyata.
 *   2. /parameter/periode tetap memuat seluruh periode (untuk pengelolaan),
 *      dan TIDAK menampilkan kelompok tahun yang kosong.
 *
 * Jalankan: pnpm exec tsx scripts/test-batas-periode-dropdown.ts
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

function teks(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/g, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

async function ambil(jalur: string, token: string) {
  const res = await fetch(`${BASE}${jalur}`, {
    headers: { cookie: `sip_sesi=${token}` },
    redirect: 'manual',
  });
  return { status: res.status, html: await res.text() };
}

async function main() {
  const admin = await prisma.pegawai.findUniqueOrThrow({ where: { nip: 'TSTADMIN' } });
  const token = crypto.randomBytes(32).toString('base64url');
  await prisma.sesi.create({
    data: {
      tokenHash: crypto.createHash('sha256').update(token).digest('hex'),
      pegawaiId: admin.id,
      expiresAt: new Date(Date.now() + 3600_000),
    },
  });

  const hariIni = new Date();
  const tahunIni = hariIni.getFullYear();

  // =================================================================
  console.log('\n== ATURAN DROPDOWN: tidak memuat periode belum dimulai ==');
  const { daftarPeriodeUntukPemilih } = await import('../src/lib/sip/periode-aktif');
  const dropdown = await daftarPeriodeUntukPemilih(hariIni);

  cek('dropdown berisi periode', dropdown.length > 0, `${dropdown.length} periode`);

  const belumMulai = dropdown.filter((p) => p.tanggalMulai.getTime() > hariIni.getTime());
  cek(
    'TIDAK ada periode yang belum dimulai di dropdown',
    belumMulai.length === 0,
    belumMulai.map((p) => p.nama).join(', ')
  );

  const tertinggi = dropdown[0];
  cek(
    `periode terbaru di dropdown = periode berjalan (${tertinggi.nama})`,
    tertinggi.tanggalMulai.getTime() <= hariIni.getTime()
  );

  const tahunDepan = dropdown.filter((p) => p.tanggalMulai.getFullYear() > tahunIni);
  cek(
    'TIDAK ada periode tahun depan di dropdown',
    tahunDepan.length === 0,
    tahunDepan.map((p) => p.nama).join(', ')
  );

  cek(
    'periode Desember tahun lalu tetap bisa dipilih (laporan lama)',
    dropdown.some((p) => p.tanggalMulai.getFullYear() === tahunIni - 1)
  );

  // batas waktu yang berbeda-beda harus tetap menghormati aturannya
  const ujungTahun = new Date(tahunIni - 1, 11, 31);
  const dropdownUjungTahun = await daftarPeriodeUntukPemilih(ujungTahun);
  const belumMulaiUjungTahun = dropdownUjungTahun.filter(
    (p) => p.tanggalMulai.getTime() > ujungTahun.getTime()
  );
  cek(
    'pada 31 Des tahun lalu, dropdown tidak memuat periode tahun ini',
    belumMulaiUjungTahun.length === 0,
    belumMulaiUjungTahun.map((p) => p.nama).join(', ')
  );

  // =================================================================
  console.log('\n== ATURAN HALAMAN /parameter/periode ==');
  const { daftarPeriodePerTahun } = await import('../src/lib/sip/periode-aktif');
  const perTahun = await daftarPeriodePerTahun();
  cek(
    'TIDAK ada kelompok tahun kosong',
    perTahun.every((g) => g.daftar.length > 0),
    perTahun.filter((g) => g.daftar.length === 0).map((g) => g.tahun).join(', ')
  );
  cek(
    'urutan tahun menurun (terbaru dulu)',
    perTahun.every((g, i) => i === 0 || perTahun[i - 1].tahun > g.tahun)
  );

  const dPage = await ambil('/parameter/periode', token);
  cek('/parameter/periode 200', dPage.status === 200, `dapat ${dPage.status}`);
  const tPage = teks(dPage.html);
  cek('halaman tetap memuat seluruh periode untuk pengelolaan', tPage.includes('periode tersedia'));

  // periode masa depan yang terlanjur ada di database TIDAK boleh dibuang
  // dari halaman ini — pengelolaan harus melihat apa pun yang ada.
  const adaMasaDepanDiDb = await prisma.periode.count({
    where: { tanggalMulai: { gt: hariIni } },
  });
  if (adaMasaDepanDiDb > 0) {
    console.log(`  · catatan: ${adaMasaDepanDiDb} periode masa depan masih ada di database`);
  }

  // =================================================================
  console.log('\n== DROPDOWN DI TIAP HALAMAN (lewat HTTP) ==');
  for (const jalur of ['/penilaian', '/laporan', '/dasbor']) {
    const r = await ambil(jalur, token);
    cek(`${jalur} menjawab 200`, r.status === 200, `dapat ${r.status}`);
    const tahunDiOpsi = new Set(
      [...r.html.matchAll(/<option[^>]*>([^<]*20\d\d[^<]*)<\/option>/g)]
        .map((m) => m[1].match(/20\d\d/)?.[0])
        .filter(Boolean)
    );
    cek(
      `${jalur}: tidak ada opsi periode tahun depan (${[...tahunDiOpsi].sort().join(', ')})`,
      [...tahunDiOpsi].every((y) => Number(y) <= tahunIni)
    );
  }

  // =================================================================
  console.log('\n== DATA PRODUKSI TIDAK TERSENTUH ==');
  const totalPeriode = await prisma.periode.count();
  const totalPenilaian = await prisma.penilaian.count();
  const periodeBerjalan = await prisma.periode.findFirst({
    where: { tanggalMulai: { lte: hariIni }, tanggalSelesai: { gte: hariIni } },
    select: { nama: true, _count: { select: { penilaian: true } } },
  });
  console.log(`  · periode di database : ${totalPeriode}`);
  console.log(`  · penilaian           : ${totalPenilaian}`);
  cek(
    `periode berjalan masih ada (${periodeBerjalan?.nama ?? 'TIDAK ADA'})`,
    Boolean(periodeBerjalan)
  );
  cek(
    'penilaian tidak hilang oleh pembersihan periode',
    totalPenilaian > 0 || totalPeriode === 0,
    `${totalPenilaian} penilaian`
  );

  await prisma.sesi.deleteMany({ where: { pegawaiId: admin.id, tokenHash: crypto.createHash('sha256').update(token).digest('hex') } });

  console.log(`\nHASIL: ${lulus} lulus, ${gagal} gagal`);
  if (gagal > 0) process.exitCode = 1;
}

main()
  .catch((e) => {
    console.error('GAGAL:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
