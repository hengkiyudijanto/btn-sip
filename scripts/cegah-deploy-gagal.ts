/**
 * Gerbang WAJIB sebelum `git push`: menjalankan PERSIS perintah build Vercel
 * (pnpm run build) di server ini, tanpa satu pun variabel database.
 *
 * Kenapa ada:
 * Paket Vercel Hobby hanya memberi jatah **100 deployment per hari** — dan setiap
 * push ke `main` memakai satu jatah, termasuk push yang buildnya gagal karena satu
 * salah ketik. Kalau jatah itu habis (atau akun menyentuh batas platform), webhook
 * Git berhenti membuat deployment: situs tetap dilayani versi lama, commit terbaru
 * tidak muncul di daftar Deployments, dan rute baru balas 404 — gejalanya menipu
 * dan mudah disalahartikan sebagai "webhook Git putus" atau "fitur belum dikerjakan".
 * Satu build lokal 40–80 detik jauh lebih murah daripada satu deployment terbuang.
 *
 * Aturan yang dikunci skrip ini:
 * 1. Build harus LULUS dan harus TIDAK BUTUH DATABASE. Vercel tidak menyuntik
 *    DATABASE_URL ke proses build; kalau build di sini hanya lolos karena
 *    .env.local ada, hasilnya bukan bukti apa pun — karena itu env database
 *    DIBUANG dari lingkungan anak proses, bukan sekadar tidak dipakai.
 * 2. Migrasi TIDAK BOLEH ada di dalam build (lihat scripts/migrasi.ts).
 * 3. File kerja lokal tidak boleh ikut ter-commit.
 *
 * Pemakaian:
 *   pnpm pra-push              # cek lengkap (build + tsc + test + migrasi + git)
 *   pnpm pra-push --cepat      # lompati build & test (hanya cek migrasi + git)
 *   pnpm pra-push --tanpa-test # build + tsc, tanpa unit test
 *   pnpm pra-push --siap-push  # cek lengkap lalu `git push` kalau lolos
 */
import { execFileSync, execSync } from 'node:child_process';
import { existsSync } from 'node:fs';

type Args = {
  cepat: boolean;
  tanpaTest: boolean;
  siapPush: boolean;
  remotes: string[];
};

const arg = process.argv.slice(2);
const opsi: Args = {
  cepat: arg.includes('--cepat'),
  tanpaTest: arg.includes('--tanpa-test'),
  siapPush: arg.includes('--siap-push'),
  remotes: arg.filter((a) => a.startsWith('--remote=')).map((a) => a.split('=')[1]),
};

const AKAR = process.cwd();
const ENV_DB = ['DATABASE_URL', 'DATABASE_URL_UNPOOLED', 'DIRECT_URL', 'POSTGRES_URL', 'POSTGRES_PRISMA_URL'];

const garis = (t: string) => console.log(`\n${'─'.repeat(4)} ${t} ${'─'.repeat(Math.max(0, 56 - t.length))}`);
const lulus: string[] = [];
const gagal: string[] = [];

function jalankan(nama: string, perintah: string, args: string[], envBersih = false) {
  garis(nama);
  const env: NodeJS.ProcessEnv = { ...process.env };
  if (envBersih) {
    for (const kunci of ENV_DB) delete env[kunci];
    env.PRA_PUSH_TANPA_DB = '1';
  }
  const mulai = Date.now();
  try {
    execFileSync(perintah, args, { stdio: 'inherit', env, cwd: AKAR });
    const detik = ((Date.now() - mulai) / 1000).toFixed(1);
    console.log(`✅ ${nama} — ${detik} detik`);
    lulus.push(nama);
    return true;
  } catch {
    const detik = ((Date.now() - mulai) / 1000).toFixed(1);
    console.error(`\n❌ ${nama} GAGAL setelah ${detik} detik. Push dibatalkan supaya jatah deploy tidak terbuang.`);
    gagal.push(nama);
    return false;
  }
}

function periksa(judul: string, fn: () => string) {
  garis(judul);
  try {
    const pesan = fn();
    console.log(`✅ ${pesan}`);
    lulus.push(judul);
    return true;
  } catch (e) {
    console.error(`\n❌ ${judul} GAGAL: ${(e as Error).message}`);
    gagal.push(judul);
    return false;
  }
}

console.log('GERBANG PRA-PUSH — memastikan build lokal lolos SEBELUM memakai jatah deploy Vercel');
console.log(`Folder: ${AKAR}`);
if (opsi.cepat) console.log('Mode --cepat: build & unit test dilewati (untuk commit dokumentasi kecil).');

// --- 1. Migrasi tidak boleh ikut di dalam build -----------------------------
periksa('Migrasi tidak ada di dalam build', () => {
  const { readFileSync } = require('node:fs') as typeof import('node:fs');
  const pkg = JSON.parse(readFileSync(`${AKAR}/package.json`, 'utf8'));
  const skripBuild: string = pkg.scripts?.build ?? '';
  if (/migrate/i.test(skripBuild)) {
    throw new Error(`\`build\` memuat "migrate": "${skripBuild}" — ini yang pernah menggagalkan deploy (P1002).`);
  }
  if (!/prisma generate/.test(skripBuild)) {
    throw new Error(`\`build\` belum memuat "prisma generate": "${skripBuild}"`);
  }
  const instal: string = pkg.scripts?.postinstall ?? '';
  if (!/prisma generate/.test(instal)) {
    throw new Error(`\`postinstall\` belum memuat "prisma generate": "${instal}"`);
  }
  return `build = "${skripBuild}", postinstall = "${instal}"`;
});

