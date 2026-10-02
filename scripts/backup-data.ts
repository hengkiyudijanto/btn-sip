/**
 * Backup data mentah SIP — seluruh isi tabel, bukan ringkasan laporan.
 *
 * Beda dengan `/laporan/ekspor` (yang menghasilkan rekap peringkat untuk
 * dibaca manusia), skrip ini menyalin **apa adanya** dari database: setiap
 * kolom, termasuk id internal, hash password, foto (data URL), dan audit log.
 * Gunanya untuk arsip/serah terima — kalau suatu saat aplikasi ini diganti,
 * data mentah inilah yang memungkinkan pemulihan.
 *
 * Bentuk berkas (per jalan):
 *   backups/sip-YYYY-MM-DD/
 *     000-info.txt      ringkasan: jumlah baris, ukuran, waktu, tujuan database
 *     010-<tabel>.json  satu berkas per tabel, JSON array
 *     _manifest.json    daftar berkas + sha256 + jumlah baris masing-masing
 *
 * Kenapa satu berkas per tabel: foto bersifat data URL di kolom `fotoData`,
 * dan satu baris bisa puluhan KB — memecah per tabel membuat berkas raksasa
 * mudah ditelusuri, dan yang gagal cuma satu berkas.
 *
 * PENTING: berkas hasil memuat data pribadi pegawai dan hash password.
 * Jangan pernah masuk repo (lihat .gitignore) dan jangan dikirim ke chat.
 *
 * Jalankan:
 *   pnpm exec tsx scripts/backup-data.ts
 *   pnpm exec tsx scripts/backup-data.ts --keluar /path/lain
 *   pnpm exec tsx scripts/backup-data.ts --tanpa-foto   # buang kolom foto (kecil)
 */
import 'dotenv/config';
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

/** Tabel yang disalin, urut supaya berkas mudah dibandingkan antar tanggal. */
const TABEL = [
  'Cabang',
  'Jabatan',
  'Pegawai',
  'Periode',
  'Pengaturan',
  'Penilaian',
  'PenilaianDetail',
  'PengajuanPegawai',
  'AuditLog',
  'Sesi',
] as const;

/** Kolom foto: data URL base64. Dibuang kalau `--tanpa-foto`. */
const KOLOM_FOTO = ['fotoData'];

function arg(nama: string): string | undefined {
  const i = process.argv.indexOf(nama);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

function namaBerkasTabel(nomor: number, tabel: string): string {
  const urut = String((nomor + 1) * 10).padStart(3, '0');
  return `${urut}-${tabel}.json`;
}

async function main() {
  const tanpaFoto = process.argv.includes('--tanpa-foto');
  const tanggal = new Date();
  const capWaktu = tanggal.toISOString().slice(0, 19).replace('T', ' ');

  const akar =
    arg('--keluar') ??
    join(process.cwd(), 'backups', `sip-${tanggal.toISOString().slice(0, 10)}`);
  mkdirSync(akar, { recursive: true });

  const host = (process.env.DATABASE_URL ?? '').split('@')[1]?.split('/')[0] ?? '(tidak diketahui)';

  console.log(`Database : ${host}`);
  console.log(`Tujuan   : ${akar}`);
  console.log(`Mulai    : ${capWaktu}`);
  console.log(`Foto     : ${tanpaFoto ? 'DIBUANG (--tanpa-foto)' : 'disertakan'}`);
  console.log('');

  const manifest: {
    tabel: string;
    berkas: string;
    baris: number;
    byte: number;
    sha256: string;
  }[] = [];

  for (let i = 0; i < TABEL.length; i++) {
    const tabel = TABEL[i];
    // Nama model di Prisma sama dengan nama tabel di sini (tanpa @@map),
    // kecuali `Pengaturan` yang di-map ke "pengaturan".
    // $queryRaw dipakai supaya SEMUA kolom ikut apa adanya, tanpa select manual
    // yang bisa ketinggalan kolom saat skema berubah.
    const namaTabelDb = tabel === 'Pengaturan' ? 'pengaturan' : tabel;
    let baris: Record<string, unknown>[] = await prisma.$queryRawUnsafe(
      `SELECT * FROM "${namaTabelDb}"`
    );

    if (tanpaFoto && KOLOM_FOTO.length) {
      baris = baris.map((b) => {
        const salin = { ...b };
        for (const k of KOLOM_FOTO) if (k in salin) salin[k] = null;
        return salin;
      });
    }

    const isi = JSON.stringify(baris, null, 1);
    const berkas = namaBerkasTabel(i, tabel);
    const jalur = join(akar, berkas);
    writeFileSync(jalur, isi, 'utf8');

    const byte = statSync(jalur).size;
    const sha256 = createHash('sha256').update(isi).digest('hex');
    manifest.push({ tabel, berkas, baris: baris.length, byte, sha256 });

    const kb = (byte / 1024).toFixed(0);
    console.log(`  ${berkas.padEnd(26)} ${String(baris.length).padStart(6)} baris  ${kb.padStart(6)} KB`);
  }

  const totalByte = manifest.reduce((n, m) => n + m.byte, 0);
  const totalBaris = manifest.reduce((n, m) => n + m.baris, 0);

  const info = [
    'BACKUP DATA MENTAH — SIP Penilaian Petugas Frontliner',
    '='.repeat(58),
    `Waktu backup   : ${capWaktu}`,
    `Database       : ${host}`,
    `Tabel          : ${TABEL.length}`,
    `Total baris    : ${totalBaris}`,
    `Total ukuran   : ${(totalByte / 1024).toFixed(0)} KB`,
    `Foto disertakan: ${tanpaFoto ? 'tidak' : 'ya'}`,
    '',
    'PERHATIAN: berkas di folder ini memuat data pribadi pegawai',
    '(nama, NIP, foto) dan hash password. Jangan di-commit ke repo,',
    'jangan dikirim lewat chat, dan simpan di tempat yang terkendali.',
    '',
    'Cara memulihkan satu tabel: berkas JSON tiap tabel bisa dibaca',
    'langsung; kolom "createdAt"/"updatedAt" berbentuk teks ISO 8601.',
    '',
  ].join('\n');
  writeFileSync(join(akar, '000-info.txt'), info, 'utf8');

  writeFileSync(
    join(akar, '_manifest.json'),
    JSON.stringify(
      { dibuat: capWaktu, database: host, tanpaFoto, totalBaris, totalByte, berkas: manifest },
      null,
      1
    ),
    'utf8'
  );

  console.log('');
  console.log(`Total: ${totalBaris} baris, ${(totalByte / 1024).toFixed(0)} KB dalam ${TABEL.length} berkas`);
  console.log(`Info : ${join(akar, '000-info.txt')}`);

  // Jangan cetak isi data apa pun ke stdout: keluaran skrip ini bisa ikut
  // terkirim ke chat oleh penjadwal.
}

main()
  .catch((e) => {
    console.error('GAGAL:', e instanceof Error ? e.message : e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
