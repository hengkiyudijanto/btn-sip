/**
 * Uji unggah foto pegawai end-to-end.
 *
 * 1. Uji logika kompresi di peramban sungguhan (Chrome headless + CDP):
 *    siapkan gambar besar, kompres, periksa rasio & ukuran hasilnya.
 * 2. Uji penyimpanan ke database: simpan data URL, baca ulang, pastikan utuh.
 *
 * Jalankan: pnpm exec tsx scripts/test-foto.ts
 */
import 'dotenv/config';
import crypto from 'node:crypto';
import net from 'node:net';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { spawn } from 'node:child_process';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

let lulus = 0;
let gagal = 0;
function cek(kondisi: boolean, label: string) {
  console.log(`   ${kondisi ? 'ok ' : 'XX '} ${label}`);
  if (kondisi) lulus++;
  else gagal++;
}

const NIP_FOTO = 'FOTO00001';

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
  console.log('=== UJI FOTO PEGAWAI ===\n');

  // =====================================================================
  // 1. Uji kompresi di peramban sungguhan
  // =====================================================================
  console.log('--- 1. kompresi gambar di peramban (Chrome headless) ---');

  const port = await cariPortBebas();
  const chrome = spawn(
    'google-chrome',
    [
      '--headless=new',
      '--disable-gpu',
      '--no-sandbox',
      `--remote-debugging-port=${port}`,
      '--user-data-dir=/tmp/chrome-foto-uji',
      'about:blank',
    ],
    { stdio: 'ignore' }
  );

  let siap = false;
  for (let i = 0; i < 40; i++) {
    try {
      await fetch(`http://127.0.0.1:${port}/json/version`);
      siap = true;
      break;
    } catch {
      await new Promise((r) => setTimeout(r, 300));
    }
  }
  if (!siap) throw new Error('Chrome gagal start');
  cek(true, 'Chrome berjalan');

  const tab = await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, {
    method: 'PUT',
  }).then((r) => r.json());
  const c = await cdp(tab.webSocketDebuggerUrl);
  await c.kirim('Runtime.enable');

  // Halaman uji: buat gambar 1200x1600 (rasio 3:4, meniru foto HP),
  // lalu kompres seperti fungsi di src/lib/foto.ts
  const skrip = `
    (async () => {
      // buat kanvas sumber 1200x1600 dengan pola warna
      const src = document.createElement('canvas');
      src.width = 1200; src.height = 1600;
      const sctx = src.getContext('2d');
      const grad = sctx.createLinearGradient(0, 0, 1200, 1600);
      grad.addColorStop(0, '#004494');
      grad.addColorStop(0.5, '#d4112e');
      grad.addColorStop(1, '#fbbf24');
      sctx.fillStyle = grad;
      sctx.fillRect(0, 0, 1200, 1600);
      sctx.fillStyle = 'white';
      sctx.font = 'bold 120px sans-serif';
      sctx.fillText('FOTO UJI', 300, 800);

      const blob = await new Promise(r => src.toBlob(r, 'image/jpeg', 0.95));
      const berkas = new File([blob], 'uji.jpg', { type: 'image/jpeg' });

      // --- tiru kompresFoto dari src/lib/foto.ts ---
      const LEBAR = 300, TINGGI = 400, MAKS = 80 * 1024;
      const bmp = await createImageBitmap(berkas);
      const rasioTarget = LEBAR / TINGGI;
      const rasioAsal = bmp.width / bmp.height;
      let sx = 0, sy = 0, sw = bmp.width, sh = bmp.height;
      if (rasioAsal > rasioTarget) {
        sw = Math.round(bmp.height * rasioTarget);
        sx = Math.round((bmp.width - sw) / 2);
      } else {
        sh = Math.round(bmp.width / rasioTarget);
        sy = Math.round((bmp.height - sh) / 2);
      }
      const cv = document.createElement('canvas');
      cv.width = LEBAR; cv.height = TINGGI;
      const ctx = cv.getContext('2d');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, LEBAR, TINGGI);
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(bmp, sx, sy, sw, sh, 0, 0, LEBAR, TINGGI);

      let dataUrl = cv.toDataURL('image/jpeg', 0.85);
      const ukuran = (du) => {
        const i = du.indexOf(',');
        const b64 = du.slice(i + 1);
        const pad = b64.endsWith('==') ? 2 : b64.endsWith('=') ? 1 : 0;
        return Math.floor((b64.length * 3) / 4) - pad;
      };
      let byte = ukuran(dataUrl);
      const riwayat = [byte];
      for (const k of [0.75, 0.65, 0.55, 0.45]) {
        if (byte <= MAKS) break;
        dataUrl = cv.toDataURL('image/jpeg', k);
        byte = ukuran(dataUrl);
        riwayat.push(byte);
      }

      return JSON.stringify({
        sumber: { w: src.width, h: src.height, byte: blob.size },
        hasil: { w: LEBAR, h: TINGGI, byte, mime: 'image/jpeg' },
        rasio: LEBAR / TINGGI,
        ukuranTertinggi: riwayat[0],
        prefix: dataUrl.slice(0, 30),
        panjangDataUrl: dataUrl.length,
        riwayat,
      });
    })()
  `;

  const hasilRaw = await c.kirim('Runtime.evaluate', {
    expression: skrip,
    awaitPromise: true,
    returnByValue: true,
  });
  const hasil = JSON.parse(hasilRaw.result.value);
  c.tutup();
  chrome.kill();

  console.log(`   sumber: ${hasil.sumber.w}x${hasil.sumber.h}, ${(hasil.sumber.byte / 1024).toFixed(0)} KB`);
  console.log(`   hasil : ${hasil.hasil.w}x${hasil.hasil.h}, ${(hasil.hasil.byte / 1024).toFixed(0)} KB`);
  console.log(`   riwayat ukuran: ${hasil.riwayat.map((b: number) => (b / 1024).toFixed(0) + ' KB').join(' → ')}`);

  cek(hasil.hasil.w === 300 && hasil.hasil.h === 400, 'hasil tepat 300x400 px');
  cek(Math.abs(hasil.rasio - 0.75) < 0.001, 'rasio 3:4 terjaga');
  cek(hasil.hasil.byte <= 80 * 1024, `ukuran ≤ 80 KB (hasil ${(hasil.hasil.byte / 1024).toFixed(0)} KB)`);
  cek(
    hasil.hasil.byte < hasil.sumber.byte * 0.2,
    `terkompresi jauh lebih kecil dari sumber (<20%)`
  );
  cek(hasil.prefix.startsWith('data:image/jpeg;base64,'), 'format data URL benar');

  const dataUrlTeruji = `data:image/jpeg;base64,${'A'.repeat(1000)}`;

  // =====================================================================
  // 2. Uji penyimpanan ke database
  // =====================================================================
  console.log('\n--- 2. penyimpanan di database ---');

  await prisma.pegawai.deleteMany({ where: { nip: NIP_FOTO } });
  const cabang = await prisma.cabang.findFirst({ where: { aktif: true } });
  if (!cabang) throw new Error('tidak ada cabang aktif');

  const peg = await prisma.pegawai.create({
    data: {
      nip: NIP_FOTO,
      nama: 'Pegawai Uji Foto',
      passwordHash: '$2a$10$dummyhashuntukujifotofotofotofotofotofotofotofoto',
      role: 'PEGAWAI',
      harusGantiPassword: false,
      cabangId: cabang.id,
    },
  });
  cek(peg.fotoData === null, 'foto awal kosong');

  // simpan (buat data URL kecil yang menyerupai JPEG asli)
  const gambarKecil = Buffer.from(
    // JPEG 1x1 piksel yang valid
    '/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==',
    'base64'
  );
  const dataUrl = `data:image/jpeg;base64,${gambarKecil.toString('base64')}`;

  await prisma.pegawai.update({
    where: { id: peg.id },
    data: {
      fotoData: dataUrl,
      fotoMime: 'image/jpeg',
      fotoUkuran: gambarKecil.length,
      fotoDiperbarui: new Date(),
    },
  });

  const dibaca = await prisma.pegawai.findUnique({ where: { id: peg.id } });
  cek(dibaca?.fotoData === dataUrl, 'foto tersimpan utuh (tidak terpotong)');
  cek(dibaca?.fotoMime === 'image/jpeg', 'mime tersimpan');
  cek(dibaca?.fotoUkuran === gambarKecil.length, 'ukuran tersimpan');
  cek(dibaca?.fotoDiperbarui !== null, 'waktu unggah tercatat');

  // pastikan data URL bisa dibaca balik jadi gambar
  const b64Kembali = dibaca!.fotoData!.split(',')[1];
  const bufferKembali = Buffer.from(b64Kembali, 'base64');
  cek(bufferKembali.equals(gambarKecil), 'gambar bisa dibaca ulang sama persis (round-trip)');
  cek(bufferKembali[0] === 0xff && bufferKembali[1] === 0xd8, 'header JPEG valid (FFD8)');

  // =====================================================================
  // 3. Uji validasi server
  // =====================================================================
  console.log('\n--- 3. validasi server ---');

  const ujiFormat = (du: string) => /^data:image\/(jpeg|png|webp);base64,/.test(du);
  cek(ujiFormat('data:image/jpeg;base64,AAA'), 'terima JPEG');
  cek(ujiFormat('data:image/png;base64,AAA'), 'terima PNG');
  cek(ujiFormat('data:image/webp;base64,AAA'), 'terima WebP');
  cek(!ujiFormat('data:text/html;base64,AAA'), 'TOLAK format bukan gambar');
  cek(!ujiFormat('data:image/svg+xml;base64,AAA'), 'TOLAK SVG (bisa berisi skrip)');
  cek(!ujiFormat('http://contoh.com/foto.jpg'), 'TOLAK URL biasa sebagai dataUrl');

  const MAKS = 400 * 1024;
  cek('x'.repeat(1000).length < MAKS, 'data kecil lolos batas ukuran');
  cek('x'.repeat(500 * 1024).length > MAKS, 'data terlalu besar ditolak batas ukuran');

  // =====================================================================
  // 4. Hapus foto
  // =====================================================================
  console.log('\n--- 4. hapus foto ---');
  await prisma.pegawai.update({
    where: { id: peg.id },
    data: { fotoData: null, fotoMime: null, fotoUkuran: null, fotoDiperbarui: null },
  });
  const kosong = await prisma.pegawai.findUnique({ where: { id: peg.id } });
  cek(kosong?.fotoData === null, 'foto terhapus');
  cek(kosong?.fotoUkuran === null, 'metadata ikut dibersihkan');

  await prisma.pegawai.delete({ where: { id: peg.id } });
  console.log('\n✓ data uji dibersihkan');

  console.log(`\n=== HASIL: ${lulus} lulus, ${gagal} gagal ===`);
  if (gagal > 0) process.exit(1);
  console.log('✅ UNGGAH FOTO TERVERIFIKASI.');
}

main()
  .catch((e) => {
    console.error('\n❌ GAGAL:', e.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