// --- 2. Build lokal PERSIS seperti Vercel, tanpa database -------------------
if (!opsi.cepat) {
  garis('Variabel database yang dibuang dari proses build');
  console.log(`   ${ENV_DB.join(', ')}  ← sengaja TIDAK diteruskan (Vercel juga tidak menyuntiknya)`);
  const build = jalankan('Build lokal tanpa database (seperti Vercel)', 'pnpm', ['run', 'build'], true);
  if (build) {
    periksa('Rute hasil build memuat halaman inti', () => {
      const { readFileSync } = require('node:fs') as typeof import('node:fs');
      const berkas = `${AKAR}/.next/server/app-paths-manifest.json`;
      if (!existsSync(berkas)) throw new Error('.next/server/app-paths-manifest.json tidak ada — build tidak lengkap.');
      const manifes: Record<string, string> = JSON.parse(readFileSync(berkas, 'utf8'));
      const wajib = ['/masuk', '/dasbor', '/penilaian', '/laporan', '/pegawai'];
      const hilang = wajib.filter((r) => !(`/${r.replace(/^\//, '')}` in manifes || `/${r.replace(/^\//, '')}/page` in manifes));
      if (hilang.length) throw new Error(`rute hilang dari hasil build: ${hilang.join(', ')}`);
      return `${Object.keys(manifes).length} rute terdaftar, semua rute inti ada`;
    });
  }
  jalankan('Typecheck (tsc --noEmit)', 'pnpm', ['exec', 'tsc', '--noEmit']);
  if (!opsi.tanpaTest) jalankan('Unit test (vitest)', 'pnpm', ['test']);
}

// --- 3. Git: berkas kerja tidak boleh ikut --------------------------------
periksa('Tidak ada berkas kerja/rahasia ter-commit', () => {
  const berbahaya = /(^|\/)(\.env|\.neon|backups\/)|^(cek-|preview-|laporan-(lengkap|lite)\.(pdf|png))|\.tsbuildinfo$|^node_modules\//;
  const daftar = execSync('git diff --cached --name-only', { cwd: AKAR, encoding: 'utf8' })
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);
  const pelanggar = daftar.filter((f) => berbahaya.test(f));
  if (pelanggar.length) throw new Error(`staged tapi tidak boleh masuk repo: ${pelanggar.join(', ')}`);
  return `${daftar.length} berkas ter-stage, tidak ada berkas kerja/rahasia`;
});

periksa('Tidak ada perubahan yang belum di-commit', () => {
  // Dibandingkan dengan commit terakhir, BUKAN dengan index: berkas yang sudah
  // di-`git add` tapi belum di-commit tetap harus dianggap kotor.
  const kotor = execSync('git status --porcelain', { cwd: AKAR, encoding: 'utf8' })
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);
  const belumDilacak = kotor.filter((b) => /^\?\?/.test(b));
  const perubahan = kotor.filter((b) => !/^\?\?/.test(b));
  if (perubahan.length) {
    throw new Error(`perubahan belum di-commit:\n   ${perubahan.join('\n   ')}`);
  }
  if (belumDilacak.length) {
    console.log(`   catatan: ${belumDilacak.length} berkas belum dilacak (diabaikan): ${belumDilacak.map((s) => s.slice(3)).join(', ')}`);
  }
  const kepala = execSync('git log --oneline -1', { cwd: AKAR, encoding: 'utf8' }).trim();
  const remote = execSync('git rev-parse HEAD', { cwd: AKAR, encoding: 'utf8' }).trim();
  console.log(`   commit lokal: ${kepala}`);
  console.log(`   ${remote.slice(0, 7)} (yang akan didorong)`);
  return 'semua perubahan sudah ter-commit';
});

// --- 4. Rangkuman ----------------------------------------------------------
garis('HASIL');
for (const n of lulus) console.log(`  ✅ ${n}`);
for (const n of gagal) console.log(`  ❌ ${n}`);

if (gagal.length) {
  console.error(`\n❌ ${gagal.length} pemeriksaan gagal — JANGAN push dulu.`);
  console.error('   Perbaiki dulu di lokal: satu build gagal di Vercel memakai satu jatah deploy harian.');
  process.exit(1);
}

console.log('\n✅ Semua pemeriksaan lulus. Aman untuk push.');

if (opsi.siapPush) {
  const remotes = opsi.remotes.length ? opsi.remotes : ['origin'];
  for (const remote of remotes) {
    garis(`git push ${remote} main`);
    try {
      execFileSync('git', ['push', remote, 'main'], { stdio: 'inherit', cwd: AKAR });
      console.log(`✅ terkirim ke ${remote}`);
    } catch {
      console.error(`❌ push ke ${remote} gagal.`);
      process.exit(1);
    }
  }
  console.log('\nSetelah ini: pantau status deployment lewat GitHub API (biasanya 30–90 detik).');
}
