/**
 * Ukur elemen dalam MODE CETAK (media print), bukan layar.
 *
 * Aturan .sip-padat hanya berlaku saat mencetak, jadi pengukuran di layar
 * selalu menunjukkan ukuran versi lengkap. Skrip ini memaksa media print
 * lewat CDP sebelum mengukur.
 *
 * Jalankan: pnpm exec tsx scripts/ukur-mode-cetak.ts
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
  const hash = await bcrypt.hash('Cetakmode1', 10);
  const nipS = 'CETAKM01';
  const nipP = 'CETAKM02';
  const kodeW = 'CETAKM-W1';

  const ids = (await prisma.pegawai.findMany({
    where: { nip: { in: [nipP, nipS] } }, select: { id: true },
  })).map((p) => p.id);
  await prisma.penilaianDetail.deleteMany({ where: { penilaian: { pegawaiId: { in: ids } } } });
  await prisma.penilaian.deleteMany({ where: { pegawaiId: { in: ids } } });
  await prisma.pegawai.deleteMany({ where: { nip: { in: [nipP, nipS] } } });
  await prisma.periode.deleteMany({ where: { kode: kodeW } });

  const spv = await prisma.pegawai.create({
    data: { nip: nipS, nama: 'SPV Cetak Mode', passwordHash: hash, role: 'SUPERVISOR',
      harusGantiPassword: false, aktif: true, cabangId: cabang!.id },
  });
  const pet = await prisma.pegawai.create({
    data: { nip: nipP, nama: 'Petugas Cetak', passwordHash: hash, role: 'PEGAWAI',
      harusGantiPassword: false, aktif: true, cabangId: cabang!.id, atasanId: spv.id },
  });
  const per = await prisma.periode.create({
    data: { kode: kodeW, nama: 'Uji Cetak Mode', tanggalMulai: new Date(2045, 0, 1),
      tanggalSelesai: new Date(2045, 0, 7), aktif: true },
  });
  const pen = await prisma.penilaian.create({
    data: {
      pegawaiId: pet.id, penilaiId: spv.id, periodeId: per.id, status: 'FINAL',
      nilaiAkhir: 3.5, rating: 'Cukup', fotoData:
        'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==',
      fotoMime: 'image/jpeg', fotoUkuran: 160,
      detail: { create: [
        { kodeAspek: 'A1', nilaiMentah: 90, skor: 3, bobotAspek: 0.4,
          catatan: 'Catatan panjang dari atasan untuk menguji apakah kolom Catatan yang diperbesar benar-benar menampung teks panjang dengan baik.' },
      ] },
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
    `--user-data-dir=/tmp/chrome-cetakmode-${Date.now()}`, 'about:blank',
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
  // PAKSA media print setiap kali sebelum mengukur
  await c.kirim('Emulation.setEmulatedMedia', { media: 'print' });

  for (const versi of ['lengkap', 'lite'] as const) {
    const url = versi === 'lite'
      ? `${BASE}/laporan/${pen.id}?versi=lite`
      : `${BASE}/laporan/${pen.id}`;
    await c.kirim('Page.navigate', { url });
    await new Promise((r) => setTimeout(r, 3500));
    // setEmulatedMedia harus dipanggil SETELAH navigasi selesai,
    // kalau tidak efeknya hilang saat halaman dimuat ulang.
    await c.kirim('Emulation.setEmulatedMedia', { media: 'print' });
    await new Promise((r) => setTimeout(r, 500));

    // pastikan media benar-benar print sebelum mengukur
    const mediaCek = await c.kirim('Runtime.evaluate', {
      expression: 'window.matchMedia("print").matches',
      returnByValue: true,
    });
    if (mediaCek.result?.value !== true) {
      await c.kirim('Emulation.setEmulatedMedia', { media: 'print' });
      await new Promise((r) => setTimeout(r, 500));
    }

    const hasil = await c.kirim('Runtime.evaluate', {
      expression: `(() => {
        const foto = document.querySelector('.sip-foto');
        const r = foto ? foto.getBoundingClientRect() : null;
        const tabel = document.querySelector('.sip-tabel');
        const ths = tabel ? [...tabel.querySelectorAll('thead th')] : [];
        const root = document.querySelector('.sip-laporan');
        return JSON.stringify({
          padat: root ? root.classList.contains('sip-padat') : false,
          foto: r ? { w: +r.width.toFixed(1), h: +r.height.toFixed(1),
                      rasio: +(r.width / r.height).toFixed(3) } : null,
          kolom: ths.map(t => t.textContent.trim().replace(/\\s+/g,' ') + '=' +
                                (+t.getBoundingClientRect().width.toFixed(1))),
        });
      })()`,
      returnByValue: true,
    });
    const d = JSON.parse(hasil.result.value);
    console.log(`=== ${versi.toUpperCase()} (media cetak) ===`);
    console.log(`  kelas padat: ${d.padat}`);
    console.log(`  kotak foto : ${d.foto.w} x ${d.foto.h} pt  rasio ${d.foto.rasio}`);
    console.log(`  kolom      : ${d.kolom.join('  ')}`);
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
