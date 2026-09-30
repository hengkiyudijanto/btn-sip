/**
 * Tangkapan layar panel foto penilaian (sebelum & sesudah foto ada).
 * Jalankan: pnpm exec tsx scripts/tangkapan-foto-penilaian.ts
 */
import 'dotenv/config';
import crypto from 'node:crypto';
import net from 'node:net';
import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import bcrypt from 'bcryptjs';

const BASE = process.env.BASE_URL ?? 'http://localhost:3100';
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});
const h = (t: string) => crypto.createHash('sha256').update(t).digest('hex');

// foto 3x4 sederhana dengan gradien + teks, dibuat sebagai JPEG kecil
const JPEG_FOTO = `data:image/jpeg;base64,${Buffer.from(
  'x'.repeat(1)
).toString('base64')}`;

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

async function potret(url: string, keluar: string, token: string, tinggi = 1000) {
  const port = await cariPortBebas();
  const chrome = spawn(
    'google-chrome',
    [
      '--headless=new', '--disable-gpu', '--no-sandbox',
      `--remote-debugging-port=${port}`,
      `--user-data-dir=/tmp/chrome-fp-${Date.now()}`,
      `--window-size=1500,${tinggi}`, 'about:blank',
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
    width: 1500, height: tinggi, deviceScaleFactor: 1, mobile: false,
  });
  await c.kirim('Network.setCookie', {
    name: 'sip_sesi', value: token, domain: 'localhost', path: '/',
  });
  await c.kirim('Page.navigate', { url });
  await new Promise((r) => setTimeout(r, 4000));
  const shot = await c.kirim('Page.captureScreenshot', {
    format: 'png', captureBeyondViewport: true,
  });
  writeFileSync(keluar, Buffer.from(shot.data, 'base64'));
  console.log('  →', keluar);
  c.tutup();
  chrome.kill();
}

async function main() {
  const cabang = await prisma.cabang.findFirst({ where: { aktif: true } });
  const hash = await bcrypt.hash('Tampil123', 10);
  const nipS = 'TAMPIL01';
  const nipP = 'TAMPIL02';
  const kodeW = 'TAMPIL-W1';

  await prisma.penilaianDetail.deleteMany({
    where: { penilaian: { pegawai: { nip: { in: [nipP, nipS] } } } },
  });
  await prisma.penilaian.deleteMany({ where: { pegawai: { nip: { in: [nipP, nipS] } } } });
  await prisma.pegawai.deleteMany({ where: { nip: { in: [nipP, nipS] } } });
  await prisma.periode.deleteMany({ where: { kode: kodeW } });

  const spv = await prisma.pegawai.create({
    data: { nip: nipS, nama: 'SPV Tampilan', passwordHash: hash, role: 'SUPERVISOR',
      harusGantiPassword: false, aktif: true, cabangId: cabang!.id },
  });
  const pet = await prisma.pegawai.create({
    data: { nip: nipP, nama: 'IRWAN ALLO', passwordHash: hash, role: 'PEGAWAI',
      harusGantiPassword: false, aktif: true, cabangId: cabang!.id, atasanId: spv.id },
  });
  const per = await prisma.periode.create({
    data: { kode: kodeW, nama: 'Minggu ke-1 Oktober 2026',
      tanggalMulai: new Date(2040, 6, 1), tanggalSelesai: new Date(2040, 6, 7), aktif: true },
  });

  const token = crypto.randomBytes(32).toString('base64url');
  await prisma.sesi.create({
    data: { tokenHash: h(token), pegawaiId: spv.id, expiresAt: new Date(Date.now() + 900000) },
  });

  const url = `${BASE}/penilaian/${pet.id}?periode=${per.id}`;

  console.log('1. tanpa foto');
  await potret(url, '/home/ubuntu/projects/btn-sip/cek-foto-belum.png', token, 1100);

  // pasang foto: hasilkan JPEG dengan Chrome dulu (3x4 dengan warna)
  const port2 = await cariPortBebas();
  const chrome2 = spawn('google-chrome', [
    '--headless=new', '--disable-gpu', '--no-sandbox',
    `--remote-debugging-port=${port2}`,
    `--user-data-dir=/tmp/chrome-gen-${Date.now()}`, 'about:blank',
  ], { stdio: 'ignore' });
  for (let i = 0; i < 40; i++) {
    try { await fetch(`http://127.0.0.1:${port2}/json/version`); break; }
    catch { await new Promise((r) => setTimeout(r, 300)); }
  }
  const tab2 = await fetch(`http://127.0.0.1:${port2}/json/new?about:blank`, { method: 'PUT' })
    .then((r) => r.json());
  const c2 = await cdp(tab2.webSocketDebuggerUrl);
  await c2.kirim('Runtime.enable');
  const gen = await c2.kirim('Runtime.evaluate', {
    expression: `(() => {
      const cv = document.createElement('canvas');
      cv.width = 300; cv.height = 400;
      const x = cv.getContext('2d');
      const g = x.createLinearGradient(0, 0, 300, 400);
      g.addColorStop(0, '#00539f'); g.addColorStop(1, '#d4112e');
      x.fillStyle = g; x.fillRect(0, 0, 300, 400);
      x.fillStyle = '#fff'; x.font = 'bold 26px sans-serif';
      x.fillText('FOTO', 100, 180);
      x.font = 'bold 20px sans-serif';
      x.fillText('PETUGAS', 78, 215);
      return cv.toDataURL('image/jpeg', 0.85);
    })()`,
    returnByValue: true,
  });
  c2.tutup();
  chrome2.kill();

  const dataUrl = gen.result.value as string;
  const b64 = dataUrl.split(',')[1];
  const byte = Math.floor((b64.length * 3) / 4);

  await prisma.penilaian.update({
    where: { pegawaiId_periodeId: { pegawaiId: pet.id, periodeId: per.id } },
    data: {
      fotoData: dataUrl, fotoMime: 'image/jpeg', fotoUkuran: byte,
      fotoDiperbarui: new Date(), fotoCatatan: 'seragam lengkap dengan name tag',
    },
  });

  console.log('2. dengan foto');
  await potret(url, '/home/ubuntu/projects/btn-sip/cek-foto-ada.png', token, 1100);

  // laporan
  const pen = await prisma.penilaian.findUnique({
    where: { pegawaiId_periodeId: { pegawaiId: pet.id, periodeId: per.id } },
  });
  if (pen) {
    console.log('3. lembar laporan');
    await potret(`${BASE}/laporan/${pen.id}`, '/home/ubuntu/projects/btn-sip/cek-foto-laporan.png', token, 1400);
  }

  await prisma.penilaianDetail.deleteMany({ where: { penilaian: { pegawaiId: pet.id } } });
  await prisma.penilaian.deleteMany({ where: { pegawaiId: pet.id } });
  await prisma.sesi.deleteMany({ where: { pegawaiId: spv.id } });
  await prisma.pegawai.deleteMany({ where: { nip: { in: [nipP, nipS] } } });
  await prisma.periode.deleteMany({ where: { kode: kodeW } });
}

main()
  .catch((e) => {
    console.error('GAGAL:', e.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
