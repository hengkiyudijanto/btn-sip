/**
 * Ukur waktu respons produksi Vercel per halaman.
 *
 * Mengukur dua hal yang berbeda dan jangan dicampur:
 *   1. TTFB (time to first byte) — berapa lama server Vercel mulai menjawab.
 *      Ini yang menunjukkan "serverless dingin" vs "sudah hangat".
 *   2. Waktu total sampai HTML selesai diterima.
 *
 * Setiap halaman diukur DUA kali: kunjungan pertama (mungkin dingin) dan
 * kedua (sudah hangat). Selisihnya menunjukkan biaya cold start.
 *
 * Jalankan: pnpm exec tsx scripts/ukur-kecepatan-produksi.ts
 */
import 'dotenv/config';
import crypto from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const BASE = process.env.BASE_URL ?? 'https://btn-sip.vercel.app';
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});
const h = (t: string) => crypto.createHash('sha256').update(t).digest('hex');

const HALAMAN = [
  ['/dasbor', 'Dasbor'],
  ['/penilaian', 'Penilaian (daftar)'],
  ['/laporan', 'Laporan & rekap'],
  ['/pegawai', 'Pegawai'],
  ['/periode', 'Periode'],
  ['/persetujuan', 'Persetujuan'],
] as const;

async function ukur(url: string, cookie: string, ulang: number) {
  const hasil: number[] = [];
  let ttfb = 0;
  let status = 0;
  let byte = 0;

  for (let i = 0; i < ulang; i++) {
    const mulai = performance.now();
    const res = await fetch(url, {
      headers: { cookie },
      redirect: 'manual',
    });
    ttfb = performance.now() - mulai;
    const teks = await res.text();
    hasil.push(performance.now() - mulai);
    status = res.status;
    byte = teks.length;
  }

  const rata = hasil.reduce((a, b) => a + b, 0) / hasil.length;
  return { ttfb, rata, min: Math.min(...hasil), max: Math.max(...hasil), status, byte };
}

async function main() {
  console.log(`=== UKUR KECEPATAN PRODUKSI (${BASE}) ===\n`);

  const admin = await prisma.pegawai.findUnique({ where: { nip: 'admin' } });
  if (!admin) throw new Error('akun admin tidak ada');

  const token = crypto.randomBytes(32).toString('base64url');
  await prisma.sesi.create({
    data: { tokenHash: h(token), pegawaiId: admin.id, expiresAt: new Date(Date.now() + 1800000) },
  });
  const cookie = `sip_sesi=${token}`;

  // pemanasan: kunjungi /masuk supaya DNS+TLS tidak ikut terhitung
  await fetch(`${BASE}/masuk`).then((r) => r.text()).catch(() => {});

  console.log('halaman                        kunjung-1   kunjung-2   kunjung-3   rata');
  console.log('─'.repeat(78));

  let total = 0;
  let jumlah = 0;
  const rincian: Array<{ nama: string; dingin: number; hangat: number }> = [];

  for (const [path, nama] of HALAMAN) {
    const hasil: number[] = [];
    for (let i = 0; i < 3; i++) {
      const mulai = performance.now();
      const res = await fetch(`${BASE}${path}`, { headers: { cookie }, redirect: 'manual' });
      const teks = await res.text();
      hasil.push(performance.now() - mulai);
      if (i === 0) {
        console.log(
          `  ${nama.padEnd(28)} ${hasil[i].toFixed(0).padStart(6)} ms` +
            (res.status === 200 ? '' : `  (status ${res.status})`)
        );
      }
    }
    const rata = hasil.reduce((a, b) => a + b, 0) / hasil.length;
    console.log(
      `${' '.repeat(30)}${hasil.join(' ms   ').padEnd(0)}`.slice(0, 0) +
        `   → ${hasil.map((x) => x.toFixed(0)).join(' / ')} ms`
    );
    rincian.push({ nama, dingin: hasil[0], hangat: hasil[hasil.length - 1] });
    total += rata;
    jumlah++;
  }

  console.log('─'.repeat(78));
  console.log(`\nRata-rata semua halaman: ${(total / jumlah).toFixed(0)} ms\n`);

  console.log('Selisih kunjungan pertama vs terakhir (indikasi cold start):');
  for (const r of rincian) {
    const selisih = r.dingin - r.hangat;
    console.log(
      `  ${r.nama.padEnd(24)} ${r.dingin.toFixed(0).padStart(5)} ms → ${r.hangat
        .toFixed(0)
        .padStart(5)} ms   ${selisih > 300 ? `(dingin +${selisih.toFixed(0)} ms)` : ''}`
    );
  }

  await prisma.sesi.deleteMany({ where: { pegawaiId: admin.id } });
}

main()
  .catch((e) => { console.error('GAGAL:', e.message); process.exit(1); })
  .finally(() => prisma.$disconnect());
