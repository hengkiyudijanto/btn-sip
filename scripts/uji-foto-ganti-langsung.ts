/**
 * Uji perbaikan: foto BARU harus langsung terlihat, termasuk saat mengganti.
 *
 * Skenario yang sebelumnya GAGAL:
 *   1. Atasan membuka laporan (foto A tampil, browser menyimpan di cache)
 *   2. Atasan mengganti foto jadi B, simpan -> "berhasil"
 *   3. Atasan mencetak laporan -> foto B harus tampil (dulu tetap foto A)
 *
 * Jalankan: pnpm exec tsx scripts/uji-foto-ganti-langsung.ts
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

const NIP_S = 'GANTISPV';
const NIP_P = 'GANTIPET';
const KODE_W = 'GANTI-W1';

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

/** Dua JPEG 1x1 berbeda isinya supaya bisa dibedakan. */
function jpeg(warna: number): string {
  const { execSync } = require('node:child_process') as typeof import('node:child_process');
  const keluar = execSync(
    `~/venvs/dev/bin/python -c "
import pymupdf, base64
pix = pymupdf.Pixmap(pymupdf.csRGB, pymupdf.IRect(0, 0, 60, 80))
pix.clear_with(${warna})
for y in range(0, 80, 4):
    for x in range(0, 60, 4):
        pix.set_pixel(x, y, (0, 0, 0))
d = pix.tobytes('jpeg', jpg_quality=90)
print('data:image/jpeg;base64,' + base64.b64encode(d).decode())
"`,
    { encoding: 'utf8', shell: '/bin/bash', timeout: 120000 }
  ).trim();
  return keluar;
}

