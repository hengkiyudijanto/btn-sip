/**
 * Uji ekspor rekap Excel/CSV lewat HTTP sungguhan.
 *
 * Jalankan: BASE_URL=http://localhost:3100 pnpm exec tsx scripts/test-ekspor.ts
 */
import 'dotenv/config';
import crypto from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import bcrypt from 'bcryptjs';

const BASE = process.env.BASE_URL ?? 'http://localhost:3100';
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
const NIP_A = 'EKSPOR001';
const NIP_B = 'EKSPOR002';

/**
 * Urai satu baris CSV dengan aturan tanda kutip.
 * Titik-koma di dalam tanda kutip BUKAN pemisah kolom, dan dua tanda
 * kutip berurutan berarti satu tanda kutip harfiah.
 */
function uraiBarisCsv(baris: string): string[] {
  const kolom: string[] = [];
  let sekarang = '';
  let dalamKutip = false;

  for (let i = 0; i < baris.length; i++) {
    const c = baris[i];
    if (dalamKutip) {
      if (c === '"') {
        if (baris[i + 1] === '"') {
          sekarang += '"';
          i++;
        } else {
          dalamKutip = false;
        }
      } else {
        sekarang += c;
      }
    } else if (c === '"') {
      dalamKutip = true;
    } else if (c === ';') {
      kolom.push(sekarang);
      sekarang = '';
    } else {
      sekarang += c;
    }
  }
  kolom.push(sekarang);
  return kolom;
}

async function buatSesi(pegawaiId: string) {
  const token = crypto.randomBytes(32).toString('base64url');
  await prisma.sesi.create({
    data: { tokenHash: hashToken(token), pegawaiId, expiresAt: new Date(Date.now() + 3600_000) },
  });
  return token;
}

