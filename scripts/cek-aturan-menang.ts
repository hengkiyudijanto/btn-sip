/**
 * Cek aturan CSS mana yang benar-benar MENANG untuk kolom Aspek versi lite.
 *
 * Jalankan: pnpm exec tsx scripts/cek-aturan-menang.ts
 */
import 'dotenv/config';
import crypto from 'node:crypto';
import net from 'node:net';
import { spawn } from 'node:child_process';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import bcrypt from 'bcryptjs';

const BASE = process.env.BASE_URL ?? 'http://localhost:3100';
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
  const cabang = await prisma.cabang.findFirst({ where: { aktif: true } });
  const hash = await bcrypt.hash('Menang1x', 10);
  const nipS = 'MENANG01';
  const nipP = 'MENANG02';
  const kodeW = 'MENANG-W1';

  const ids = (await prisma.pegawai.findMany({
    where: { nip: { in: [nipP, nipS] } }, select: { id: true },
  })).map((p) => p.id);
  await prisma.penilaianDetail.deleteMany({ where: { penilaian: { pegawaiId: { in: ids } } } });
  await prisma.penilaian.deleteMany({ where: { pegawaiId: { in: ids } } });
  await prisma.pegawai.deleteMany({ where: { nip: { in: [nipP, nipS] } } });
  await prisma.periode.deleteMany({ where: { kode: kodeW } });

  const spv = await prisma.pegawai.create({
    data: { nip: nipS, nama: 'SPV Menang', passwordHash: hash, role: 'SUPERVISOR',
      harusGantiPassword: false, aktif: true, cabangId: cabang!.id },
  });
  const pet = await prisma.pegawai.create({
    data: { nip: nipP, nama: 'Petugas Menang', passwordHash: hash, role: 'PEGAWAI',
      harusGantiPassword: false, aktif: true, cabangId: cabang!.id, atasanId: spv.id },
  });
  const per = await prisma.periode.create({
    data: { kode: kodeW, nama: 'Uji Menang', tanggalMulai: new Date(2046, 0, 1),
      tanggalSelesai: new Date(2046, 0, 7), aktif: true },
  });
  const pen = await prisma.penilaian.create({
    data: {
      pegawaiId: pet.id, penilaiId: spv.id, periodeId: per.id, status: 'FINAL',
      nilaiAkhir: 3.5, rating: 'Cukup',
      detail: { create: [{ kodeAspek: 'A1', nilaiMentah: 90, skor: 3, bobotAspek: 0.4 }] },
    },
  });

  const token = crypto.randomBytes(32).toString('base64url');
  await prisma.sesi.create({
    data: { tokenHash: h(token), pegawaiId: spv.id, expiresAt: new Date(Date.now() + 900000) },
  });

  const port = await cariPortBebas();
  const chrome = spawn('google-chrome', [
    '--headless=new', '--disable-gpu', '--no-sandbox',
    `--remote-debugging-port=${port}`,
    `--user-data-dir=/tmp/chrome-menang-${Date.now()}`, 'about:blank',
  ], { stdio: 'ignore' });
  for (let i = 0; i < 40; i++) {
    try { await fetch(`http://127.0.0.1:${port}/json/version`); break; }
    catch { await new Promise((r) => setTimeout(r, 300)); }
  }
  const tab = await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: 'PUT' })
    .then((r) => r.json());
  const c = await cdp(tab.webSocketDebuggerUrl);
  await c.kirim('Page.enable');
  await c.kirim('Network.enable');
  await c.kirim('Network.setCookie', {
    name: 'sip_sesi', value: token, domain: new URL(BASE).hostname, path: '/',
  });

  await c.kirim('Page.navigate', { url: `${BASE}/laporan/${pen.id}?versi=lite` });
  await new Promise((r) => setTimeout(r, 3500));
  await c.kirim('Emulation.setEmulatedMedia', { media: 'print' });
  await new Promise((r) => setTimeout(r, 600));

  const hasil = await c.kirim('Runtime.evaluate', {
    expression: `(() => {
      const th = document.querySelector('.sip-tabel thead th.sip-k-aspek');
      if (!th) return JSON.stringify({ error: 'th tidak ditemukan',
        adaTh: [...document.querySelectorAll('.sip-tabel thead th')].map(x => x.className) });
      const tabel = th.closest('table');
      const root = document.querySelector('.sip-laporan');
      const cs = getComputedStyle(th);
      const csTabel = getComputedStyle(tabel);
      // kumpulkan aturan CSS yang cocok dengan elemen ini
      const cocok = [];
      for (const ss of document.styleSheets) {
        let rules;
        try { rules = ss.cssRules; } catch { continue; }
        for (const r of rules) {
          if (!r.selectorText) continue;
          try {
            if (th.matches(r.selectorText)) {
              cocok.push({ sel: r.selectorText, width: r.style.width || '(tidak diatur)' });
            }
          } catch {}
        }
      }
      return JSON.stringify({
        kelasTh: th.className,
        kelasRoot: root.className,
        tableLayout: csTabel.tableLayout,
        lebarTabel: tabel.getBoundingClientRect().width.toFixed(1),
        computedWidth: cs.width,
        aturanCocok: cocok,
        mediaCetak: window.matchMedia('print').matches,
      });
    })()`,
    returnByValue: true,
  });
  console.log(JSON.stringify(JSON.parse(hasil.result.value), null, 2));

  c.tutup();
  chrome.kill();
  await prisma.penilaianDetail.deleteMany({ where: { penilaianId: pen.id } });
  await prisma.penilaian.delete({ where: { id: pen.id } });
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
