/**
 * Tangkapan layar untuk verifikasi visual fitur baru (audit log, pengingat,
 * tren dasbor). Memakai akun uji TSTADMIN, bukan akun nyata.
 *
 * Jalankan: pnpm exec tsx scripts/uji-tangkap-baru.ts
 */
import 'dotenv/config';
import crypto from 'node:crypto';
import net from 'node:net';
import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const BASE = process.env.BASE_URL ?? 'http://localhost:3000';
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});
const h = (t: string) => crypto.createHash('sha256').update(t).digest('hex');

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

async function potret(url: string, keluar: string, token: string, tinggi = 1600) {
  const port = await cariPortBebas();
  const chrome = spawn(
    'google-chrome',
    [
      '--headless=new', '--disable-gpu', '--no-sandbox',
      `--remote-debugging-port=${port}`,
      `--user-data-dir=/tmp/chrome-sip-${Date.now()}`,
      `--window-size=1400,${tinggi}`, 'about:blank',
    ],
    { stdio: 'ignore' }
  );

  for (let i = 0; i < 40; i++) {
    try { await fetch(`http://127.0.0.1:${port}/json/version`); break; }
    catch { await new Promise((r) => setTimeout(r, 300)); }
  }

  const tab = await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: 'PUT' }).then((r) => r.json());
  const c = await cdp(tab.webSocketDebuggerUrl);
  await c.kirim('Page.enable');
  await c.kirim('Network.enable');
  await c.kirim('Emulation.setDeviceMetricsOverride', { width: 1400, height: tinggi, deviceScaleFactor: 1, mobile: false });
  await c.kirim('Network.setCookie', { name: 'sip_sesi', value: token, domain: 'localhost', path: '/' });
  await c.kirim('Page.navigate', { url });
  await new Promise((r) => setTimeout(r, 4500));
  const shot = await c.kirim('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true });
  writeFileSync(keluar, Buffer.from(shot.data, 'base64'));
  console.log('  →', keluar);
  c.tutup();
  chrome.kill();
}

async function main() {
  const admin = await prisma.pegawai.findUnique({ where: { nip: 'TSTADMIN' } });
  if (!admin) throw new Error('akun uji TSTADMIN tidak ada');
  const token = crypto.randomBytes(32).toString('base64url');
  await prisma.sesi.create({
    data: { tokenHash: h(token), pegawaiId: admin.id, expiresAt: new Date(Date.now() + 900000) },
  });

  await potret(`${BASE}/dasbor`, '/home/ubuntu/projects/btn-sip/cek-dasbor-batang.png', token, 2400);
  await potret(`${BASE}/dasbor?unit=244`, '/home/ubuntu/projects/btn-sip/cek-batang-kc.png', token, 2400);

  await prisma.sesi.deleteMany({ where: { pegawaiId: admin.id, tokenHash: h(token) } });
}

main()
  .catch((e) => { console.error('GAGAL:', e.message); process.exit(1); })
  .finally(() => prisma.$disconnect());
