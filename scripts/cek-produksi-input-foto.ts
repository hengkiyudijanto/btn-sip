/**
 * Verifikasi di PRODUKSI: input foto penilaian TIDAK boleh punya capture="environment",
 * supaya HP/tablet bisa memilih dari galeri (bukan hanya membuka kamera).
 *
 * Membuat sesi admin sementara, membuka halaman penilaian satu petugas, lalu
 * memeriksa atribut input berkasnya. Data tidak diubah.
 */
import 'dotenv/config';
import crypto from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const BASE = process.env.BASE_URL ?? 'https://sip.244.my.id';
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });
const h = (t: string) => crypto.createHash('sha256').update(t).digest('hex');

let lulus = 0;
let gagal = 0;
function cek(kondisi: boolean, label: string) {
  console.log(`   ${kondisi ? 'ok ' : 'XX '} ${label}`);
  if (kondisi) lulus++;
  else gagal++;
}

async function main() {
  console.log(`=== INPUT FOTO PENILAIAN DI PRODUKSI (${BASE}) ===\n`);

  const admin = await prisma.pegawai.findFirst({ where: { role: { in: ['ADMIN', 'SUPERVISOR'] }, aktif: true } });
  if (!admin) throw new Error('tidak ada admin/supervisor aktif');

  const h2 = new Date();
  const periode = await prisma.periode.findFirst({ where: { tanggalMulai: { lte: h2 }, tanggalSelesai: { gte: h2 } } });
  const target = await prisma.pegawai.findFirst({
    where: { aktif: true, role: 'PEGAWAI', cabangId: admin.cabangId },
    select: { id: true, nama: true },
  });
  if (!target || !periode) throw new Error('target/periode tidak ditemukan');
  console.log(`petugas: ${target.nama} | periode: ${periode.nama}\n`);

  const token = crypto.randomBytes(32).toString('base64url');
  await prisma.sesi.create({
    data: { tokenHash: h(token), pegawaiId: admin.id, expiresAt: new Date(Date.now() + 900_000) },
  });

  const url = `${BASE}/penilaian/${target.id}?periode=${periode.id}`;
  const res = await fetch(url, { headers: { cookie: `sip_sesi=${token}` }, redirect: 'manual' });
  cek(res.status === 200, `halaman penilaian terbuka (status ${res.status})`);
  const html = await res.text();

  // ambil semua tag input type=file beserta atributnya
  const inputs = [...html.matchAll(/<input[^>]*type="file"[^>]*>/g)].map((m) => m[0]);
  console.log(`\n   jumlah input type=file di halaman: ${inputs.length}`);
  for (const i of inputs) console.log(`     ${i.replace(/\s+/g, ' ').slice(0, 150)}`);

  cek(inputs.length > 0, 'input berkas foto ada di halaman');
  const adaCapture = inputs.some((i) => /capture\s*=/.test(i));
  cek(!adaCapture, 'TIDAK ada atribut capture (HP/tablet bisa pilih dari galeri)');
  const adaAccept = inputs.some((i) => /accept="image\//.test(i));
  cek(adaAccept, 'accept gambar tetap ada (batasi ke JPEG/PNG/WebP)');
  cek(/Pilih\s*\/?\s*ambil foto|Ganti foto/i.test(html), 'tombol "Pilih / ambil foto" ada');

  await prisma.sesi.deleteMany({ where: { pegawaiId: admin.id, tokenHash: h(token) } });
  console.log('\n✓ sesi sementara dihapus');
  console.log(`\n=== HASIL: ${lulus} lulus, ${gagal} gagal ===`);
  await prisma.$disconnect();
  if (gagal > 0) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
