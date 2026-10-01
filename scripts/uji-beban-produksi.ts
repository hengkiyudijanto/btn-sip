/**
 * Uji beban produksi: seberapa tahan halaman saat diakses bersamaan.
 *
 * Mengukur:
 *   - waktu respons pada tingkat konkurensi berbeda (2, 5, 10, 20, 30)
 *   - tingkat kegagalan (status bukan 200)
 *   - degradasi: berapa kali lebih lambat dibanding akses tunggal
 *
 * Halaman diuji BERSAMAAN (semua permintaan dikirim serentak), karena itu
 * kondisi yang paling menguji — bukan berurutan.
 *
 * Jalankan: pnpm exec tsx scripts/uji-beban-produksi.ts
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

const HALAMAN = ['/dasbor', '/penilaian', '/laporan', '/persetujuan'] as const;
const TINGKAT = [1, 2, 5, 10, 20, 30] as const;

async function main() {
  console.log(`=== UJI BEBAN PRODUKSI (${BASE}) ===\n`);

  const admin = await prisma.pegawai.findUnique({ where: { nip: 'admin' } });
  if (!admin) throw new Error('akun admin tidak ada');

  const token = crypto.randomBytes(32).toString('base64url');
  await prisma.sesi.create({
    data: { tokenHash: h(token), pegawaiId: admin.id, expiresAt: new Date(Date.now() + 1800000) },
  });
  const cookie = `sip_sesi=${token}`;

  // pemanasan
  for (const p of HALAMAN) {
    await fetch(`${BASE}${p}`, { headers: { cookie } }).then((r) => r.text()).catch(() => {});
  }

  console.log('konkurensi   permintaan   median    p95     maks     gagal');
  console.log('─'.repeat(70));

  const hasilTingkat: Array<{ n: number; med: number; p95: number; gagal: number }> = [];

  for (const n of TINGKAT) {
    // setiap "user" membuka satu halaman, bergilir
    const tugas = Array.from({ length: n }, (_, i) => HALAMAN[i % HALAMAN.length]);
    const waktu: number[] = [];
    let gagal = 0;

    const mulai = performance.now();
    await Promise.all(
      tugas.map(async (path) => {
        try {
          const t0 = performance.now();
          const res = await fetch(`${BASE}${path}`, { headers: { cookie }, redirect: 'manual' });
          const teks = await res.text();
          waktu.push(performance.now() - t0);
          if (res.status !== 200) gagal++;
        } catch {
          gagal++;
          waktu.push(performance.now() - mulai);
        }
      })
    );

    waktu.sort((a, b) => a - b);
    const med = waktu[Math.floor(waktu.length / 2)];
    const p95 = waktu[Math.floor(waktu.length * 0.95)] ?? waktu[waktu.length - 1];
    const maks = waktu[waktu.length - 1];

    hasilTingkat.push({ n, med, p95, gagal });
    console.log(
      `     ${String(n).padStart(2)}          ${String(n).padStart(2)}       ` +
        `${med.toFixed(0).padStart(5)} ms ${p95.toFixed(0).padStart(5)} ms ` +
        `${maks.toFixed(0).padStart(5)} ms ${String(gagal).padStart(4)}`
    );
  }

  console.log('─'.repeat(70));

  const satu = hasilTingkat[0];
  console.log('\n=== DEGRADASI ===');
  for (const r of hasilTingkat.slice(1)) {
    const kali = r.med / satu.med;
    console.log(
      `  ${String(r.n).padStart(2)} bersamaan : ${r.med.toFixed(0).padStart(4)} ms ` +
        `(${kali.toFixed(1)}x dari akses tunggal)`
    );
  }

  console.log('\n=== PENILAIAN ===');
  const totalGagal = hasilTingkat.reduce((a, r) => a + r.gagal, 0);
  console.log(`  total permintaan gagal : ${totalGagal}`);
  const p30 = hasilTingkat[hasilTingkat.length - 1];
  console.log(`  pada 30 bersamaan      : median ${p30.med.toFixed(0)} ms, p95 ${p30.p95.toFixed(0)} ms`);
  console.log(
    `  masih nyaman (<1s)     : ${p30.p95 < 1000 ? 'YA' : 'TIDAK'}`
  );

  await prisma.sesi.deleteMany({ where: { pegawaiId: admin.id } });
}

main()
  .catch((e) => { console.error('GAGAL:', e.message); process.exit(1); })
  .finally(() => prisma.$disconnect());
