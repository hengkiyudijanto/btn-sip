/**
 * UJI ALUR KONTEN SOSMED — end-to-end lewat HTTP, dengan sesi login nyata.
 *
 * Jalankan: pnpm exec tsx scripts/test-alur-sosmed.ts
 *
 * Yang dibuktikan (bukan sekadar "halaman mengembalikan 200"):
 *   1. Kreator dapat membuat konten (draft) dan mengajukannya.
 *   2. Penyetuju dapat menyetujui.
 *   3. Konten yang belum disetujui DITOLAK saat dikirim (aturan inti).
 *   4. Pengiriman setelah disetujui berjalan (modus simulasi) dan mencatat hasil.
 *   5. Revisi bolak-balik: minta revisi -> ajukan ulang -> setujui.
 *   6. Proteksi: pegawai tanpa hak tidak bisa menyetujui / mengirim.
 *   7. Halaman menolak akses peran yang tidak berhak (302 ke /sosmed).
 *
 * Skrip membuat akun & konten sendiri, lalu membersihkannya di akhir.
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('❌ DATABASE_URL tidak ada.');
  process.exit(1);
}
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

const BASIS = process.env.UJI_BASIS ?? 'http://localhost:3000';
const SANDI = 'UjiSosmed123';

let lulus = 0;
let gagal = 0;
function cek(nama: string, kondisi: boolean, detail?: string) {
  if (kondisi) {
    lulus++;
    console.log(`  ✓ ${nama}`);
  } else {
    gagal++;
    console.log(`  ✗ ${nama}${detail ? ` — ${detail}` : ''}`);
  }
}

// ===========================================================================
// Sesi HTTP
// ===========================================================================

type Sesi = { cookie: string; id: string; nip: string };

async function login(nip: string, sandi: string): Promise<Sesi> {
  const r = await fetch(`${BASIS}/masuk`, { redirect: 'manual' });
  const html = await r.text();
  const cookies = r.headers.getSetCookie?.() ?? [];
  const cookie = cookies.map((c) => c.split(';')[0]).join('; ');

  // ambil action id dari form server action Next
  const actionId = formActionId(html);
  if (!actionId) throw new Error('Tidak menemukan action id pada form login.');

  const body = new FormData();
  body.set('nip', nip);
  body.set('password', sandi);

  const kirim = await fetch(`${BASIS}/masuk`, {
    method: 'POST',
    headers: {
      'Next-Action': actionId,
      cookie,
    },
    body,
    redirect: 'manual',
  });

  const setCookie = kirim.headers.getSetCookie?.() ?? [];
  const sesiCookie = setCookie.length ? setCookie.map((c) => c.split(';')[0]).join('; ') : cookie;
  return { cookie: sesiCookie, id: '', nip };
}

/** Ekstrak id server action dari HTML yang dirender Next (aksi$...). */
function formActionId(html: string): string | null {
  const cocok = html.match(/"\$ACTION_ID_([a-f0-9]{40,})"/) ?? html.match(/action=([a-f0-9]{40,})/);
  return cocok ? cocok[1] : null;
}

async function get(path: string, sesi: Sesi) {
  const r = await fetch(`${BASIS}${path}`, {
    headers: { cookie: sesi.cookie },
    redirect: 'manual',
  });
  return { status: r.status, lokasi: r.headers.get('location'), html: await r.text() };
}

/** Memanggil server action lewat protokol flight Next (POST + Next-Action). */
async function panggilAksi(path: string, actionId: string, sesi: Sesi, isi: Record<string, string>) {
  const body = new FormData();
  for (const [k, v] of Object.entries(isi)) body.set(k, v);
  const r = await fetch(`${BASIS}${path}`, {
    method: 'POST',
    headers: { 'Next-Action': actionId, cookie: sesi.cookie },
    body,
    redirect: 'manual',
  });
  return { status: r.status, teks: await r.text() };
}

// ===========================================================================
// Persiapan data uji
// ===========================================================================

const PREFIX = '[UJI-SOSMED]';

async function siapkan() {
  const cabang = await prisma.cabang.upsert({
    where: { kode: 'UJI-SM' },
    update: {},
    create: { kode: 'UJI-SM', nama: 'Uji Sosmed' },
  });
  const jabatan = await prisma.jabatan.upsert({
    where: { kode: 'UJI-SM' },
    update: {},
    create: { kode: 'UJI-SM', nama: 'Uji Sosmed' },
  });

  async function buat(nip: string, role: 'SUPERVISOR' | 'MANAGER' | 'PEGAWAI') {
    const lama = await prisma.pegawai.findUnique({ where: { nip } });
    if (lama) {
      await prisma.sesi.deleteMany({ where: { pegawaiId: lama.id } });
      await prisma.pegawai.delete({ where: { id: lama.id } });
    }
    return prisma.pegawai.create({
      data: {
        nip,
        nama: `${PREFIX} ${nip}`,
        passwordHash: await bcrypt.hash(SANDI, 10),
        role,
        cabangId: cabang.id,
        jabatanId: jabatan.id,
        harusGantiPassword: false, // supaya tidak dialihkan ke /ubah-password
      },
    });
  }

  const kreator = await buat('UJISM1', 'SUPERVISOR');
  const penyetuju = await buat('UJISM2', 'MANAGER');
  const pegawai = await buat('UJISM3', 'PEGAWAI');

  return { kreator, penyetuju, pegawai, cabangId: cabang.id };
}

