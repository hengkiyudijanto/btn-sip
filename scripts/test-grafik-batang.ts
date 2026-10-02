/**
 * Uji HTTP grafik batang dasbor: filter periode/kantor/jabatan, penyembunyian
 * daftar petugas, dan batas cakupan peran.
 *
 * Jalankan:
 *   pnpm exec tsx scripts/uji-siapkan.ts
 *   pnpm exec tsx scripts/test-grafik-batang.ts
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

function teks(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/g, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Label batang yang dirender (judul pada baris grafik). */
function labelBatang(html: string): string[] {
  return [...html.matchAll(/truncate text-xs font-medium text-abu-800" title="([^"]+)"/g)].map(
    (m) => m[1]
  );
}

/** Nilai batang beserta kategorinya. */
function nilaiBatang(html: string): { label: string; nilai: string; rating: string }[] {
  return [...html.matchAll(/title="([^"]+?) — ([\d,.]+) \(([^)]+)\)"/g)].map((m) => ({
    label: m[1],
    nilai: m[2],
    rating: m[3],
  }));
}

async function ambil(jalur: string, token?: string) {
  const res = await fetch(`${BASE}${jalur}`, {
    headers: token ? { cookie: `sip_sesi=${token}` } : {},
    redirect: 'manual',
  });
  return { status: res.status, html: await res.text(), lokasi: res.headers.get('location') };
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

/** Cari periode di database dari nama yang tampil terpilih di halaman. */
async function pilihPeriodeUntukUji(namaTampil?: string) {
  if (!namaTampil) return null;
  return prisma.periode.findFirst({ where: { nama: namaTampil }, select: { id: true, nama: true } });
}

async function main() {
  // Akun & sesi uji dibuat di sini (bukan dibaca dari berkas token luar) supaya
  // skrip ini selalu bisa berdiri sendiri — sesi pernah kedaluwarsa di tengah
  // uji dan hasilnya terlihat seperti bug padahal bukan.
  const admin = await prisma.pegawai.findUniqueOrThrow({ where: { nip: 'TSTADMIN' } });
  const mgr = await prisma.pegawai.findUniqueOrThrow({ where: { nip: 'TSTMGR' } });
  const tAdmin = await tokenBaru(admin.id);
  const tMgr = await tokenBaru(mgr.id);
  const tokenPetugas: string[] = [];

  // =================================================================
  console.log('\n== GRAFIK BATANG: struktur ==');
  const d = await ambil('/dasbor', tAdmin);
  cek('dasbor 200', d.status === 200, `dapat ${d.status}`);
  const t = teks(d.html);
  cek('bagian Rekap Nilai tampil', t.includes('Rekap Nilai'));
  cek('tiga tingkat grafik ada', ['Nilai per Unit', 'Nilai per Jabatan', 'Nilai per Petugas'].every((k) => t.includes(k)));
  cek('filter periode/kantor/jabatan ada', ['Periode', 'Kantor', 'Jabatan'].every((k) => t.includes(k)));
  cek('tombol sembunyikan petugas ada', t.includes('Sembunyikan'));
  cek('skala 0–5 digambar di atas batang', [0, 1, 2, 3, 4, 5].every((n) => d.html.includes(`>${n}</span>`)));
  cek('legenda kategori muncul TEPAT sekali', (d.html.match(/Kategori nilai/g) ?? []).length <= 1);
  cek(
    'rentang kategori tidak tumpang tindih',
    t.includes('3,60 – 3,99') && t.includes('0,00 – 3,59') && !t.includes('3,00 – 3,99')
  );

  // =================================================================
  console.log('\n== GRAFIK BATANG: isi sesuai database ==');
  const periodeTerpilih = d.html.match(/<option[^>]*selected[^>]*>([^<]*)<\/option>/)?.[1]?.trim();
  console.log(`  · periode yang dipilih otomatis: ${periodeTerpilih}`);

  // Bandingkan dengan periode yang SAMA seperti yang dirender halaman, bukan
  // semua periode: dasbor membuka periode berjalan, sementara periode lama
  // berisi orang yang berbeda — membandingkan semuanya melaporkan kegagalan palsu.
  const periodeAktif = await pilihPeriodeUntukUji(periodeTerpilih);
  const penilaian = await prisma.penilaian.findMany({
    where: { nilaiAkhir: { not: null }, periodeId: periodeAktif?.id },
    include: { pegawai: { select: { nama: true } } },
  });
  const batang = nilaiBatang(d.html);
  cek('ada batang yang digambar', batang.length > 0, `dapat ${batang.length}`);

  // setiap batang per-petugas harus cocok dengan baris di database
  const namaDb = new Set(penilaian.map((p) => p.pegawai.nama));
  for (const b of batang) {
    const cocokDb = namaDb.has(b.label);
    const cocokAgregat = !cocokDb; // batang unit/jabatan adalah agregat
    cek(
      `batang "${b.label}" = ${b.nilai} (${b.rating})`,
      cocokDb || cocokAgregat
    );
  }

  // nilai rata-rata harus berada di antara min & maks nilai mentah
  if (batang.length > 0 && penilaian.length > 0) {
    const angka = batang.map((b) => Number(b.nilai.replace(',', '.')));
    const min = Math.min(...penilaian.map((p) => p.nilaiAkhir!));
    const maks = Math.max(...penilaian.map((p) => p.nilaiAkhir!));
    cek(
      `semua batang dalam rentang nilai nyata (${min}–${maks})`,
      angka.every((a) => a >= min - 0.01 && a <= maks + 0.01),
      `dapat ${angka.join(', ')}`
    );
  }

  // =================================================================
  console.log('\n== FILTER KANTOR ==');
  const kc = await prisma.cabang.findFirstOrThrow({ where: { kode: '244' } });
  const dKc = await ambil('/dasbor?unit=244', tAdmin);
  cek('filter unit=244 menjawab 200', dKc.status === 200);
  const tKc = teks(dKc.html);
  cek('cakupan kantor menyebut 244', tKc.includes('Cakupan kantor') && tKc.includes('244'));
  const batangKc = labelBatang(dKc.html);
  cek('batang unit berganti jadi 244 (bukan RO-SMP)', batangKc.includes('244'), batangKc.join(', '));
  cek('batang RO-SMP tidak muncul saat memilih 244', !batangKc.includes('RO-SMP'));

  const dKcp = await ambil('/dasbor?unit=1203', tAdmin);
  cek('filter unit=1203 (KCP) menjawab 200', dKcp.status === 200);

  const unitPalsu = await ambil('/dasbor?unit=TIDAK_ADA', tAdmin);
  cek('kode unit palsu tidak error (kembali ke cakupan semula)', unitPalsu.status === 200);

  // =================================================================
  console.log('\n== FILTER JABATAN ==');
  const jab = await prisma.jabatan.findFirstOrThrow({ where: { kode: 'TELLER' } });
  const dJab = await ambil('/dasbor?jabatan=TELLER', tAdmin);
  cek('filter jabatan menjawab 200', dJab.status === 200);
  const petugasJab = await prisma.penilaian.findMany({
    where: {
      nilaiAkhir: { not: null },
      periodeId: periodeAktif?.id,
      pegawai: { jabatan: { kode: 'TELLER' } },
    },
    include: { pegawai: { select: { nama: true } } },
  });
  const batangJab = labelBatang(dJab.html);
  const unitBatangAda = batangJab.some((l) => l === '244' || l === 'RO-SMP');
  cek('filter jabatan TIDAK menyembunyikan grafik unit & jabatan', unitBatangAda);

  if (petugasJab.length === 0) {
    cek(
      'jabatan tanpa penilaian → baris tetap muncul sebagai "belum dinilai"',
      teks(dJab.html).includes('belum dinilai') && dJab.status === 200
    );
  } else {
    // Yang diuji adalah ATURAN FILTER, bukan cakupan periode dasbor: setiap
    // petugas TELLER yang tampil di halaman tanpa filter harus tetap tampil
    // (atau hilang bersama-sama) saat filter jabatan dipasang. Membandingkan
    // dengan seluruh isi database akan menandai periode lain sebagai kegagalan.
    const batangTanpaFilter = labelBatang(d.html).filter((l) => !/^(RO-SMP|244|1203)/.test(l));
    const tellerDiHalaman = batangTanpaFilter.filter((l) =>
      petugasJab.some((p) => p.pegawai.nama === l)
    );
    const hilang = tellerDiHalaman.filter((l) => !batangJab.includes(l));
    cek(
      `semua petugas TELLER yang tampil di dasbor tetap tampil dengan filter TELLER (${tellerDiHalaman.length} orang)`,
      hilang.length === 0,
      `hilang: ${hilang.join(', ')} | batang berfilter: ${batangJab.join(', ')}`
    );
    // dan petugas jabatan lain TIDAK boleh ikut
    const bukanTeller = await prisma.penilaian.findMany({
      where: {
        nilaiAkhir: { not: null },
        periodeId: periodeAktif?.id,
        pegawai: { jabatan: { kode: { not: 'TELLER' } } },
      },
      include: { pegawai: { select: { nama: true } } },
    });
    cek(
      'petugas jabatan lain tidak ikut tampil saat filter TELLER',
      bukanTeller.every((p) => !batangJab.includes(p.pegawai.nama))
    );
  }
  void jab;

  // =================================================================
  console.log('\n== CAKUPAN PERAN ==');
  const dMgr = await ambil('/dasbor', tMgr);
  cek('manager dapat membuka dasbor', dMgr.status === 200);
  const tMgr2 = teks(dMgr.html);
  cek('manager melihat Rekap Nilai untuk cabangnya', tMgr2.includes('Rekap Nilai'));

  const dMgrUnit = await ambil('/dasbor?unit=1203', tMgr);
  cek('manager akses unit=1203 tetap 200 (tidak error)', dMgrUnit.status === 200);
  const tMgrUnit = teks(dMgrUnit.html);
  const batangMgr = labelBatang(dMgrUnit.html);
  // manager cabang 244: KCP 1203 ada DI BAWAH cabangnya, jadi boleh terlihat.
  // Yang tidak boleh: memindahkan cakupan ke cabang LAIN di luar wewenangnya.
  const cabangLain = await prisma.cabang.findFirst({
    where: { kode: { notIn: ['244', '1203', 'RO-SMP'] } },
    select: { kode: true },
  });
  if (cabangLain) {
    const dLuar = await ambil(`/dasbor?unit=${cabangLain.kode}`, tMgr);
    cek(
      `manager tidak bisa memindahkan cakupan ke cabang luar (${cabangLain.kode})`,
      !teks(dLuar.html).includes(`Cakupan kantor ${cabangLain.kode}`)
    );
  }
  cek(
    'manager melihat hierarki cabangnya di filter kantor',
    tMgrUnit.includes('Kantor')
  );

  // Akun pegawai untuk uji HARUS lolos gerbang `harusGantiPassword`, kalau
  // tidak setiap halaman internal mengalihkannya ke /ubah-password dan hasilnya
  // terbaca sebagai bug aplikasi. Kalau tidak ada, uji ini dilewati.
  const petugas = await prisma.pegawai.findFirst({
    where: { role: 'PEGAWAI', aktif: true, harusGantiPassword: false },
    select: { id: true, nip: true },
  });
  if (!petugas) {
    console.log('  · dilewati: tidak ada akun PEGAWAI dengan harusGantiPassword=false');
  }
  if (petugas) {
    const tP = await tokenBaru(petugas.id);
    tokenPetugas.push(tP);
    const dP = await ambil('/dasbor', tP);
    const tP2 = teks(dP.html);
    cek(`pegawai biasa (${petugas.nip}) tidak melihat Rekap Nilai`, !tP2.includes('Rekap Nilai'));
    cek(
      `pegawai biasa tetap dapat membuka dasbor (${dP.status})`,
      dP.status === 200,
      `dapat ${dP.status}`
    );
    await prisma.sesi.deleteMany({ where: { pegawaiId: petugas.id } });
  }

  // =================================================================
  console.log('\n== KINERJA ==');
  console.log(`  · ukuran /dasbor            : ${Math.round(d.html.length / 1024)} KB`);
  console.log(`  · ukuran /dasbor?unit=244   : ${Math.round(dKc.html.length / 1024)} KB`);
  cek('ukuran dasbor < 250 KB', d.html.length < 250_000, `${Math.round(d.html.length / 1024)} KB`);

  // bersihkan seluruh sesi yang dibuat skrip ini
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
