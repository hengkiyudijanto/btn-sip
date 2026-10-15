/**
 * Cetak halaman ranking 1-halaman jadi PDF, lalu laporkan jumlah halamannya.
 *
 * Ini pembuktian terakhir: halaman yang mengaku "1 halaman" harus benar-benar
 * menghasilkan PDF SATU halaman. Diukur dengan printToPDF + hitungan halaman.
 *
 * Pakai:
 *   BASE_URL=http://localhost:3000 pnpm exec tsx scripts/cetak-ranking-satu-pdf.ts <token> <periodeId>
 */
import 'dotenv/config';
import net from 'node:net';
import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';

const BASE = process.env.BASE_URL ?? 'http://localhost:3000';
const [token, periodeId] = process.argv.slice(2);

function portBebas(): Promise<number> {
  return new Promise((res) => {
    const s = net.createServer();
    s.listen(0, '127.0.0.1', () => {
      const p = (s.address() as net.AddressInfo).port;
      s.close(() => res(p));
    });
  });
}

async function main() {
  const port = await portBebas();
  const chrome = spawn(
    process.env.CHROME_BIN ?? '/usr/bin/google-chrome',
    [
      '--headless=new',
      `--remote-debugging-port=${port}`,
      `--user-data-dir=/tmp/chrome-cetak-${Date.now()}`,
      '--no-first-run', '--no-default-browser-check', '--disable-gpu',
    ],
    { stdio: 'ignore' }
  );

  for (let i = 0; i < 40; i++) {
    try { await fetch(`http://127.0.0.1:${port}/json/version`); break; }
    catch { await new Promise((r) => setTimeout(r, 300)); }
  }

  const tab = await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: 'PUT' })
    .then((r) => r.json() as Promise<{ webSocketDebuggerUrl: string }>);

  const { WebSocket } = await import('ws');
  const ws = new WebSocket(tab.webSocketDebuggerUrl);
  await new Promise<void>((res, rej) => { ws.once('open', () => res()); ws.once('error', rej); });

  let id = 0;
  const tunggu = new Map<number, (v: Record<string, unknown>) => void>();
  ws.on('message', (d: Buffer) => {
    const m = JSON.parse(d.toString());
    if (m.id && tunggu.has(m.id)) { tunggu.get(m.id)!(m.result); tunggu.delete(m.id); }
  });
  const kirim = (method: string, params: Record<string, unknown> = {}) =>
    new Promise<Record<string, unknown>>((res) => {
      const n = ++id; tunggu.set(n, res); ws.send(JSON.stringify({ id: n, method, params }));
    });

  await kirim('Page.enable');
  await kirim('Network.enable');
  await kirim('Network.setCookie', {
    name: 'sip_sesi', value: token, domain: new URL(BASE).hostname, path: '/', secure: false,
  });

  // cetak=1 -> tanpa bilah tombol, hasilnya bersih seperti lembar resmi
  const url = `${BASE}/laporan/ranking/satu?periode=${periodeId}&cetak=1`;
  await kirim('Page.navigate', { url });
  await new Promise((r) => setTimeout(r, 3500));

  const nama = await kirim('Runtime.evaluate', {
    expression: 'document.title',
    returnByValue: true,
  });
  console.log('judul halaman:', (nama as { result?: { value?: string } }).result?.value);

  // pastikan semua gambar (foto) selesai dimuat supaya tidak ada kotak kosong
  const belumSelesai = await kirim('Runtime.evaluate', {
    expression: `(async () => {
      const imgs = [...document.images];
      await Promise.all(imgs.map(i => i.complete ? null : new Promise(r => { i.onload = i.onerror = r; })));
      return imgs.filter(i => !i.complete || i.naturalWidth === 0).length;
    })()`,
    awaitPromise: true, returnByValue: true,
  });
  console.log('gambar gagal dimuat (harus 0):',
    (belumSelesai as { result?: { value?: number } }).result?.value);

  const pdf = (await kirim('Page.printToPDF', {
    printBackground: true,
    marginTop: 0, marginBottom: 0, marginLeft: 0, marginRight: 0,
    paperWidth: 8.27,     // A4 dalam inci
    paperHeight: 11.69,
    preferCSSPageSize: true,
  })) as { data: string };

  const keluar = '/home/ubuntu/projects/btn-sip/ranking-satu-uji.pdf';
  writeFileSync(keluar, Buffer.from(pdf.data, 'base64'));
  console.log('tersimpan:', keluar);

  ws.close();
  chrome.kill();
  await new Promise((r) => setTimeout(r, 500));
  console.log(JSON.stringify({ pdf: keluar }));
}

main().catch((e) => { console.error('GAGAL:', e.message); process.exit(1); });