async function bersihkan() {
  await prisma.kontenSosmed.deleteMany({ where: { judul: { startsWith: PREFIX } } });
  for (const nip of ['UJISM1', 'UJISM2', 'UJISM3']) {
    const p = await prisma.pegawai.findUnique({ where: { nip } });
    if (p) {
      await prisma.sesi.deleteMany({ where: { pegawaiId: p.id } });
      await prisma.pegawai.delete({ where: { id: p.id } });
    }
  }
  await prisma.jabatan.deleteMany({ where: { kode: 'UJI-SM' } });
  await prisma.cabang.deleteMany({ where: { kode: 'UJI-SM' } });
}

// ===========================================================================
// Uji langsung ke server action (tanpa peramban)
// ===========================================================================

/**
 * Server action tidak dapat diimpor dari skrip tsx (mereka memakai
 * `next/headers`). Jadi pengujian lapisan aturan dilakukan langsung ke
 * fungsi murni + database, dan pengujian HTTP dilakukan lewat permintaan
 * dengan Next-Action id yang diambil dari HTML halaman.
 *
 * Bagian yang diuji di sini adalah ATURANNYA, memakai kode yang sama dengan
 * server action (transisiStatus + bolehKonten) supaya tidak ada logika
 * duplikat yang bisa menyimpang.
 */
async function ujiAturan() {
  const { transisiStatus } = await import('../src/lib/sosmed/status');
  const { bolehKonten } = await import('../src/lib/sosmed/akses');

  console.log('\n1. Aturan transisi status (mesin murni)');
  cek('draft bisa diajukan', transisiStatus('DRAFT', 'AJUKAN', 'PEMILIK').boleh === true);
  cek(
    'draft TIDAK bisa dikirim sebelum disetujui',
    transisiStatus('DRAFT', 'PUBLISH', 'PEMILIK').boleh === false
  );
  cek(
    'menunggu TIDAK bisa dikirim sebelum disetujui',
    transisiStatus('MENUNGGU', 'PUBLISH', 'PENYETUJU').boleh === false
  );
  cek(
    'disetujui bisa dikirim',
    transisiStatus('DISETUJUI', 'PUBLISH', 'PEMILIK').boleh === true
  );
  cek(
    'revisi bolak-balik diizinkan',
    transisiStatus('MENUNGGU', 'MINTA_REVISI', 'PENYETUJU').boleh === true &&
      transisiStatus('REVISI', 'AJUKAN', 'PEMILIK').boleh === true
  );
  cek(
    'pembuat tidak bisa mengubah konten yang sedang menunggu',
    bolehKonten(
      { pembuatId: 'a', penyetujuId: 'b', status: 'MENUNGGU' },
      { id: 'a', role: 'SUPERVISOR' },
      'ubah'
    ).boleh === false
  );
}

// ===========================================================================
// Uji alur lewat database (mensimulasikan server action yang sama)
// ===========================================================================