async function main() {
  console.log(`=== UJI FOTO BARU LANGSUNG TERLIHAT (${BASE}) ===\n`);
  await bersih();

  const cabang = await prisma.cabang.findFirst({ where: { aktif: true } });
  const hash = await bcrypt.hash('Ganti1uji', 10);
  const spv = await prisma.pegawai.create({
    data: { nip: NIP_S, nama: 'SPV Ganti', passwordHash: hash, role: 'SUPERVISOR',
      harusGantiPassword: false, aktif: true, cabangId: cabang!.id },
  });
  const pet = await prisma.pegawai.create({
    data: { nip: NIP_P, nama: 'Petugas Ganti', passwordHash: hash, role: 'PEGAWAI',
      harusGantiPassword: false, aktif: true, cabangId: cabang!.id, atasanId: spv.id },
  });
  const per = await prisma.periode.create({
    data: { kode: KODE_W, nama: 'Uji Ganti', tanggalMulai: new Date(2051, 0, 1),
      tanggalSelesai: new Date(2051, 0, 7), aktif: true },
  });

  const fotoA = jpeg(40);   // gelap
  const fotoB = jpeg(230);  // terang
  cek(fotoA !== fotoB, 'dua foto uji berbeda isinya');

  const pen = await prisma.penilaian.create({
    data: {
      pegawaiId: pet.id, penilaiId: spv.id, periodeId: per.id, status: 'DRAFT',
      nilaiAkhir: 3.5, rating: 'Cukup',
      fotoData: fotoA, fotoMime: 'image/jpeg', fotoUkuran: 400,
      fotoDiperbarui: new Date(),
      detail: { create: [{ kodeAspek: 'A1', nilaiMentah: 90, skor: 3, bobotAspek: 0.4 }] },
    },
  });
  const token = crypto.randomBytes(32).toString('base64url');
  await prisma.sesi.create({
    data: { tokenHash: h(token), pegawaiId: spv.id, expiresAt: new Date(Date.now() + 900000) },
  });
  const cookie = `sip_sesi=${token}`;

  // ===== 1. status DRAFT -> header no-cache =====
  console.log('--- 1. penilaian DRAFT tidak boleh di-cache lama ---');
  const ambilA = await fetch(`${BASE}${jalanFoto(pen.id, pen.fotoDiperbarui!)}`, {
    headers: { cookie },
  });
  const ccA = ambilA.headers.get('cache-control') ?? '';
  cek(ccA.includes('no-cache'), `DRAFT -> Cache-Control "${ccA}"`);
  cek(!ccA.includes('max-age='), 'DRAFT tidak punya max-age (selalu diambil ulang)');
  const byteA = Buffer.from(await ambilA.arrayBuffer()).length;

  // ===== 2. buka laporan A, lalu ganti foto -> laporan harus tampil B =====
  console.log('\n--- 2. browser: lihat foto A, ganti jadi B, cetak ulang ---');
  const port = await cariPortBebas();
  const chrome = spawn('google-chrome', [
    '--headless=new', '--disable-gpu', '--no-sandbox',
    `--remote-debugging-port=${port}`,
    `--user-data-dir=/tmp/chrome-ganti-${Date.now()}`, 'about:blank',
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

  // Selector harus tepat: .sip-foto hanya membungkus FOTO PETUGAS.
  // Sebelumnya selector umum (.sip-laporan img) mengambil logo BTN, sehingga
  // hasil ukurannya menyesatkan.
  const ambilSrc = `(() => {
    const img = document.querySelector('.sip-foto img');
    return img ? img.currentSrc : '(tidak ada foto)';
  })()`;

  // langkah 1: buka laporan -> foto A (browser menyimpannya di cache)
  await c.kirim('Page.navigate', { url: `${BASE}/laporan/${pen.id}` });
  await new Promise((r) => setTimeout(r, 2500));
  const src1 = (await c.kirim('Runtime.evaluate', {
    expression: ambilSrc, returnByValue: true,
  })).result.value;
  console.log(`   alamat foto di laporan: ${String(src1).split('/').pop()}`);

  // langkah 2: atasan MENGGANTI foto (di sisi server, seperti menyimpan foto baru)
  const waktuBaru = new Date();
  await prisma.penilaian.update({
    where: { id: pen.id },
    data: { fotoData: fotoB, fotoUkuran: 500, fotoDiperbarui: waktuBaru },
  });

  // langkah 3: buka laporan lagi (mencetak) -> HARUS foto B
  await c.kirim('Page.navigate', { url: `${BASE}/laporan/${pen.id}` });
  await new Promise((r) => setTimeout(r, 2500));
  const src2 = (await c.kirim('Runtime.evaluate', {
    expression: ambilSrc, returnByValue: true,
  })).result.value;

  cek(src1 !== src2, 'alamat foto BERUBAH setelah foto diganti');
  console.log(`   alamat baru: ${String(src2).split('/').pop()}`);

  const byteB = await fetch(`${BASE}${String(src2).replace(BASE, '')}`, {
    headers: { cookie },
  }).then((r) => r.arrayBuffer()).then((b) => b.byteLength);
  console.log(`   isi: foto A ${byteA} byte -> foto B ${byteB} byte`);
  cek(byteB !== byteA, `isi berkas benar-benar berbeda (${byteA} -> ${byteB} byte)`);

  // pastikan yang tampil di browser memang foto B, bukan cache foto A
  // Ambil panjang byte isi foto yang BENAR-BENAR dimuat browser.
  // currentSrc sifatnya absolut, jadi dibandingkan lewat pathname+search saja
  // supaya tidak salah menghitung URL.
  const cekByte = `(async () => {
    const img = document.querySelector('.sip-foto img');
    if (!img) return -1;
    if (!img.complete) await new Promise(r => { img.onload = r; img.onerror = r; });
    const res = await fetch(img.currentSrc, { cache: 'force-cache' });
    const buf = await res.arrayBuffer();
    return buf.byteLength;
  })()`;
  const byteBrowser = (await c.kirim('Runtime.evaluate', {
    expression: cekByte, awaitPromise: true, returnByValue: true,
  })).result.value;
  cek(
    byteBrowser === byteB,
    `browser benar-benar memuat foto B (${byteBrowser} byte), bukan cache foto A`
  );

  c.tutup();
  chrome.kill();

  // ===== 3. setelah DIKIRIM -> boleh di-cache lama =====
  console.log('\n--- 3. setelah dikirim, foto boleh di-cache lama ---');
  await prisma.penilaian.update({ where: { id: pen.id }, data: { status: 'DIKIRIM' } });
  const ambilFinal = await fetch(`${BASE}${jalanFoto(pen.id, waktuBaru)}`, {
    headers: { cookie },
  });
  const ccFinal = ambilFinal.headers.get('cache-control') ?? '';
  cek(ccFinal.includes('max-age='), `DIKIRIM -> Cache-Control "${ccFinal}"`);
  console.log('   (foto final tidak bisa diubah lagi, jadi aman di-cache lama)');

  await bersih();
  console.log(`\n=== HASIL: ${lulus} lulus, ${gagal} gagal ===`);
  if (gagal > 0) process.exit(1);
  console.log('✅ FOTO BARU LANGSUNG TERLIHAT.');
}

function jalanFoto(id: string, waktu: Date) {
  return `/foto/penilaian/${id}?v=${waktu.getTime().toString(36)}`;
}

main()
  .catch((e) => { console.error('GAGAL:', e.message); process.exit(1); })
  .finally(() => prisma.$disconnect());
