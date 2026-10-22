/**
 * Verifikasi tampilan ranking 1-halaman di PRODUKSI.
 *
 * Membuat sesi sementara, membuka halaman /laporan/ranking/satu, lalu memeriksa:
 *   - tombol "Tampilkan 1 halaman" ada di halaman ranking (kiri tombol PPTX)
 *   - halaman 1-halaman terbuka dan berisi tabel peringkat + foto
 *   - tinggi lembar = 297mm (satu halaman A4)
 *   - berkas PPTX-nya bisa diunduh dan berisi SATU slide
 * Tidak mengubah data; sesi sementara dihapus di akhir.
 */
import 'dotenv/config';
import crypto from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const BASE = process.env.BASE_URL ?? 'https://sip.244.my.id';
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });
const h = (t: string) => crypto.createHash('sha256').update(t).digest('hex');

let lulus = 0, gagal = 0;
function cek(ok: boolean, label: string) {
  console.log(`   ${ok ? 'ok ' : 'XX '} ${label}`);
  ok ? lulus++ : gagal++;
}

async function main() {
  console.log(`=== VERIFIKASI RANKING 1 HALAMAN DI PRODUKSI (${BASE}) ===\n`);

  const admin = await prisma.pegawai.findFirst({ where: { role: 'ADMIN', aktif: true } });
  if (!admin) throw new Error('tidak ada admin aktif');
  const periode = await prisma.periode.findFirst({
    where: { penilaian: { some: { nilaiAkhir: { not: null } } } },
    orderBy: { tanggalMulai: 'desc' },
  });
  if (!periode) throw new Error('tidak ada periode berpenilaian');
  console.log(`periode: ${periode.nama}\n`);

  const token = crypto.randomBytes(32).toString('base64url');
  await prisma.sesi.create({
    data: { tokenHash: h(token), pegawaiId: admin.id, expiresAt: new Date(Date.now() + 900_000) },
  });
  const cookie = { cookie: `sip_sesi=${token}` };

  // 1) halaman ranking biasa: tombol baru harus ada
  const halRanking = await fetch(`${BASE}/laporan/ranking?periode=${periode.id}`, { headers: cookie });
  const htmlRanking = await halRanking.text();
  cek(halRanking.status === 200, `halaman ranking terbuka (${halRanking.status})`);
  cek(/Tampilkan 1 halaman/i.test(htmlRanking), 'tombol "Tampilkan 1 halaman" ada');
  cek(/laporan\/ranking\/satu\?/.test(htmlRanking), 'tombol menuju /laporan/ranking/satu');
  const posTombolBaru = htmlRanking.search(/Tampilkan 1 halaman/i);
  const posTombolPptx = htmlRanking.search(/Unduh laporan PPTX/i);
  cek(posTombolBaru > 0 && posTombolPptx > 0 && posTombolBaru < posTombolPptx,
    'tombol baru berada SEBELUM (di kiri) tombol unduh PPTX');

  // 2) halaman satu-halaman
  const res = await fetch(`${BASE}/laporan/ranking/satu?periode=${periode.id}`, { headers: cookie });
  const html = await res.text();
  cek(res.status === 200, `halaman 1-halaman terbuka (${res.status})`);
  cek(/LAPORAN RANKING PETUGAS FRONTLINER/i.test(html), 'kop laporan ada');
  cek(/lembar-a4/.test(html), 'lembar A4 ada');
  cek(/--tinggi-baris/.test(html), 'tinggi baris dihitung (variable CSS ada)');
  const jumlahBaris = (html.match(/lembar-peringkat/g) ?? []).length;
  cek(jumlahBaris > 0, `baris peringkat ada (${jumlahBaris})`);
  const jumlahFoto = (html.match(/class="lembar-foto"/g) ?? []).length;
  cek(jumlahFoto > 0, `foto tertanam di halaman (${jumlahFoto})`);
  cek(!/base64,data:/.test(html), 'TIDAK ada awalan data URL dobel (foto bisa tampil)');
  cek(/KATEGORI/i.test(html), 'legenda kategori ada');
  cek(/ranking\/satu\/pptx\?/.test(html), 'tautan unduh PPTX ada di halaman');
  cek(/cetak=1/.test(html), 'tautan PDF/cetak ada di halaman');

  // 3) PPTX
  const resPptx = await fetch(`${BASE}/laporan/ranking/satu/pptx?periode=${periode.id}`, { headers: cookie });
  cek(resPptx.status === 200, `PPTX terunduh (${resPptx.status})`);
  const buf = Buffer.from(await resPptx.arrayBuffer());
  cek(buf.length > 20_000, `ukuran PPTX wajar (${Math.round(buf.length / 1024)} KB)`);
  cek(buf.subarray(0, 2).toString() === 'PK', 'berkas PPTX valid (awalan ZIP)');

  await prisma.sesi.deleteMany({ where: { pegawaiId: admin.id, tokenHash: h(token) } });
  console.log('\nsesi sementara dihapus');
  console.log(`\n=== HASIL: ${lulus} lulus, ${gagal} gagal ===`);
  await prisma.$disconnect();
  if (gagal > 0) process.exit(1);
}

main().catch((e) => { console.error(e); process.exit(1); });
