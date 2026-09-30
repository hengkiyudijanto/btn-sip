/**
 * Cetak halaman laporan ke PDF memakai Chrome headless + cookie sesi.
 *
 * Chrome headless tidak menerima cookie lewat CLI, jadi kita pakai
 * Chrome DevTools Protocol via WebSocket: buka tab, set cookie,
 * navigasi, lalu Page.printToPDF.
 *
 * Jalankan: pnpm exec tsx scripts/cetak-pdf-laporan.ts
 */
import 'dotenv/config';
import crypto from 'node:crypto';
import net from 'node:net';
import { writeFileSync } from 'node:fs';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const BASE = process.env.BASE_URL ?? 'http://localhost:3100';
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

const hashToken = (t: string) =>
  crypto.createHash('sha256').update(t).digest('hex');

function cariPortBebas(): Promise<number> {
  return new Promise((res) => {
    const s = net.createServer();
    s.listen(0, '127.0.0.1', () => {
      const p = (s.address() as net.AddressInfo).port;
      s.close(() => res(p));
    });
  });
}

/** Klien CDP minimal lewat WebSocket (tanpa dependensi tambahan). */
async function cdp(wsUrl: string) {
  const { WebSocket } = await import('ws');
  const ws = new WebSocket(wsUrl);
  await new Promise<void>((res, rej) => {
    ws.once('open', () => res());
    ws.once('error', rej);
  });

  let id = 0;
  const tunggu = new Map<number, (v: unknown) => void>();

  ws.on('message', (data: Buffer) => {
    const msg = JSON.parse(data.toString());
    if (msg.id && tunggu.has(msg.id)) {
      tunggu.get(msg.id)!(msg.result);
      tunggu.delete(msg.id);
    }
  });

  const kirim = (method: string, params: Record<string, unknown> = {}) =>
    new Promise<any>((res) => {
      const myId = ++id;
      tunggu.set(myId, res);
      ws.send(JSON.stringify({ id: myId, method, params }));
    });

  return { kirim, tutup: () => ws.close() };
}

async function main() {
  console.log('=== CETAK PDF LAPORAN SIP ===\n');

  // ---- 1. siapkan sesi ----
  const pegawai = await prisma.pegawai.findUnique({ where: { nip: '90000001' } });
  if (!pegawai) throw new Error('Jalankan dulu: pnpm exec tsx scripts/seed-demo.ts');

  const token = crypto.randomBytes(32).toString('base64url');
  await prisma.sesi.create({
    data: {
      tokenHash: hashToken(token),
      pegawaiId: pegawai.id,
      expiresAt: new Date(Date.now() + 3600_000),
    },
  });

  const daftar = await prisma.penilaian.findMany({
    where: { pegawai: { nip: { in: ['80000001', '80000002', '80000003'] } } },
    select: {
      id: true,
      rating: true,
      nilaiAkhir: true,
      pegawai: { select: { nama: true, nip: true } },
    },
    orderBy: { nilaiAkhir: 'desc' },
  });

  console.log('Sesi dibuat untuk:', pegawai.nama);
  console.log('Penilaian yang akan dicetak:', daftar.length, '\n');

  // ---- 2. jalankan Chrome headless dengan port debugging ----
  const port = await cariPortBebas();
  const { spawn } = await import('node:child_process');
  const chrome = spawn(
    'google-chrome',
    [
      '--headless=new',
      '--disable-gpu',
      '--no-sandbox',
      '--hide-scrollbars',
      `--remote-debugging-port=${port}`,
      '--user-data-dir=/tmp/chrome-sip-pdf',
      'about:blank',
    ],
    { stdio: 'ignore' }
  );

  // tunggu Chrome siap
  let versi: any = null;
  for (let i = 0; i < 40; i++) {
    try {
      versi = await fetch(`http://127.0.0.1:${port}/json/version`).then((r) => r.json());
      break;
    } catch {
      await new Promise((r) => setTimeout(r, 300));
    }
  }
  if (!versi) throw new Error('Chrome gagal start');
  console.log('Chrome:', versi['Browser'], '\n');

  // buka tab baru
  const tab = await fetch(
    `http://127.0.0.1:${port}/json/new?about:blank`,
    { method: 'PUT' }
  ).then((r) => r.json());

  const c = await cdp(tab.webSocketDebuggerUrl);
  await c.kirim('Page.enable');

  // ---- 3. set cookie sesi ----
  await c.kirim('Network.enable');
  await c.kirim('Network.setCookie', {
    name: 'sip_sesi',
    value: token,
    domain: 'localhost',
    path: '/',
    httpOnly: true,
  });
  console.log('Cookie sesi dipasang\n');

  // ---- 4. cetak tiap laporan ----
  const hasil: string[] = [];

  for (const p of daftar) {
    const url = `${BASE}/laporan/${p.id}`;
    await c.kirim('Page.navigate', { url });
    // tunggu halaman selesai dimuat
    await new Promise((r) => setTimeout(r, 2500));

    const pdf = await c.kirim('Page.printToPDF', {
      printBackground: true, // agar warna kop & header tabel tercetak
      paperWidth: 8.27, // A4 dalam inci
      paperHeight: 11.69,
      marginTop: 0.47,
      marginBottom: 0.47,
      marginLeft: 0.39,
      marginRight: 0.39,
      preferCSSPageSize: false,
    });

    const namaFile = `/home/ubuntu/projects/btn-sip/contoh-laporan-${p.pegawai.nip}.pdf`;
    writeFileSync(namaFile, Buffer.from(pdf.data, 'base64'));
    const ukuran = (Buffer.from(pdf.data, 'base64').length / 1024).toFixed(0);
    console.log(
      `  ok  ${p.pegawai.nama.padEnd(18)} ${String(p.nilaiAkhir).padStart(4)} (${(p.rating ?? '-').padEnd(12)}) → ${namaFile.split('/').pop()} (${ukuran} KB)`
    );
    hasil.push(namaFile);
  }

  c.tutup();
  chrome.kill();

  // bersihkan sesi uji
  await prisma.sesi.deleteMany({ where: { pegawaiId: pegawai.id } });

  console.log(`\n✅ ${hasil.length} PDF berhasil dicetak.`);
}

main()
  .catch((e) => {
    console.error('\n❌ GAGAL:', e.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