async function main() {
  console.log(`=== UJI EKSPOR REKAP (${BASE}) ===\n`);

  // ===== siapkan data =====
  await prisma.penilaianDetail.deleteMany({
    where: { penilaian: { pegawai: { nip: { in: [NIP_A, NIP_B] } } } },
  });
  await prisma.penilaian.deleteMany({ where: { pegawai: { nip: { in: [NIP_A, NIP_B] } } } });
  await prisma.pegawai.deleteMany({ where: { nip: { in: [NIP_A, NIP_B] } } });

  const cabang = await prisma.cabang.findFirst({ where: { aktif: true } });
  if (!cabang) throw new Error('tidak ada cabang aktif');
  const hash = await bcrypt.hash('Eksporpass123', 10);

  const a = await prisma.pegawai.create({
    data: {
      nip: NIP_A, nama: 'Andi Ekspor', passwordHash: hash, role: 'PEGAWAI',
      harusGantiPassword: false, aktif: true, cabangId: cabang.id,
    },
  });
  const b = await prisma.pegawai.create({
    data: {
      nip: NIP_B, nama: 'Siti; Ekspor "Uji"', passwordHash: hash, role: 'PEGAWAI',
      harusGantiPassword: false, aktif: true, cabangId: cabang.id,
    },
  });

  const hariIni = new Date();
  // pakai periode berjalan; kalau tidak ada (mis. jam server tepat di celah
  // antar periode), pakai periode terdekat ke depan
  const periode =
    (await prisma.periode.findFirst({
      where: { tanggalMulai: { lte: hariIni }, tanggalSelesai: { gte: hariIni } },
    })) ??
    (await prisma.periode.findFirst({
      where: { tanggalMulai: { gt: hariIni } },
      orderBy: { tanggalMulai: 'asc' },
    }));
  if (!periode) throw new Error('tidak ada periode untuk diuji');

  const spv = await prisma.pegawai.findFirst({
    where: { role: { in: ['SUPERVISOR', 'ADMIN'] } },
  });
  if (!spv) throw new Error('tidak ada supervisor');

  await prisma.penilaian.create({
    data: {
      pegawaiId: a.id, penilaiId: spv.id, periodeId: periode.id,
      status: 'FINAL', nilaiPenampilan: 5.0, nilaiKemampuan: 4.8, nilaiSikap: 5.0,
      nilaiAkhir: 4.93, rating: 'Istimewa',
      detail: { create: [{ kodeAspek: 'A1', nilaiMentah: 99, skor: 5, bobotAspek: 0.4 }] },
    },
  });
  await prisma.penilaian.create({
    data: {
      pegawaiId: b.id, penilaiId: spv.id, periodeId: periode.id,
      status: 'DRAFT', nilaiPenampilan: 3.5, nilaiKemampuan: 3.4, nilaiSikap: 3.6,
      nilaiAkhir: 3.51, rating: 'Cukup',
      detail: { create: [{ kodeAspek: 'A1', nilaiMentah: 80, skor: 2, bobotAspek: 0.4 }] },
    },
  });
  console.log(`ok  data uji siap (periode ${periode.nama})\n`);

  const token = await buatSesi(spv.id);

  // ===== 1. unduhan =====
  console.log('--- 1. unduhan berkas ---');
  const res = await fetch(`${BASE}/laporan/ekspor?periode=${periode.id}`, {
    headers: { cookie: `sip_sesi=${token}` },
  });
  cek(res.status === 200, `status ${res.status}`);

  const tipe = res.headers.get('content-type') ?? '';
  cek(tipe.includes('text/csv'), `content-type CSV (${tipe})`);

  const disp = res.headers.get('content-disposition') ?? '';
  cek(disp.includes('attachment'), 'dikirim sebagai lampiran unduhan');
  cek(/\.csv/.test(disp), `nama berkas .csv (${disp.replace(/.*filename=/, '')})`);

  // baca byte mentah: response.text() sudah membuang BOM saat decoding,
  // jadi BOM harus diperiksa dari byte
  const buf = Buffer.from(await res.clone().arrayBuffer());
  const csv = buf.toString('utf8');

  // ===== 2. isi berkas =====
  console.log('\n--- 2. isi berkas ---');
  const byte4 = [...buf.subarray(0, 3)].map((b) => b.toString(16).padStart(2, '0')).join(' ');
  cek(byte4 === 'ef bb bf', `berkas berawalan BOM UTF-8 (${byte4})`);
  cek(buf[3] === 0x52, 'byte ke-4 adalah huruf R (isi langsung menyusul)');
  cek(csv.includes('REKAP PENILAIAN PETUGAS FRONTLINER'), 'judul ada');
  cek(csv.includes(periode.nama), 'nama periode tercantum');
  cek(csv.includes('Andi Ekspor'), 'petugas pertama ada');
  // nama dengan titik-koma dan tanda kutip harus di-escape dengan benar
  cek(csv.includes('Nama; dengan titik koma') || csv.includes('Andi Ekspor'), 'baris terbaca');
  cek(!csv.includes('NaN'), 'tidak ada NaN');
  cek(!csv.includes('undefined'), 'tidak ada undefined');
  cek(!csv.includes('null'), 'tidak ada null');

  // nilai tertinggi harus di baris rank 1
  const barisRank1 = csv.split('\r\n').find((l) => l.startsWith('1;'));
  cek(Boolean(barisRank1?.includes('Andi Ekspor')), 'rank 1 adalah nilai tertinggi (Andi)');

  // ===== 2b. nama dengan karakter khusus (titik-koma & tanda kutip) =====
  console.log('\n--- 2b. karakter khusus dalam nama ---');
  // "Siti; Ekspor "Uji"" harus jadi: "Siti; Ekspor ""Uji"""
  cek(
    csv.includes('"Siti; Ekspor ""Uji"""'),
    'nama bertitik-koma & ber-kutip di-escape sesuai aturan CSV'
  );
  // baris itu harus tetap 11 kolom saat dibaca ulang sebagai CSV.
  // Pencarian dibatasi ke bagian DAFTAR PERINGKAT, karena baris ringkasan
  // ("Nilai terendah;3,51;Siti...") juga memuat nama ini dan akan
  // menyesatkan bila dicari dari seluruh berkas.
  const barisSemua = csv.split('\r\n');
  const idxTabel = barisSemua.findIndex((l) => l.startsWith('Rank;Nama;'));
  const barisTabel = idxTabel >= 0 ? barisSemua.slice(idxTabel + 1) : [];
  const barisSiti = barisTabel.find((l) => l.includes('Siti; Ekspor'));
  const kolom = barisSiti ? uraiBarisCsv(barisSiti) : [];
  console.log(`   kolom pada baris tabel nama khusus: ${kolom.length}`);
  cek(kolom.length === 11, 'baris nama khusus tetap 11 kolom');
  cek(kolom[1] === 'Siti; Ekspor "Uji"', `nama utuh terbaca kembali: "${kolom[1]}"`);
  cek(kolom[2] === NIP_B, `NIP di kolom berikutnya benar (${kolom[2]})`);
  cek(kolom[8] === '3,51', `nilai akhir tetap di kolom 9 (${kolom[8]})`);

  // angka desimal format Indonesia
  cek(csv.includes('4,93') || csv.includes('4,9'), 'nilai akhir memakai koma desimal');

  // ===== 3. nama berkas mengandung kode periode =====
  console.log('\n--- 3. nama berkas ---');
  console.log(`   ${disp.replace(/.*filename="/, '').replace('"', '')}`);
  cek(disp.includes(periode.kode.replace(/[^a-zA-Z0-9-]/g, '-')), 'nama berkas memuat kode periode');

  // ===== 4. audit log =====
  console.log('\n--- 4. audit log ---');
  const audit = await prisma.auditLog.findFirst({
    where: { aksi: 'EKSPOR_REKAP', pegawaiId: spv.id },
    orderBy: { createdAt: 'desc' },
  });
  cek(audit !== null, 'ekspor tercatat di audit log');
  if (audit) {
    const baru = audit.dataBaru as Record<string, unknown> | null;
    console.log(`   jumlah baris: ${baru?.jumlahBaris}`);
    cek(baru?.periode === periode.kode, 'kode periode tercatat');
  }

  // ===== 5. keamanan =====
  console.log('\n--- 5. keamanan ---');
  const tanpaSesi = await fetch(`${BASE}/laporan/ekspor?periode=${periode.id}`, {
    redirect: 'manual',
  });
  cek(
    tanpaSesi.status === 401 || tanpaSesi.status === 307,
    `tanpa login DITOLAK (status ${tanpaSesi.status})`
  );

  const periodePalsu = await fetch(`${BASE}/laporan/ekspor?periode=tidak-ada`, {
    headers: { cookie: `sip_sesi=${token}` },
  });
  cek(periodePalsu.status === 404, `periode tidak dikenal ditolak (status ${periodePalsu.status})`);

  // ===== 6. halaman laporan punya tombol unduh =====
  console.log('\n--- 6. tombol unduh di halaman laporan ---');
  const halaman = await fetch(`${BASE}/laporan`, {
    headers: { cookie: `sip_sesi=${token}` },
    redirect: 'manual',
  });
  const html = await halaman.text();
  cek(html.includes('/laporan/ekspor'), 'tautan ekspor ada di halaman laporan');
  cek(html.includes('Unduh Excel'), 'tombol berlabel "Unduh Excel"');

  // bersihkan
  await prisma.penilaianDetail.deleteMany({
    where: { penilaian: { pegawai: { nip: { in: [NIP_A, NIP_B] } } } },
  });
  await prisma.penilaian.deleteMany({ where: { pegawai: { nip: { in: [NIP_A, NIP_B] } } } });
  await prisma.auditLog.deleteMany({ where: { aksi: 'EKSPOR_REKAP' } });
  await prisma.sesi.deleteMany({ where: { pegawaiId: spv.id } });
  await prisma.pegawai.deleteMany({ where: { nip: { in: [NIP_A, NIP_B] } } });
  console.log('\n✓ data uji dibersihkan');

  console.log(`\n=== HASIL: ${lulus} lulus, ${gagal} gagal ===`);
  if (gagal > 0) process.exit(1);
  console.log('✅ EKSPOR REKAP TERVERIFIKASI.');
}

main()
  .catch((e) => {
    console.error('\n❌ GAGAL:', e.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
