/**
 * Uji beban dua lapis:
 *   A. bertahap (ramp) — cari titik di mana respons mulai rusak
 *   B. serentak (burst) — uji lonjakan tiba-tiba, kondisi paling berat
 *
 * Dipisahkan karena keduanya menguji hal berbeda: ramp menunjukkan kapasitas
 * stabil, burst menunjukkan perilaku saat cold start massal.
 *
 * Jalankan: pnpm exec tsx scripts/uji-beban-batas.ts
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

async function pukul(path: string, cookie: string) {
  const t0 = performance.now();
  try {
    const res = await fetch(`${BASE}${path}`, { headers: { cookie }, redirect: 'manual' });
    await res.text();
    return { ms: performance.now() - t0, ok: res.status === 200 };
  } catch {
    return { ms: performance.now() - t0, ok: false };
  }
}

function statistik(waktu: number[]) {
  const s = [...waktu].sort((a, b) => a - b);
  return {
    med: s[Math.floor(s.length / 2)] ?? 0,
    p95: s[Math.floor(s.length * 0.95)] ?? s[s.length - 1] ?? 0,
    maks: s[s.length - 1] ?? 0,
  };
}

async function main() {
  console.log(`=== UJI BEBAN BERTAHAP & LONJAKAN (${BASE}) ===\n`);

  const admin = await prisma.pegawai.findUnique({ where: { nip: 'admin' } });
  if (!admin) throw new Error('akun admin tidak ada');
  const token = crypto.randomBytes(32).toString('base64url');
  await prisma.sesi.create({
    data: { tokenHash: h(token), pegawaiId: admin.id, expiresAt: new Date(Date.now() + 1800000) },
  });
  const cookie = `sip_sesi=${token}`;

  // ---- A. lonjakan tiba-tiba (burst): semua dikirim sekaligus ----
  console.log('A. LONJAKAN TIBA-TIBA (semua permintaan dikirim serentak)');
  console.log('   user   median    p95      maks     gagal   status');
  console.log('   ' + '─'.repeat(62));

  for (const n of [10, 25, 50, 75, 100]) {
    const tugas = Array.from({ length: n }, (_, i) => HALAMAN[i % HALAMAN.length]);
    const mulai = performance.now();
    const hasil = await Promise.all(tugas.map((p) => pukul(p, cookie)));
    const total = performance.now() - mulai;

    const st = statistik(hasil.map((x) => x.ms));
    const gagal = hasil.filter((x) => !x.ok).length;
    // "dinding": berapa lama menunggu SEMUA selesai
    console.log(
      `   ${String(n).padStart(3)}   ${st.med.toFixed(0).padStart(6)} ms ` +
        `${st.p95.toFixed(0).padStart(6)} ms ${st.maks.toFixed(0).padStart(6)} ms ` +
        `${String(gagal).padStart(5)}   selesai semua ${total.toFixed(0)} ms`
    );
    // beri jeda supaya instance tidak menumpuk
    await new Promise((r) => setTimeout(r, 2000));
  }

  // ---- B. beban bertahan: kirim terus selama 15 detik ----
  console.log('\nB. BEBAN BERTAHAN 15 detik');
  for (const n of [10, 20]) {
    const durasi = 15_000;
    const waktu: number[] = [];
    let gagal = 0;
    let selesai = 0;
    const mulai = performance.now();

    await Promise.all(
      Array.from({ length: n }, async (_, idx) => {
        while (performance.now() - mulai < durasi) {
          const r = await pukul(HALAMAN[idx % HALAMAN.length], cookie);
          waktu.push(r.ms);
          if (!r.ok) gagal++;
          selesai++;
        }
      })
    );

    const st = statistik(waktu);
    const detik = (performance.now() - mulai) / 1000;
    const rps = selesai / detik;
    console.log(
      `   ${String(n).padStart(2)} pengguna bersamaan: ${selesai} permintaan dalam ` +
        `${detik.toFixed(0)} dtk (${rps.toFixed(1)}/dtk, total ${(rps * 60).toFixed(0)}/menit)`
    );
    console.log(
      `      median ${st.med.toFixed(0)} ms  p95 ${st.p95.toFixed(0)} ms  ` +
        `maks ${st.maks.toFixed(0)} ms  gagal ${gagal}`
    );
  }

  await prisma.sesi.deleteMany({ where: { pegawaiId: admin.id } });
}

main()
  .catch((e) => { console.error('GAGAL:', e.message); process.exit(1); })
  .finally(() => prisma.$disconnect());
