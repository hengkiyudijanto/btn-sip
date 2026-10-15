/**
 * Cetak laporan NYATA dari PRODUKSI (bukan data uji) untuk kedua versi, lalu
 * periksa isinya. Memakai penilaian yang sudah ada di database dan punya catatan,
 * jadi yang diverifikasi adalah data sungguhan seperti yang dilihat penilai.
 *
 * Tidak mengubah data apa pun — hanya membuat satu baris Sesi sementara.
 *
 * Jalankan:
 *   BASE_URL=https://btn-sip.vercel.app pnpm exec tsx scripts/cetak-laporan-nyata-produksi.ts
 */
import 'dotenv/config';
import crypto from 'node:crypto';
import net from 'node:net';
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const BASE = process.env.BASE_URL ?? 'https://btn-sip.vercel.app';
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });
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
    new Promise<Record<string, unknown>>((res) => {
      const n = ++id;
      tunggu.set(n, res as (v: unknown) => void);
      ws.send(JSON.stringify({ id: n, method, params }));
    });
  return { kirim, tutup: () => ws.close() };
}

async function cetakPdf(url: string, keluar: string, token: string, marginInci: number) {
  const port = await cariPortBebas();
  const profil = `/tmp/chrome-cetak-${Date.now()}`;
  const chrome = spawn(
    process.env.CHROME_BIN ?? '/usr/bin/google-chrome',
    [
      '--headless=new',
      `--remote-debugging-port=${port}`,
      `--user-data-dir=${profil}`,
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-gpu',
    ],
    { stdio: 'ignore' }
  );

  // Tunggu Chrome siap, lalu buka TAB BARU (bukan memakai tab bawaan) — sama
  // seperti scripts/cetak-dua-versi.ts yang sudah terbukti. Memakai tab bawaan
  // membuat Page.printToPDF mengembalikan respons tanpa .data.
  for (let i = 0; i < 40; i++) {
    try { await fetch(`http://127.0.0.1:${port}/json/version`); break; }
    catch { await new Promise((r) => setTimeout(r, 300)); }
  }
  const tab = await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: 'PUT' })
    .then((r) => r.json() as Promise<{ webSocketDebuggerUrl: string }>);
  if (!tab?.webSocketDebuggerUrl) throw new Error('tab Chrome tidak ditemukan');

  const c = await cdp(tab.webSocketDebuggerUrl);
  await c.kirim('Page.enable');
  await c.kirim('Network.enable');
  await c.kirim('Network.setCookie', {
    name: 'sip_sesi',
    value: token,
    domain: new URL(BASE).hostname,
    path: '/',
    secure: true,
  });

  await c.kirim('Page.navigate', { url });
  await new Promise((r) => setTimeout(r, 3000));

  // tunggu semua gambar selesai dimuat (foto + logo)
  await c.kirim('Runtime.evaluate', {
    expression: `(async () => {
      const imgs = [...document.images];
      await Promise.all(imgs.map(i => i.complete ? null : new Promise(r => { i.onload = i.onerror = r; })));
      return imgs.filter(i => !i.complete || i.naturalWidth === 0).length;
    })()`,
    awaitPromise: true,
    returnByValue: true,
  });

  const hasil = (await c.kirim('Page.printToPDF', {
    printBackground: true,
    marginTop: marginInci / 25.4,
    marginBottom: marginInci / 25.4,
    marginLeft: marginInci / 25.4,
    marginRight: marginInci / 25.4,
    format: 'A4',
  })) as { data: string };

  const { writeFileSync } = await import('node:fs');
  writeFileSync(keluar, Buffer.from(hasil.data, 'base64'));
  c.tutup();
  chrome.kill();

  const { size } = await import('node:fs').then((fs) => fs.statSync(keluar));
  return size;
}

async function main() {
  console.log(`=== CETAK LAPORAN NYATA DARI PRODUKSI (${BASE}) ===\n`);

  // pakai penilaian NYATA yang punya catatan, supaya yang diperiksa data sungguhan
  const pen = await prisma.penilaian.findFirst({
    where: { AND: [{ nilaiAkhir: { not: null } }, { catatanUmum: { not: '' } }] },
    select: {
      id: true,
      nilaiAkhir: true,
      rating: true,
      catatanUmum: true,
      pegawai: { select: { nama: true, nip: true, cabang: { select: { kode: true, nama: true } } } },
      periode: { select: { nama: true } },
      penilai: { select: { nama: true, nip: true, role: true } },
    },
  });
  if (!pen) throw new Error('tidak ada penilaian ber-catatan di database');

  console.log(`penilaian nyata: ${pen.pegawai.nama} (${pen.pegawai.nip})`);
  console.log(`  periode : ${pen.periode.nama}`);
  console.log(`  cabang  : ${pen.pegawai.cabang.kode} ${pen.pegawai.cabang.nama}`);
  console.log(`  penilai : ${pen.penilai.nama} (${pen.penilai.role})`);
  console.log(`  nilai   : ${pen.nilaiAkhir} ${pen.rating}`);
  console.log(`  catatan : ${JSON.stringify(pen.catatanUmum?.slice(0, 70))}\n`);

  const admin = await prisma.pegawai.findFirst({ where: { role: 'ADMIN', aktif: true } });
  if (!admin) throw new Error('tidak ada admin aktif');
  const token = crypto.randomBytes(32).toString('base64url');
  await prisma.sesi.create({
    data: { tokenHash: h(token), pegawaiId: admin.id, expiresAt: new Date(Date.now() + 900_000) },
  });

  const berkas = process.env.BERKAS ?? '/home/ubuntu/projects/btn-sip';
  const k1 = `${berkas}/laporan-nyata-lengkap.pdf`;
  const k2 = `${berkas}/laporan-nyata-lite.pdf`;

  console.log('cetak LENGKAP (margin 12mm) ...');
  const s1 = await cetakPdf(`${BASE}/laporan/${pen.id}`, k1, token, 12);
  console.log(`  → ${k1} (${Math.round(s1 / 1024)} KB)`);

  console.log('cetak LITE (margin 8mm) ...');
  const s2 = await cetakPdf(`${BASE}/laporan/${pen.id}?versi=lite`, k2, token, 8);
  console.log(`  → ${k2} (${Math.round(s2 / 1024)} KB)`);

  await prisma.sesi.deleteMany({ where: { pegawaiId: admin.id, tokenHash: h(token) } });
  console.log('\n✓ sesi sementara dihapus');

  console.log(JSON.stringify({ lengkap: k1, lite: k2, penilaianId: pen.id, nama: pen.pegawai.nama }));
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error('GAGAL:', e.message);
  process.exit(1);
});
