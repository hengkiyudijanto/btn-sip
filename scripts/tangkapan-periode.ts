/**
 * Ambil tangkapan layar halaman Periode memakai Chrome headless + CDP.
 * Login dulu lewat HTTP untuk mendapat cookie sesi, lalu buka halaman.
 *
 * Jalankan: BASE_URL=http://localhost:3100 pnpm exec tsx scripts/tangkapan-periode.ts
 */
import 'dotenv/config';
import crypto from 'node:crypto';
import net from 'node:net';
import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const BASE = process.env.BASE_URL ?? 'http://localhost:3100';
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

const hashToken = (t: string) => crypto.createHash('sha256').update(t).digest('hex');

function cariPortBebas(): Promise<number> {
  return new Promise((res) => {
    const s = net.createServer();
    s.listen(0, '127.0.0.1', () => {
      const p = (s.address() as net.AddressInfo).port;
      s.close(() => res(p));
    });
  });
}

async function cdp(wsUrl: string) {
  const { WebSocket } = await import('ws');
  const ws = new WebSocket(wsUrl);
  await new Promise<void>((res, rej) => {
    ws.once('open', () => res());
    ws.once('error', rej);
  });
  let id = 0;
  const tunggu = new Map<number, (v: unknown) => void>();
  ws.on('message', (d: Buffer) => {
    const m = JSON.parse(d.toString());
    if (m.id && tunggu.has(m.id)) {
      tunggu.get(m.id)!(m.result);
      tunggu.delete(m.id);
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
  const admin = await prisma.pegawai.findUnique({ where: { nip: 'admin' } });
  if (!admin) throw new Error('akun admin tidak ada');

  const token = crypto.randomBytes(32).toString('base64url');
  await prisma.sesi.create({
    data: {
      tokenHash: hashToken(token),
      pegawaiId: admin.id,
      expiresAt: new Date(Date.now() + 1800_000),
    },
  });

  const port = await cariPortBebas();
  const chrome = spawn(
    'google-chrome',
    [
      '--headless=new',
      '--disable-gpu',
      '--no-sandbox',
      `--remote-debugging-port=${port}`,
      '--user-data-dir=/tmp/chrome-periode-tangkap',
      '--window-size=1400,2200',
      'about:blank',
    ],
    { stdio: 'ignore' }
  );

  let siap = false;
  for (let i = 0; i < 40; i++) {
    try {
      await fetch(`http://127.0.0.1:${port}/json/version`);
      siap = true;
      break;
    } catch {
      await new Promise((r) => setTimeout(r, 300));
    }
  }
  if (!siap) throw new Error('Chrome gagal start');

  const tab = await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, {
    method: 'PUT',
  }).then((r) => r.json());
  const c = await cdp(tab.webSocketDebuggerUrl);
  await c.kirim('Page.enable');
  await c.kirim('Network.enable');
  await c.kirim('Emulation.setDeviceMetricsOverride', {
    width: 1400,
    height: 2200,
    deviceScaleFactor: 1,
    mobile: false,
  });

  // pasang cookie sesi
  await c.kirim('Network.setCookie', {
    name: 'sip_sesi',
    value: token,
    domain: 'localhost',
    path: '/',
  });

  await c.kirim('Page.navigate', { url: `${BASE}/periode` });
  await new Promise((r) => setTimeout(r, 4000));

  const hasil = await c.kirim('Page.captureScreenshot', {
    format: 'png',
    captureBeyondViewport: true,
  });

  const keluar = '/home/ubuntu/projects/btn-sip/cek-periode.png';
  writeFileSync(keluar, Buffer.from(hasil.data, 'base64'));
  console.log('tangkapan layar:', keluar);

  c.tutup();
  chrome.kill();
  await prisma.sesi.deleteMany({ where: { pegawaiId: admin.id } });
}

main()
  .catch((e) => {
    console.error('GAGAL:', e.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
