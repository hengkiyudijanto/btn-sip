/**
 * Cetak kedua versi laporan ke PDF untuk perbandingan.
 *
 * Jalankan: pnpm exec tsx scripts/cetak-dua-versi.ts
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

async function cetakPdf(url: string, keluar: string, token: string, marginMm: number) {
  const port = await cariPortBebas();
  const chrome = spawn('google-chrome', [
    '--headless=new', '--disable-gpu', '--no-sandbox',
    `--remote-debugging-port=${port}`,
    `--user-data-dir=/tmp/chrome-pdf-${Date.now()}`, 'about:blank',
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
    name: 'sip_sesi', value: token, domain: 'localhost', path: '/',
  });
  await c.kirim('Page.navigate', { url });
  await new Promise((r) => setTimeout(r, 5000));

  // CDP memakai inci
  const margin = marginMm / 25.4;
  const pdf = await c.kirim('Page.printToPDF', {
    printBackground: true,
    paperWidth: 8.27,   // A4
    paperHeight: 11.69,
    marginTop: margin, marginBottom: margin,
    marginLeft: margin, marginRight: margin,
    preferCSSPageSize: false,
  });
  writeFileSync(keluar, Buffer.from(pdf.data, 'base64'));
  console.log(`  → ${keluar} (margin ${marginMm}mm)`);

  c.tutup();
  chrome.kill();
}

async function main() {
  const cabang = await prisma.cabang.findFirst({ where: { aktif: true } });
  const hash = await bcrypt.hash('Cetak1234', 10);
  const nipS = 'CETAK001';
  const nipP = 'CETAK002';
  const kodeW = 'CETAK-W1';

  const ids = (await prisma.pegawai.findMany({
    where: { nip: { in: [nipP, nipS] } }, select: { id: true },
  })).map((p) => p.id);
  await prisma.penilaianDetail.deleteMany({ where: { penilaian: { pegawaiId: { in: ids } } } });
  await prisma.penilaian.deleteMany({ where: { pegawaiId: { in: ids } } });
  await prisma.pegawai.deleteMany({ where: { nip: { in: [nipP, nipS] } } });
  await prisma.periode.deleteMany({ where: { kode: kodeW } });

  const spv = await prisma.pegawai.create({
    data: { nip: nipS, nama: 'Andi Pratama', passwordHash: hash, role: 'SUPERVISOR',
      harusGantiPassword: false, aktif: true, cabangId: cabang!.id },
  });
  const tel = await prisma.jabatan.findFirst({ where: { kode: 'TELLER' } });
  const pet = await prisma.pegawai.create({
    data: { nip: nipP, nama: 'IRWAN ALLO', passwordHash: hash, role: 'PEGAWAI',
      harusGantiPassword: false, aktif: true, cabangId: cabang!.id,
      atasanId: spv.id, jabatanId: tel?.id },
  });
  const per = await prisma.periode.create({
    data: { kode: kodeW, nama: 'Minggu ke-1 Oktober 2026',
      tanggalMulai: new Date(2042, 9, 1), tanggalSelesai: new Date(2042, 9, 7), aktif: true },
  });

  // foto penilaian
  const potret =
    'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==';

  const pen = await prisma.penilaian.create({
    data: {
      pegawaiId: pet.id, penilaiId: spv.id, periodeId: per.id, status: 'FINAL',
      nilaiPenampilan: 3.70, nilaiKemampuan: 3.15, nilaiSikap: 4.0, nilaiAkhir: 3.51,
      rating: 'Kurang',
      catatanUmum:
        'Perlu peningkatan pada pengetahuan produk dan ketelitian. Disarankan mengikuti pendampingan mingguan.',
      fotoData: potret, fotoMime: 'image/jpeg', fotoUkuran: 160,
      fotoCatatan: 'seragam lengkap dengan name tag',
      dikirimAt: new Date(), diketahuiAt: new Date(), finalAt: new Date(),
      detail: {
        create: [
          { kodeAspek: 'A1', nilaiMentah: 90, skor: 3, bobotAspek: 0.4,
            catatan: 'Seragam sudah rapi, namun sepatu perlu dipoles lagi.' },
          { kodeAspek: 'A2', nilaiMentah: 88, skor: 3, bobotAspek: 0.3, catatan: null },
          { kodeAspek: 'A3', nilaiMentah: 85, skor: 3, bobotAspek: 0.2, catatan: null },
          { kodeAspek: 'A4', nilaiMentah: 92, skor: 4, bobotAspek: 0.1, catatan: null },
          { kodeAspek: 'B1', nilaiMentah: 80, skor: 2, bobotAspek: 0.2,
            catatan: 'Hasil kuis masih di bawah standar, perlu belajar ulang.' },
          { kodeAspek: 'B2', nilaiMentah: 82, skor: 3, bobotAspek: 0.25, catatan: null },
          { kodeAspek: 'B3', nilaiMentah: 78, skor: 2, bobotAspek: 0.25,
            catatan: 'Belum menguasai produk prioritas.' },
          { kodeAspek: 'B4', nilaiMentah: 85, skor: 3, bobotAspek: 0.15, catatan: null },
          { kodeAspek: 'B5', nilaiMentah: 84, skor: 3, bobotAspek: 0.15, catatan: null },
          { kodeAspek: 'C1', nilaiMentah: 90, skor: 3, bobotAspek: 0.3, catatan: null },
          { kodeAspek: 'C2', nilaiMentah: 86, skor: 3, bobotAspek: 0.3, catatan: null },
          { kodeAspek: 'C3', nilaiMentah: 88, skor: 3, bobotAspek: 0.2, catatan: null },
          { kodeAspek: 'C4', nilaiMentah: 90, skor: 3, bobotAspek: 0.2, catatan: null },
        ],
      },
    },
  });

  const token = crypto.randomBytes(32).toString('base64url');
  await prisma.sesi.create({
    data: { tokenHash: h(token), pegawaiId: spv.id, expiresAt: new Date(Date.now() + 900000) },
  });

  console.log('Cetak versi LENGKAP (margin 12mm):');
  await cetakPdf(`${BASE}/laporan/${pen.id}`, '/home/ubuntu/projects/btn-sip/laporan-lengkap.pdf', token, 12);

  console.log('Cetak versi LITE (margin 8mm, target 1 halaman):');
  await cetakPdf(`${BASE}/laporan/${pen.id}?versi=lite`, '/home/ubuntu/projects/btn-sip/laporan-lite.pdf', token, 8);

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
