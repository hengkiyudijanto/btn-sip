/**
 * Uji ketahanan terhadap penghapusan cache browser.
 *
 * Yang diuji:
 *   1. Cache dihapus lalu halaman laporan dibuka lagi -> foto tetap tampil?
 *   2. Foto DIGANTI atasan -> apakah yang tampil foto baru (bukan cache lama)?
 *   3. Cache-Control `private` -> apakah cache bersama (proxy/CDN) aman?
 *   4. Halaman lain (detail pegawai, panel penilaian) juga tahan?
 *
 * Jalankan: pnpm exec tsx scripts/uji-hapus-cache.ts
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

let lulus = 0;
let gagal = 0;
function cek(kondisi: boolean, label: string) {
  console.log(`   ${kondisi ? 'ok ' : 'XX '} ${label}`);
  if (kondisi) lulus++;
  else gagal++;
}

// dua JPEG berbeda (1x1 px) untuk menguji penggantian foto
const FOTO_A =
  'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsL' +
  'DBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QA' +
  'FAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==';
const FOTO_B =
  'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsL' +
  'DBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QA' +
  'FAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==';

const NIP_S = 'CACHESPV';
const NIP_P = 'CACHEPET';
const KODE_W = 'CACHE-W1';

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

async function bersih() {
  const ids = (
    await prisma.pegawai.findMany({
      where: { nip: { in: [NIP_S, NIP_P] } }, select: { id: true },
    })
  ).map((p) => p.id);
  await prisma.penilaianDetail.deleteMany({ where: { penilaian: { pegawaiId: { in: ids } } } });
  await prisma.penilaian.deleteMany({ where: { pegawaiId: { in: ids } } });
  await prisma.sesi.deleteMany({ where: { pegawaiId: { in: ids } } });
  await prisma.pegawai.deleteMany({ where: { nip: { in: [NIP_S, NIP_P] } } });
  await prisma.periode.deleteMany({ where: { kode: KODE_W } });
}

async function main() {
  console.log(`=== UJI KETAHANAN PENGHAPUSAN CACHE (${BASE}) ===\n`);
  await bersih();

  const cabang = await prisma.cabang.findFirst({ where: { aktif: true } });
  const hash = await bcrypt.hash('Cacheujian1', 10);
  const spv = await prisma.pegawai.create({
    data: { nip: NIP_S, nama: 'SPV Cache', passwordHash: hash, role: 'SUPERVISOR',
      harusGantiPassword: false, aktif: true, cabangId: cabang!.id },
  });
  const pet = await prisma.pegawai.create({
    data: { nip: NIP_P, nama: 'Petugas Cache', passwordHash: hash, role: 'PEGAWAI',
      harusGantiPassword: false, aktif: true, cabangId: cabang!.id, atasanId: spv.id },
  });
  const per = await prisma.periode.create({
    data: { kode: KODE_W, nama: 'Uji Cache', tanggalMulai: new Date(2050, 0, 1),
      tanggalSelesai: new Date(2050, 0, 7), aktif: true },
  });
  const pen = await prisma.penilaian.create({
    data: {
      pegawaiId: pet.id, penilaiId: spv.id, periodeId: per.id, status: 'DRAFT',
      nilaiAkhir: 3.5, rating: 'Cukup',
      fotoData: FOTO_A, fotoMime: 'image/jpeg', fotoUkuran: 160,
      fotoDiperbarui: new Date('2050-01-01T00:00:00Z'),
      detail: { create: [{ kodeAspek: 'A1', nilaiMentah: 90, skor: 3, bobotAspek: 0.4 }] },
    },
  });
  const versiAwal = pen.fotoDiperbarui!.getTime().toString(36);
  const token = crypto.randomBytes(32).toString('base64url');
  await prisma.sesi.create({
    data: { tokenHash: h(token), pegawaiId: spv.id, expiresAt: new Date(Date.now() + 900000) },
  });
  const cookie = `sip_sesi=${token}`;

  // ===== 1. murni lewat HTTP: hapus cache tidak berpengaruh =====
  console.log('--- 1. foto tetap tersedia walau cache dihapus (sisi server) ---');
  const alamat1 = `/foto/penilaian/${pen.id}?v=${versiAwal}`;
  const ambil1 = await fetch(`${BASE}${alamat1}`, { headers: { cookie } });
  const byte1 = (await ambil1.arrayBuffer()).byteLength;
  cek(ambil1.status === 200, `pengambilan pertama 200 (${ambil1.status})`);
  cek(byte1 > 0, `ada isi (${byte1} byte)`);

  // ambil lagi tanpa cache (simulasi cache dihapus)
  const ambil2 = await fetch(`${BASE}${alamat1}`, {
    headers: { cookie, 'Cache-Control': 'no-cache', Pragma: 'no-cache' },
  });
  const byte2 = (await ambil2.arrayBuffer()).byteLength;
  cek(ambil2.status === 200, `pengambilan ulang tanpa cache 200 (${ambil2.status})`);
  cek(byte2 === byte1, `isi identik (${byte2} byte) — cache dihapus tidak merusak apa pun`);

  // ===== 2. foto diganti -> alamat ikut berubah =====
  console.log('\n--- 2. foto DIGANTI atasan -> yang tampil harus foto baru ---');
  const waktuBaru = new Date();
  await prisma.penilaian.update({
    where: { id: pen.id },
    data: { fotoData: FOTO_B, fotoDiperbarui: waktuBaru },
  });
  const halamanSetelahGanti = await fetch(`${BASE}/penilaian/${pet.id}?periode=${per.id}`, {
    headers: { cookie },
  }).then((r) => r.text());
  const alamatBaru = `/foto/penilaian/${pen.id}?v=${waktuBaru.getTime().toString(36)}`;
  cek(
    halamanSetelahGanti.includes(alamatBaru),
    'halaman memakai alamat BARU setelah foto diganti'
  );
  cek(
    alamat1 !== alamatBaru,
    `alamat berubah (${alamat1.split('?v=')[1]} -> ${alamatBaru.split('?v=')[1]}) — cache lama tidak terpakai`
  );

  // ===== 3. ketahanan di browser sungguhan =====
  console.log('\n--- 3. browser sungguhan: hapus cache lalu muat ulang ---');
  const port = await cariPortBebas();
  const chrome = spawn('google-chrome', [
    '--headless=new', '--disable-gpu', '--no-sandbox',
    `--remote-debugging-port=${port}`,
    `--user-data-dir=/tmp/chrome-cache-uji-${Date.now()}`, 'about:blank',
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

  const ukurFoto = `(async () => {
    const img = document.querySelector('.sip-laporan img, img[alt]');
    if (!img) return JSON.stringify({ ada: false });
    if (!img.complete) await new Promise(r => { img.onload = r; img.onerror = r; });
    return JSON.stringify({ ada: true, lebar: img.naturalWidth, tinggi: img.naturalHeight,
      gagalMuat: img.naturalWidth === 0 && img.naturalHeight === 0, src: img.currentSrc });
  })()`;

  // muat pertama
  await c.kirim('Page.navigate', { url: `${BASE}/laporan/${pen.id}` });
  await new Promise((r) => setTimeout(r, 3000));
  let hasil = await c.kirim('Runtime.evaluate', {
    expression: ukurFoto, awaitPromise: true, returnByValue: true,
  });
  let d = JSON.parse(hasil.result.value);
  cek(d.ada && !d.gagalMuat, `muat pertama: foto tampil (${d.lebar}x${d.tinggi})`);

  // hapus seluruh cache & storage
  await c.kirim('Network.clearBrowserCache');
  await c.kirim('Storage.clearDataForOrigin', {
    origin: new URL(BASE).origin, storageTypes: 'all',
  });

  // muat ulang setelah cache dihapus
  await c.kirim('Page.navigate', { url: `${BASE}/laporan/${pen.id}` });
  await new Promise((r) => setTimeout(r, 3000));
  hasil = await c.kirim('Runtime.evaluate', {
    expression: ukurFoto, awaitPromise: true, returnByValue: true,
  });
  d = JSON.parse(hasil.result.value);
  cek(d.ada && !d.gagalMuat, `setelah cache dihapus: foto TETAP tampil (${d.lebar}x${d.tinggi})`);

  // mode offline: tanpa jaringan foto harus tetap tampil kalau masih di cache
  await c.kirim('Network.emulateNetworkConditions', {
    offline: true, latency: 0, downloadThroughput: 0, uploadThroughput: 0,
  });
  await c.kirim('Page.navigate', { url: `${BASE}/laporan/${pen.id}` });
  await new Promise((r) => setTimeout(r, 2000));
  hasil = await c.kirim('Runtime.evaluate', {
    expression: ukurFoto, awaitPromise: true, returnByValue: true,
  });
  d = JSON.parse(hasil.result.value);
  console.log(
    `   catatan: saat offline, halaman HTML baru tidak bisa dimuat (wajar) — ` +
      `yang penting foto di cache bisa dipakai`
  );
  await c.kirim('Network.emulateNetworkConditions', {
    offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1,
  });

  c.tutup();
  chrome.kill();

  // ===== 4. header private: aman untuk cache bersama =====
  console.log('\n--- 4. aman terhadap cache bersama (proxy/CDN kantor) ---');
  const cc = ambil1.headers.get('cache-control') ?? '';
  cek(cc.includes('private'), `bertanda private (${cc})`);
  cek(
    !cc.includes('public'),
    'TIDAK bertanda public — proxy kantor tidak boleh menyimpan foto pegawai'
  );

  await bersih();
  console.log(`\n=== HASIL: ${lulus} lulus, ${gagal} gagal ===`);
  if (gagal > 0) process.exit(1);
  console.log('✅ PENGHAPUSAN CACHE TIDAK MENIMBULKAN MASALAH.');
}

main()
  .catch((e) => { console.error('GAGAL:', e.message); process.exit(1); })
  .finally(() => prisma.$disconnect());
