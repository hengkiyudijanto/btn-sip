/**
 * Uji penghematan lalu lintas dengan foto berukuran NYATA.
 *
 * Uji sebelumnya memakai foto 160 byte sehingga penghematannya tidak
 * terlihat (0%). Di sini dipakai foto ~28 KB seperti foto sungguhan
 * hasil kompresi peramban (300x400 px, JPEG).
 *
 * Jalankan: pnpm exec tsx scripts/uji-opsi1-hemat.ts
 */
import 'dotenv/config';
import crypto from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import bcrypt from 'bcryptjs';
import { execSync } from 'node:child_process';

const BASE = process.env.BASE_URL ?? 'http://localhost:3100';
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});
const h = (t: string) => crypto.createHash('sha256').update(t).digest('hex');

const NIP_S = 'HEMATSPV';
const NIP_P = 'HEMATPET';
const KODE_W = 'HEMAT-W1';

async function bersih() {
  const ids = (
    await prisma.pegawai.findMany({
      where: { nip: { in: [NIP_S, NIP_P] } },
      select: { id: true },
    })
  ).map((p) => p.id);
  await prisma.penilaianDetail.deleteMany({ where: { penilaian: { pegawaiId: { in: ids } } } });
  await prisma.penilaian.deleteMany({ where: { pegawaiId: { in: ids } } });
  await prisma.sesi.deleteMany({ where: { pegawaiId: { in: ids } } });
  await prisma.pegawai.deleteMany({ where: { nip: { in: [NIP_S, NIP_P] } } });
  await prisma.periode.deleteMany({ where: { kode: KODE_W } });
}

/** Buat JPEG 300x400 yang ukurannya realistis memakai pymupdf. */
function buatFoto(): { dataUrl: string; byte: number } {
  const keluaran = execSync(
    `~/venvs/dev/bin/python -c "
import pymupdf, base64
pix = pymupdf.Pixmap(pymupdf.csRGB, pymupdf.IRect(0, 0, 300, 400))
pix.clear_with(190)
for y in range(0, 400, 2):
    for x in range(0, 300, 2):
        pix.set_pixel(x, y, ((x*255)//300, (y*255)//400, ((x+y)*255)//700))
d = pix.tobytes('jpeg', jpg_quality=85)
print('data:image/jpeg;base64,' + base64.b64encode(d).decode())
"`,
    { encoding: 'utf8', shell: '/bin/bash', timeout: 120000 }
  ).trim();
  const byte = Buffer.from(keluaran.split(',')[1], 'base64').length;
  return { dataUrl: keluaran, byte };
}

async function main() {
  console.log(`=== UJI PENGHEMATAN DENGAN FOTO UKURAN NYATA (${BASE}) ===\n`);
  await bersih();

  const cabang = await prisma.cabang.findFirst({ where: { aktif: true } });
  const hash = await bcrypt.hash('Hemat1uji', 10);
  const spv = await prisma.pegawai.create({
    data: { nip: NIP_S, nama: 'SPV Hemat', passwordHash: hash, role: 'SUPERVISOR',
      harusGantiPassword: false, aktif: true, cabangId: cabang!.id },
  });
  const pet = await prisma.pegawai.create({
    data: { nip: NIP_P, nama: 'Petugas Hemat', passwordHash: hash, role: 'PEGAWAI',
      harusGantiPassword: false, aktif: true, cabangId: cabang!.id, atasanId: spv.id },
  });
  const per = await prisma.periode.create({
    data: { kode: KODE_W, nama: 'Uji Hemat', tanggalMulai: new Date(2049, 0, 1),
      tanggalSelesai: new Date(2049, 0, 7), aktif: true },
  });

  const foto = buatFoto();
  console.log(`  foto uji: ${foto.byte} byte (${(foto.byte / 1024).toFixed(1)} KB)`);
  console.log(`  sebagai base64: ${foto.dataUrl.length} byte (${(foto.dataUrl.length / 1024).toFixed(1)} KB)`);

  const pen = await prisma.penilaian.create({
    data: {
      pegawaiId: pet.id, penilaiId: spv.id, periodeId: per.id, status: 'FINAL',
      nilaiAkhir: 3.5, rating: 'Cukup',
      fotoData: foto.dataUrl, fotoMime: 'image/jpeg', fotoUkuran: foto.byte,
      detail: { create: [{ kodeAspek: 'A1', nilaiMentah: 90, skor: 3, bobotAspek: 0.4 }] },
    },
  });

  const token = crypto.randomBytes(32).toString('base64url');
  await prisma.sesi.create({
    data: { tokenHash: h(token), pegawaiId: spv.id, expiresAt: new Date(Date.now() + 900000) },
  });
  const cookie = `sip_sesi=${token}`;

  // ukur HTML dan foto terpisah
  const resHal = await fetch(`${BASE}/laporan/${pen.id}`, { headers: { cookie } });
  const html = await resHal.text();
  const kbHtml = Buffer.byteLength(html) / 1024;

  const resFoto = await fetch(`${BASE}/foto/penilaian/${pen.id}?v=1`, { headers: { cookie } });
  const kbFoto = (await resFoto.arrayBuffer()).byteLength / 1024;

  console.log(`\n  HTML laporan (tanpa foto) : ${kbHtml.toFixed(1)} KB`);
  console.log(`  berkas foto               : ${kbFoto.toFixed(1)} KB`);

  // SEBELUM Opsi 1: foto tertanam di HTML, jadi setiap buka mengunduh HTML+foto
  const sebelumSekali = kbHtml + kbFoto;
  // SESUDAH: buka pertama sama, buka berikutnya foto dari cache
  const sesudahSekali = kbHtml + kbFoto;
  const sesudahBerikut = kbHtml;

  console.log('\n  berapa kali dibuka   SEBELUM (foto di HTML)   SESUDAH (foto di-cache)   hemat');
  console.log('  ' + '-'.repeat(76));
  for (const n of [1, 2, 5, 10]) {
    const sebelum = sebelumSekali * n;
    const sesudah = sesudahSekali + sesudahBerikut * (n - 1);
    const persen = n === 1 ? 0 : ((sebelum - sesudah) / sebelum) * 100;
    console.log(
      `  ${String(n).padStart(2)}x buka              ${sebelum.toFixed(0).padStart(8)} KB` +
        `                ${sesudah.toFixed(0).padStart(8)} KB` +
        `        ${persen.toFixed(0).padStart(3)}%`
    );
  }

  console.log('\n  Perhatikan: buka pertama memang sama — foto tetap perlu diunduh');
  console.log('  sekali. Penghematan mulai dari buka kedua.');

  await prisma.penilaianDetail.deleteMany({ where: { penilaianId: pen.id } });
  await prisma.penilaian.delete({ where: { id: pen.id } });
  await bersih();
  console.log('\n✅ selesai, data uji dibersihkan');
}

main()
  .catch((e) => { console.error('GAGAL:', e.message); process.exit(1); })
  .finally(() => prisma.$disconnect());
