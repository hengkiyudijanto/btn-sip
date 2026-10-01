/**
 * Periksa apakah kelas .sip-padat benar-benar terpasang di HTML versi lite,
 * dan apakah aturan CSS-nya benar-benar aktif di browser.
 *
 * Jalankan: pnpm exec tsx scripts/cek-kelas-padat.ts
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
  const hash = await bcrypt.hash('Cekkelas1', 10);
  const nipS = 'KELAS001';
  const nipP = 'KELAS002';
  const kodeW = 'KELAS-W1';

  const ids = (await prisma.pegawai.findMany({
    where: { nip: { in: [nipP, nipS] } }, select: { id: true },
  })).map((p) => p.id);
  await prisma.penilaianDetail.deleteMany({ where: { penilaian: { pegawaiId: { in: ids } } } });
  await prisma.penilaian.deleteMany({ where: { pegawaiId: { in: ids } } });
  await prisma.pegawai.deleteMany({ where: { nip: { in: [nipP, nipS] } } });
  await prisma.periode.deleteMany({ where: { kode: kodeW } });

  const spv = await prisma.pegawai.create({
    data: { nip: nipS, nama: 'SPV Kelas', passwordHash: hash, role: 'SUPERVISOR',
      harusGantiPassword: false, aktif: true, cabangId: cabang!.id },
  });
  const pet = await prisma.pegawai.create({
    data: { nip: nipP, nama: 'Petugas Kelas', passwordHash: hash, role: 'PEGAWAI',
      harusGantiPassword: false, aktif: true, cabangId: cabang!.id, atasanId: spv.id },
  });
  const per = await prisma.periode.create({
    data: { kode: kodeW, nama: 'Uji Kelas', tanggalMulai: new Date(2044, 0, 1),
      tanggalSelesai: new Date(2044, 0, 7), aktif: true },
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
    `--user-data-dir=/tmp/chrome-kelas-${Date.now()}`, 'about:blank',
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

  for (const versi of ['lengkap', 'lite'] as const) {
    const url = versi === 'lite'
      ? `${BASE}/laporan/${pen.id}?versi=lite`
      : `${BASE}/laporan/${pen.id}`;
    await c.kirim('Page.navigate', { url });
    await new Promise((r) => setTimeout(r, 3500));

    const hasil = await c.kirim('Runtime.evaluate', {
      expression: `(() => {
        const root = document.querySelector('.sip-laporan');
        const el = document.querySelector('.sip-foto');
        const cs = el ? getComputedStyle(el) : null;
        const tabel = document.querySelector('.sip-tabel');
        return JSON.stringify({
          kelasRoot: root ? root.className : null,
          adaSipPadat: root ? root.classList.contains('sip-padat') : false,
          fotoComputed: cs ? { w: cs.width, h: cs.height } : null,
          // apakah stylesheet versi padat termuat?
          jumlahRule: [...document.styleSheets].reduce((n, s) => {
            try { return n + s.cssRules.length; } catch { return n; }
          }, 0),
          // cari rule .sip-padat .sip-foto di stylesheet
          rulePadatFoto: [...document.styleSheets].flatMap(s => {
            try { return [...s.cssRules]; } catch { return []; }
          }).filter(r => r.selectorText && r.selectorText.includes('sip-padat .sip-foto'))
           .map(r => r.cssText.slice(0, 120)),
          tabelLebar: tabel ? tabel.getBoundingClientRect().width.toFixed(1) : null,
        });
      })()`,
      returnByValue: true,
    });
    const d = JSON.parse(hasil.result.value);
    console.log(`=== VERSI ${versi.toUpperCase()} ===`);
    console.log(`  kelas .sip-laporan : ${d.kelasRoot}`);
    console.log(`  ada .sip-padat     : ${d.adaSipPadat}`);
    console.log(`  computed foto      : ${JSON.stringify(d.fotoComputed)}`);
    console.log(`  jumlah CSS rule    : ${d.jumlahRule}`);
    console.log(`  rule .sip-padat .sip-foto: ${d.rulePadatFoto.length} ditemukan`);
    for (const r of d.rulePadatFoto) console.log(`      ${r}`);
    console.log();
  }

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