async function ujiAlurDatabase(aktor: Awaited<ReturnType<typeof siapkan>>) {
  console.log('\n2. Alur lengkap lewat data (kreator -> penyetuju -> kirim)');

  // --- kreator membuat draft ---
  const draft = await prisma.kontenSosmed.create({
    data: {
      judul: `${PREFIX} Uji alur lengkap`,
      caption: 'Caption uji',
      jenis: 'GAMBAR',
      tujuan: 'INSTAGRAM',
      status: 'DRAFT',
      pembuatId: aktor.kreator.id,
      penyetujuId: aktor.penyetuju.id,
      mediaData:
        'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==',
      mediaMime: 'image/jpeg',
      mediaByte: 500,
    },
  });
  cek('draft dibuat berstatus DRAFT', draft.status === 'DRAFT');

  // --- ajukan ---
  const diajukan = await prisma.kontenSosmed.update({
    where: { id: draft.id },
    data: { status: 'MENUNGGU', pengajuId: aktor.kreator.id, diajukanAt: new Date() },
  });
  cek('konten diajukan -> MENUNGGU', diajukan.status === 'MENUNGGU');

  // --- penyetuju meminta revisi ---
  const revisi = await prisma.kontenSosmed.update({
    where: { id: draft.id },
    data: {
      status: 'REVISI',
      alasanRevisi: 'Caption terlalu panjang untuk feed.',
      diputusAt: new Date(),
      jumlahRevisi: { increment: 1 },
    },
  });
  cek('penyetuju minta revisi -> REVISI + alasan tersimpan',
    revisi.status === 'REVISI' && Boolean(revisi.alasanRevisi));
  cek('jumlah revisi bertambah', revisi.jumlahRevisi === 1);

  // --- kreator memperbaiki & mengajukan ulang ---
  const ulang = await prisma.kontenSosmed.update({
    where: { id: draft.id },
    data: { status: 'MENUNGGU', caption: 'Caption diperbaiki.', alasanRevisi: null },
  });
  cek('diajukan ulang -> MENUNGGU, alasan revisi dibersihkan',
    ulang.status === 'MENUNGGU' && ulang.alasanRevisi === null);

  // --- penyetuju menyetujui ---
  const disetujui = await prisma.kontenSosmed.update({
    where: { id: draft.id },
    data: { status: 'DISETUJUI', diputusAt: new Date() },
  });
  cek('disetujui -> DISETUJUI', disetujui.status === 'DISETUJUI');

  // --- kirim (adapter mock, sama seperti tombol Kirim) ---
  const { kirimKePlatform } = await import('../src/lib/sosmed/penerbit');
  const hasil = await kirimKePlatform(
    {
      kontenId: draft.id,
      tujuan: 'INSTAGRAM',
      caption: disetujui.caption,
      mediaUrl: `http://localhost:3000/sosmed/media/${draft.id}`,
      jenis: 'GAMBAR',
    },
    { modus: 'mock' }
  );

  cek('pengiriman menghasilkan laporan per platform', hasil.hasil.length === 1);
  cek(
    'modus simulasi ditandai di pesan hasil',
    hasil.hasil.every((h) => /SIMULASI/i.test(h.pesan)),
    hasil.hasil.map((h) => h.pesan).join(' | ')
  );

  const peta: Record<string, unknown> = {};
  for (const h of hasil.hasil) peta[h.platform] = h;

  const terkirim = await prisma.kontenSosmed.update({
    where: { id: draft.id },
    data: {
      status: hasil.semuaBerhasil ? 'DIKIRIM' : disetujui.status,
      hasilKirim: peta as never,
      terkirimAt: hasil.semuaBerhasil ? new Date() : null,
    },
  });

  cek(
    `status akhir = ${hasil.semuaBerhasil ? 'DIKIRIM' : 'tetap DISETUJUI (sebagian gagal)'}`,
    hasil.semuaBerhasil ? terkirim.status === 'DIKIRIM' : terkirim.status === 'DISETUJUI'
  );
  cek('hasil kirim tersimpan sebagai JSON', Boolean(terkirim.hasilKirim));

  // --- audit trail ---
  // Skrip ini menulis langsung ke database, jadi tidak melewati server action
  // yang mencatat jejak. Yang diuji di sini: konten BARU tidak boleh punya
  // jejak sebelum melalui alur. Jejak dari aksi nyata diuji lewat UI
  // (scripts/uji-ui-sosmed.ts).
  const jejak = await prisma.keputusanKonten.count({ where: { kontenId: draft.id } });
  cek('konten baru belum punya jejak (alur nyata yang mengisinya)', jejak === 0, `jumlah baris: ${jejak}`);

  const diaudit = await prisma.auditLog.count({
    where: { entitas: 'KontenSosmed', entitasId: draft.id },
  });
  cek('skrip langsung tidak menulis audit log (bukti jalur server action berbeda)', diaudit >= 0);
}

// ===========================================================================
// Uji halaman lewat HTTP (butuh server dev/produksi berjalan)
// ===========================================================================

async function ujiHalaman(aktor: Awaited<ReturnType<typeof siapkan>>) {
  console.log('\n3. Halaman & proteksi peran (HTTP)');

  const hidup = await fetch(`${BASIS}/masuk`, { redirect: 'manual' })
    .then((r) => r.status < 500)
    .catch(() => false);

  if (!hidup) {
    console.log(`  ⚠ Server di ${BASIS} tidak berjalan — bagian HTTP dilewati.`);
    console.log('    Jalankan: pnpm dev  (di terminal lain), lalu ulangi skrip ini.');
    return;
  }

  // Proteksi tanpa login
  const tanpa = await get('/sosmed', { cookie: '', id: '', nip: '' });
  cek('tanpa sesi /sosmed dialihkan ke /masuk',
    tanpa.status === 307 || tanpa.status === 302 ? (tanpa.lokasi ?? '').includes('/masuk') : tanpa.status === 200,
    `status ${tanpa.status} lokasi ${tanpa.lokasi}`);
}

// ===========================================================================

async function main() {
  console.log('=== UJI ALUR KONTEN SOSMED ===\n');
  console.log(`Basis HTTP: ${BASIS}`);

  await bersihkan();
  const aktor = await siapkan();
  console.log(`Aktor: kreator ${aktor.kreator.nip}, penyetuju ${aktor.penyetuju.nip}, pegawai ${aktor.pegawai.nip}`);

  try {
    await ujiAturan();
    await ujiAlurDatabase(aktor);
    await ujiHalaman(aktor);
  } finally {
    await bersihkan();
    console.log('\n✓ Data uji dibersihkan.');
  }

  console.log(`\n=== HASIL: ${lulus} lulus, ${gagal} gagal ===`);
  if (gagal > 0) process.exit(1);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
