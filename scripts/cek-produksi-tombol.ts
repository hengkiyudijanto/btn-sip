/**
 * Cek apakah tombol "Unduh Excel" benar-benar ada di HTML produksi,
 * dan ambil tangkapan layarnya untuk melihat apakah terlihat di layar.
 *
 * Jalankan: BASE_URL=https://btn-sip.vercel.app pnpm exec tsx scripts/cek-produksi-tombol.ts
 */
import 'dotenv/config';
import crypto from 'node:crypto';
import net from 'node:net';
import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const BASE = process.env.BASE_URL ?? 'https://btn-sip.vercel.app';
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

async function main() {
  const admin = await prisma.pegawai.findUnique({ where: { nip: 'admin' } });
  if (!admin) throw new Error('admin tidak ada');
  const token = crypto.randomBytes(32).toString('base64url');
  await prisma.sesi.create({
    data: { tokenHash: h(token), pegawaiId: admin.id, expiresAt: new Date(Date.now() + 600000) },
  });

  // ===== 1. HTML mentah =====
  console.log('=== 1. HTML PRODUKSI ===');
  const res = await fetch(`${BASE}/laporan`, {
    headers: { cookie: 'sip_sesi=' + token, 'cache-control': 'no-cache' },
    redirect: 'manual',
  });
  const html = await res.text();
  console.log(`status: ${res.status}`);
  console.log(`ada '/laporan/ekspor' : ${html.includes('/laporan/ekspor')}`);
  console.log(`ada 'Unduh Excel'     : ${html.includes('Unduh Excel')}`);
  console.log(`ada 'Unduh'           : ${html.includes('Unduh')}`);
  console.log(`ada 'Tampilkan'       : ${html.includes('Tampilkan')}`);

  // cari semua elemen <a> di sekitar form filter
  const idxForm = html.indexOf('name="periode"');
  if (idxForm > 0) {
    const sekitar = html.slice(idxForm, idxForm + 2600);
    const tautan = sekitar.match(/<a\b[^>]*>[\s\S]{0,120}?<\/a>/g) ?? [];
    console.log(`\ntautan di area filter: ${tautan.length}`);
    for (const t of tautan) {
      const href = t.match(/href="([^"]*)"/)?.[1] ?? '-';
      const teks = t.replace(/<[^>]*>/g, '').trim();
      console.log(`  href="${href}"  teks="${teks}"`);
    }
  }

  // ===== 2. tangkapan layar =====
  console.log('\n=== 2. TANGKAPAN LAYAR ===');
  const port = await cariPortBebas();
  const chrome = spawn(
    'google-chrome',
    [
      '--headless=new', '--disable-gpu', '--no-sandbox',
      `--remote-debugging-port=${port}`,
      `--user-data-dir=/tmp/chrome-tombol-${Date.now()}`,
      '--window-size=1400,1000', 'about:blank',
    ],
    { stdio: 'ignore' }
  );
  for (let i = 0; i < 40; i++) {
    try {
      await fetch(`http://127.0.0.1:${port}/json/version`);
      break;
    } catch {
      await new Promise((r) => setTimeout(r, 300));
    }
  }
  const tab = await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, {
    method: 'PUT',
  }).then((r) => r.json());
  const c = await cdp(tab.webSocketDebuggerUrl);
  await c.kirim('Page.enable');
  await c.kirim('Network.enable');
  await c.kirim('Emulation.setDeviceMetricsOverride', {
    width: 1400, height: 1000, deviceScaleFactor: 1, mobile: false,
  });
  await c.kirim('Network.setCookie', {
    name: 'sip_sesi', value: token, domain: 'btn-sip.vercel.app', path: '/',
  });
  await c.kirim('Page.navigate', { url: `${BASE}/laporan` });
  await new Promise((r) => setTimeout(r, 5000));

  const shot = await c.kirim('Page.captureScreenshot', {
    format: 'png', captureBeyondViewport: true,
  });
  const keluar = '/home/ubuntu/projects/btn-sip/cek-produksi-tombol.png';
  writeFileSync(keluar, Buffer.from(shot.data, 'base64'));
  console.log('  →', keluar);

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
