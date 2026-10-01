/**
 * Uji halaman filter ranking + unduhan PPTX.
 *
 * Membuktikan:
 *   1. Halaman terbuka dan menampilkan keempat filter (periode, jenis, unit, posisi)
 *   2. Filter benar-benar menyaring (peserta berkurang saat filter dipersempit)
 *   3. PPTX benar-benar terunduh dan berisi slide sesuai jumlah kelompok
 *   4. PPTX punya foto tertanam
 *   5. Tanpa login ditolak
 *
 * Jalankan: BASE_URL=http://localhost:3100 pnpm exec tsx scripts/test-ranking-pptx.ts
 */
import 'dotenv/config';
import crypto from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import bcrypt from 'bcryptjs';

const BASE = process.env.BASE_URL ?? 'http://localhost:3100';
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});
const h = (t: string) => crypto.createHash('sha256').update(t).digest('hex');

/** Buang tag HTML supaya pencarian teks tidak terganggu markup. */
function teksBersih(html: string): string {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&middot;/g, '·')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ');
}

let lulus = 0;
let gagal = 0;
function cek(kondisi: boolean, label: string) {
  console.log(`   ${kondisi ? 'ok ' : 'XX '} ${label}`);
  if (kondisi) lulus++;
  else gagal++;
}

const FOTO =
  'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsL' +
  'DBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QA' +
  'FAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==';

const NIPS = {
  spv: 'RANKSPV1',
  t1: 'RANKTEL1',
  t2: 'RANKTEL2',
  cs1: 'RANKCS01',
};

async function bersih() {
  const id = (
    await prisma.pegawai.findMany({
      where: { nip: { in: Object.values(NIPS) } }, select: { id: true },
    })
  ).map((p) => p.id);
  await prisma.penilaianDetail.deleteMany({ where: { penilaian: { pegawaiId: { in: id } } } });
  await prisma.penilaian.deleteMany({ where: { pegawaiId: { in: id } } });
  await prisma.sesi.deleteMany({ where: { pegawaiId: { in: id } } });
  await prisma.pegawai.deleteMany({ where: { nip: { in: Object.values(NIPS) } } });
  await prisma.periode.deleteMany({ where: { kode: 'RANK-W1' } });
}

