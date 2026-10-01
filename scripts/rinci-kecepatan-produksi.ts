/**
 * Rinci biaya tiap halaman: server vs database vs sisanya.
 *
 * Mengukur tiga hal terpisah supaya ketahuan yang mana dominan:
 *   1. TTFB — waktu Vercel mulai menjawab (termasuk kerja server + kueri DB)
 *   2. total — sampai HTML habis dibaca
 *   3. jumlah byte HTML + waktu render/transfer
 *
 * Halaman diukur 5x dan dilaporkan min/median/max, karena angka rata-rata
 * mudah tercemar satu kunjungan dingin.
 *
 * Jalankan: pnpm exec tsx scripts/rinci-kecepatan-produksi.ts
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
  ['/penilaian', 'Penilaian'],
  ['/laporan', 'Laporan'],
  ['/pegawai', 'Pegawai'],
  ['/periode', 'Periode'],
  ['/persetujuan', 'Persetujuan'],
] as const;

function median(n: number[]) {
  const s = [...n].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
}

async function main() {
  console.log(`=== RINCI KECEPATAN (${BASE}) ===\n`);

  const admin = await prisma.pegawai.findUnique({ where: { nip: 'admin' } });
  if (!admin) throw new Error('akun admin tidak ada');

  const token = crypto.randomBytes(32).toString('base64url');
  await prisma.sesi.create({
    data: { tokenHash: h(token), pegawaiId: admin.id, expiresAt: new Date(Date.now() + 1800000) },
  });
  const cookie = `sip_sesi=${token}`;

  // pemanasan DNS + TLS + fungsi
  await fetch(`${BASE}/masuk`).then((r) => r.text()).catch(() => {});
  await fetch(`${BASE}/dasbor`, { headers: { cookie } }).then((r) => r.text()).catch(() => {});

  console.log(
    'halaman         TTFB (min/med/max)          total (med)   byte HTML'
  );
  console.log('─'.repeat(76));

  const ringkas: Array<{ nama: string; ttfb: number; total: number; byte: number }> = [];

  for (const [path, nama] of HALAMAN) {
    const ttfb: number[] = [];
    const total: number[] = [];
    let byte = 0;

    for (let i = 0; i < 5; i++) {
      const m = performance.now();
      const res = await fetch(`${BASE}${path}`, { headers: { cookie }, redirect: 'manual' });
      ttfb.push(performance.now() - m);
      const teks = await res.text();
      total.push(performance.now() - m);
      byte = teks.length;
    }

    const t = median(ttfb);
    const to = median(total);
    ringkas.push({ nama, ttfb: t, total: to, byte });
    console.log(
      `  ${nama.padEnd(14)} ${Math.min(...ttfb).toFixed(0).padStart(4)} / ${t
        .toFixed(0)
        .padStart(4)} / ${Math.max(...ttfb).toFixed(0).padStart(4)} ms` +
        `${' '.repeat(4)}${to.toFixed(0).padStart(5)} ms${' '.repeat(7)}${(
          byte / 1024
        ).toFixed(0)} KB`
    );
  }

  console.log('─'.repeat(76));
  const rataTTFB = ringkas.reduce((a, r) => a + r.ttfb, 0) / ringkas.length;
  console.log(`\n  rata-rata TTFB : ${rataTTFB.toFixed(0)} ms`);
  console.log(`  target         : < 100 ms`);
  console.log(
    `  status         : ${
      rataTTFB < 100 ? 'SUDAH di bawah 100 ms' : `masih ${(rataTTFB - 100).toFixed(0)} ms di atas target`
    }\n`
  );

  console.log('  Halaman paling lambat:');
  for (const r of [...ringkas].sort((a, b) => b.ttfb - a.ttfb).slice(0, 3)) {
    console.log(`    ${r.nama.padEnd(14)} ${r.ttfb.toFixed(0)} ms TTFB`);
  }

  await prisma.sesi.deleteMany({ where: { pegawaiId: admin.id } });
}

main()
  .catch((e) => { console.error('GAGAL:', e.message); process.exit(1); })
  .finally(() => prisma.$disconnect());
