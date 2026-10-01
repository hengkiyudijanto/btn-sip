/// <reference types="node" />
/**
 * Ukur ukuran elemen kotak foto langsung di browser (bukan dari PDF).
 *
 * PDF merekam ukuran gambar apa adanya, sehingga gambar uji kecil tidak
 * bisa dipakai memvalidasi proporsi. getBoundingClientRect() memberi
 * ukuran kotak yang benar-benar dihitung browser.
 *
 * Jalankan: pnpm exec tsx scripts/ukur-elemen-browser.ts
 */
import 'dotenv/config';
import crypto from 'node:crypto';
import net from 'node:net';
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
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
  const hash = await bcrypt.hash('Ukur1234', 10);
  const nipS = 'UKUR001';
  const nipP = 'UKUR002';
  const kodeW = 'UKUR-W1';

  const ids = (await prisma.pegawai.findMany({
    where: { nip: { in: [nipP, nipS] } }, select: { id: true },
  })).map((p) => p.id);
  await prisma.penilaianDetail.deleteMany({ where: { penilaian: { pegawaiId: { in: ids } } } });
  await prisma.penilaian.deleteMany({ where: { pegawaiId: { in: ids } } });
  await prisma.pegawai.deleteMany({ where: { nip: { in: [nipP, nipS] } } });
  await prisma.periode.deleteMany({ where: { kode: kodeW } });

  const spv = await prisma.pegawai.create({
    data: { nip: nipS, nama: 'SPV Ukur', passwordHash: hash, role: 'SUPERVISOR',
      harusGantiPassword: false, aktif: true, cabangId: cabang!.id },
  });
  const pet = await prisma.pegawai.create({
    data: { nip: nipP, nama: 'Petugas Ukur', passwordHash: hash, role: 'PEGAWAI',
      harusGantiPassword: false, aktif: true, cabangId: cabang!.id, atasanId: spv.id },
  });
  const per = await prisma.periode.create({
    data: { kode: kodeW, nama: 'Uji Ukur', tanggalMulai: new Date(2043, 0, 1),
      tanggalSelesai: new Date(2043, 0, 7), aktif: true },
  });

  // pakai foto nyata kalau ada
  let potret = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==';
  try {
    const f = readFileSync('/home/ubuntu/projects/btn-sip/foto-uji-3x4.txt', 'utf8').trim();
    if (f.startsWith('data:image')) potret = f;
  } catch {
    /* pakai bawaan */
  }

  const pen = await prisma.penilaian.create({
    data: {
      pegawaiId: pet.id, penilaiId: spv.id, periodeId: per.id, status: 'FINAL',
      nilaiPenampilan: 3.7, nilaiKemampuan: 3.15, nilaiSikap: 4.0, nilaiAkhir: 3.51,
      rating: 'Kurang', fotoData: potret, fotoMime: 'image/jpeg', fotoUkuran: 160,
      fotoCatatan: 'seragam lengkap',
      detail: { create: [
        { kodeAspek: 'A1', nilaiMentah: 90, skor: 3, bobotAspek: 0.4, catatan: 'Catatan panjang dari atasan untuk menguji lebar kolom, apakah teksnya tetap muat dengan baik dan tidak terpotong.' },
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
    `--user-data-dir=/tmp/chrome-ukur-el-${Date.now()}`, 'about:blank',
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
  const host = new URL(BASE).hostname;
  await c.kirim('Network.setCookie', { name: 'sip_sesi', value: token, domain: host, path: '/' });

  const ukur = async (versi: 'lengkap' | 'lite') => {
    const url = versi === 'lite'
      ? `${BASE}/laporan/${pen.id}?versi=lite`
      : `${BASE}/laporan/${pen.id}`;
    await c.kirim('Page.navigate', { url });
    await new Promise((r) => setTimeout(r, 4000));

    const hasil = await c.kirim('Runtime.evaluate', {
      expression: `(() => {
        const el = document.querySelector('.sip-foto');
        const img = document.querySelector('.sip-foto img');
        const ft = document.querySelector('.sip-foto-keterangan');
        const tabel = document.querySelector('.sip-tabel');
        const ths = tabel ? [...tabel.querySelectorAll('thead th')] : [];
        const r = el ? el.getBoundingClientRect() : null;
        return JSON.stringify({
          foto: r ? { w: +r.width.toFixed(1), h: +r.height.toFixed(1),
                      rasio: +(r.width / r.height).toFixed(3) } : null,
          imgTampil: img ? (() => {
            const b = img.getBoundingClientRect();
            return { w: +b.width.toFixed(1), h: +b.height.toFixed(1),
                     rasio: +(b.width / b.height).toFixed(3),
                     objectFit: getComputedStyle(img).objectFit };
          })() : null,
          keterangan: ft ? ft.getBoundingClientRect().width.toFixed(1) : null,
          kolom: ths.map(t => ({
            judul: t.textContent.trim().replace(/\\s+/g, ' '),
            lebar: +t.getBoundingClientRect().width.toFixed(1),
          })),
        });
      })()`,
      returnByValue: true,
    });
    return JSON.parse(hasil.result.value);
  };

  const lite = await ukur('lite');
  console.log('=== VERSI LITE ===');
  console.log(`  kotak foto : ${lite.foto.w} x ${lite.foto.h} pt  (rasio ${lite.foto.rasio})`);
  console.log(`  gambar di dalam: ${lite.imgTampil.w} x ${lite.imgTampil.h} (${lite.imgTampil.objectFit})`);
  console.log(`  keterangan : ${lite.keterangan} pt`);
  console.log('  lebar kolom:');
  for (const k of lite.kolom) console.log(`    ${k.judul.padEnd(12)} ${k.lebar} pt`);

  const lengkap = await ukur('lengkap');
  console.log('\n=== VERSI LENGKAP ===');
  console.log(`  kotak foto : ${lengkap.foto.w} x ${lengkap.foto.h} pt  (rasio ${lengkap.foto.rasio})`);
  console.log('  lebar kolom:');
  for (const k of lengkap.kolom) console.log(`    ${k.judul.padEnd(12)} ${k.lebar} pt`);

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