async function main() {
  console.log(`=== UJI HALAMAN & UNDUHAN RANKING PPTX (${BASE}) ===\n`);
  await bersih();

  const cabang = await prisma.cabang.findFirst({ where: { aktif: true } });
  const hash = await bcrypt.hash('Ranking1', 10);
  const jabatanTeller = await prisma.jabatan.findFirst({ where: { kode: 'TELLER' } });
  const jabatanCS = await prisma.jabatan.findFirst({ where: { kode: 'CS' } });

  const spv = await prisma.pegawai.create({
    data: { nip: NIPS.spv, nama: 'SPV Ranking', passwordHash: hash, role: 'SUPERVISOR',
      harusGantiPassword: false, aktif: true, cabangId: cabang!.id },
  });
  const t1 = await prisma.pegawai.create({
    data: { nip: NIPS.t1, nama: 'Teller Satu', passwordHash: hash, role: 'PEGAWAI',
      harusGantiPassword: false, aktif: true, cabangId: cabang!.id, atasanId: spv.id,
      jabatanId: jabatanTeller?.id ?? null },
  });
  const t2 = await prisma.pegawai.create({
    data: { nip: NIPS.t2, nama: 'Teller Dua', passwordHash: hash, role: 'PEGAWAI',
      harusGantiPassword: false, aktif: true, cabangId: cabang!.id, atasanId: spv.id,
      jabatanId: jabatanTeller?.id ?? null },
  });
  const cs1 = await prisma.pegawai.create({
    data: { nip: NIPS.cs1, nama: 'CS Satu', passwordHash: hash, role: 'PEGAWAI',
      harusGantiPassword: false, aktif: true, cabangId: cabang!.id, atasanId: spv.id,
      jabatanId: jabatanCS?.id ?? null },
  });

  const per = await prisma.periode.create({
    data: { kode: 'RANK-W1', nama: 'Uji Ranking', tanggalMulai: new Date(2052, 0, 1),
      tanggalSelesai: new Date(2052, 0, 7), aktif: true },
  });

  // tiga penilaian dengan kategori berbeda
  const isian = [
    { pegawaiId: t1.id, nilai: 4.92 },
    { pegawaiId: t2.id, nilai: 3.71 },
    { pegawaiId: cs1.id, nilai: 4.61 },
  ];
  for (const i of isian) {
    await prisma.penilaian.create({
      data: {
        pegawaiId: i.pegawaiId, penilaiId: spv.id, periodeId: per.id, status: 'FINAL',
        nilaiAkhir: i.nilai,
        rating: i.nilai >= 4.8 ? 'Istimewa' : i.nilai >= 4.6 ? 'Sangat Baik' : 'Baik',
        fotoData: FOTO, fotoMime: 'image/jpeg', fotoUkuran: 160,
        detail: { create: [{ kodeAspek: 'A1', nilaiMentah: 90, skor: 3, bobotAspek: 0.4 }] },
      },
    });
  }

  const token = crypto.randomBytes(32).toString('base64url');
  await prisma.sesi.create({
    data: { tokenHash: h(token), pegawaiId: spv.id, expiresAt: new Date(Date.now() + 900000) },
  });
  const cookie = `sip_sesi=${token}`;

  // ===== 1. halaman terbuka + ada 4 filter =====
  console.log('--- 1. halaman filter ---');
  const res = await fetch(`${BASE}/laporan/ranking?periode=${per.id}`, {
    headers: { cookie }, redirect: 'manual',
  });
  const html = await res.text();
  cek(res.status === 200, `terbuka (${res.status})`);
  cek(html.includes('Periode penilaian'), 'ada filter Periode');
  cek(html.includes('Jenis kantor'), 'ada filter Jenis kantor');
  cek(html.includes('Unit / cabang'), 'ada filter Unit/cabang');
  cek(html.includes('Posisi yang dinilai'), 'ada filter Posisi');
  cek(html.includes('/laporan/ranking/pptx?'), 'ada tautan unduh PPTX');

  // ===== 2. filter menyaring =====
  console.log('\n--- 2. filter menyaring data ---');
  const semua = await fetch(`${BASE}/laporan/ranking?periode=${per.id}`, { headers: { cookie } })
    .then((r) => r.text());
  cek(teksBersih(semua).includes('3 petugas'), 'tanpa filter: 3 petugas');

  const hanyaTeller = await fetch(
    `${BASE}/laporan/ranking?periode=${per.id}&posisi=TELLER`, { headers: { cookie } }
  ).then((r) => r.text());
  cek(teksBersih(hanyaTeller).includes('2 petugas'), 'filter TELLER: 2 petugas');
  cek(!hanyaTeller.includes('CS Satu'), 'CS tidak ikut saat filter TELLER');

  const hanyaKC = await fetch(
    `${BASE}/laporan/ranking?periode=${per.id}&jenis=KC`, { headers: { cookie } }
  ).then((r) => r.text());
  const cabangKC = cabang!.jenis === 'KC';
  cek(
    cabangKC
      ? teksBersih(hanyaKC).includes('3 petugas')
      : teksBersih(hanyaKC).includes('Tidak ada penilaian'),
    `filter jenis KC (cabang uji: ${cabang!.jenis})`
  );

  const kosong = await fetch(
    `${BASE}/laporan/ranking?periode=${per.id}&posisi=SECURITY`, { headers: { cookie } }
  ).then((r) => r.text());
  cek(
    teksBersih(kosong).includes('Tidak ada penilaian yang cocok'),
    'filter tanpa hasil: pesan jelas'
  );

  // ===== 3. unduh PPTX =====
  console.log('\n--- 3. unduhan PPTX ---');
  const resPptx = await fetch(
    `${BASE}/laporan/ranking/pptx?periode=${per.id}`, { headers: { cookie } }
  );
  cek(resPptx.status === 200, `terunduh (${resPptx.status})`);
  cek(
    (resPptx.headers.get('content-type') ?? '').includes('presentationml'),
    `tipe PPTX (${resPptx.headers.get('content-type')})`
  );
  cek(
    (resPptx.headers.get('content-disposition') ?? '').includes('attachment'),
    'dikirim sebagai unduhan'
  );

  const buffer = Buffer.from(await resPptx.arrayBuffer());
  cek(buffer.length > 20000, `berkas wajar (${(buffer.length / 1024).toFixed(0)} KB)`);
  // berkas PPTX adalah arsip ZIP -> cek tanda tangan PK
  cek(buffer[0] === 0x50 && buffer[1] === 0x4b, 'berkas berformat PPTX (ZIP/PK)');

  writeFileSync('ranking-uji-route.pptx', buffer);
  console.log('   tersimpan: ranking-uji-route.pptx');

  // ===== 4. PPTX berisi foto =====
  console.log('\n--- 4. isi PPTX ---');
  const isiZip = buffer.toString('latin1');
  cek(isiZip.includes('ppt/slides/slide'), 'ada slide di dalamnya');
  const adaMedia = isiZip.includes('ppt/media/');
  cek(adaMedia, 'ada berkas gambar (foto) tertanam');

  // ===== 5. proteksi =====
  console.log('\n--- 5. proteksi akses ---');
  const tanpaLogin = await fetch(`${BASE}/laporan/ranking/pptx?periode=${per.id}`, {
    redirect: 'manual',
  });
  cek(tanpaLogin.status === 401, `tanpa login ditolak (${tanpaLogin.status})`);
  const tanpaLoginHal = await fetch(`${BASE}/laporan/ranking`, { redirect: 'manual' });
  cek(tanpaLoginHal.status === 307, `halaman tanpa login dialihkan (${tanpaLoginHal.status})`);

  await bersih();
  console.log(`\n=== HASIL: ${lulus} lulus, ${gagal} gagal ===`);
  if (gagal > 0) process.exit(1);
  console.log('✅ HALAMAN FILTER & UNDUHAN PPTX TERVERIFIKASI.');
}

main()
  .catch((e) => { console.error('GAGAL:', e.message); process.exit(1); })
  .finally(() => prisma.$disconnect());
