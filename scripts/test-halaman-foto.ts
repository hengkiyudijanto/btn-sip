/**
 * Uji halaman detail pegawai & tampilnya foto, lewat HTTP dengan sesi nyata.
 * Mengunggah foto ke seorang pegawai lewat database, lalu memastikan foto itu
 * benar-benar muncul di halaman detail dan di laporan SIP.
 *
 * Jalankan: pnpm exec tsx scripts/test-halaman-foto.ts
 */
import 'dotenv/config';
import crypto from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import bcrypt from 'bcryptjs';

const BASE = process.env.BASE_URL ?? 'http://localhost:3100';
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

const hashToken = (t: string) => crypto.createHash('sha256').update(t).digest('hex');

const NIP_UJI = 'HFOTO0001';

async function buatSesi(nip: string) {
  const p = await prisma.pegawai.findUnique({ where: { nip } });
  if (!p) throw new Error(`Pegawai ${nip} tidak ada`);
  const token = crypto.randomBytes(32).toString('base64url');
  await prisma.sesi.create({
    data: { tokenHash: hashToken(token), pegawaiId: p.id, expiresAt: new Date(Date.now() + 3600_000) },
  });
  return { token, p };
}

async function get(path: string, token: string) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { cookie: `sip_sesi=${token}` },
    redirect: 'manual',
  });
  return { status: res.status, html: await res.text(), lokasi: res.headers.get('location') };
}

async function main() {
  console.log('=== UJI HALAMAN DETAIL & FOTO (HTTP) ===\n');

  // siapkan pegawai uji dengan foto
  const cabang = await prisma.cabang.findFirst({ where: { aktif: true } });
  if (!cabang) throw new Error('tidak ada cabang aktif');

  await prisma.pegawai.deleteMany({ where: { nip: NIP_UJI } });

  const gambar = Buffer.from(
    '/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==',
    'base64'
  );
  const dataUrl = `data:image/jpeg;base64,${gambar.toString('base64')}`;

  const peg = await prisma.pegawai.create({
    data: {
      nip: NIP_UJI,
      nama: 'Pegawai Foto Uji',
      passwordHash: await bcrypt.hash('Fotopass123', 10),
      role: 'PEGAWAI',
      harusGantiPassword: false,
      cabangId: cabang.id,
      fotoData: dataUrl,
      fotoMime: 'image/jpeg',
      fotoUkuran: gambar.length,
      fotoDiperbarui: new Date(),
    },
  });
  console.log('ok  pegawai uji dengan foto dibuat');
  console.log(`   (foto ${gambar.length} byte, data URL ${dataUrl.length} karakter)\n`);

  const { token } = await buatSesi('admin');

  // ===== 1. halaman detail =====
  console.log('--- 1. halaman detail pegawai ---');
  const r1 = await get(`/pegawai/${peg.id}`, token);
  cek(r1.status === 200, `halaman detail bisa dibuka (status ${r1.status})`);
  cek(r1.html.includes('Pegawai Foto Uji'), 'nama pegawai tampil');
  cek(r1.html.includes(NIP_UJI), 'NIP tampil');
  cek(r1.html.includes('data:image/jpeg;base64,'), 'foto tampil sebagai data URL');
  cek(r1.html.includes('Foto pegawai'), 'panel unggah foto ada (admin)');
  cek(r1.html.includes('Hapus foto'), 'tombol hapus foto ada');
  cek(r1.html.includes('300'), 'keterangan ukuran target tampil');

  // ===== 2. daftar pegawai =====
  console.log('\n--- 2. daftar pegawai ---');
  const r2 = await get('/pegawai', token);
  cek(r2.status === 200, 'daftar pegawai bisa dibuka');
  cek(r2.html.includes(`/pegawai/${peg.id}`), 'nama ter-link ke halaman detail');
  cek(r2.html.includes('📷'), 'penanda punya foto tampil di daftar');

  // ===== 3. halaman laporan memakai foto =====
  console.log('\n--- 3. laporan SIP memakai foto ---');
  // buat periode sendiri kalau belum ada, supaya bagian ini benar-benar teruji
  let periode = await prisma.periode.findFirst({ where: { aktif: true } });
  let periodeDibuat = false;
  if (!periode) {
    periode = await prisma.periode.create({
      data: {
        kode: 'UJI-FOTO-W',
        nama: 'Uji Foto',
        tanggalMulai: new Date('2027-01-04T00:00:00Z'),
        tanggalSelesai: new Date('2027-01-10T23:59:59Z'),
        aktif: true,
      },
    });
    periodeDibuat = true;
    console.log('   (periode uji dibuat karena belum ada periode aktif)');
  }
  const spv = await prisma.pegawai.findFirst({
    where: { role: { in: ['SUPERVISOR', 'MANAGER', 'ADMIN'] } },
  });

  if (periode && spv) {
    const penilaian = await prisma.penilaian.create({
      data: {
        pegawaiId: peg.id,
        penilaiId: spv.id,
        periodeId: periode.id,
        status: 'DIKIRIM',
        dikirimAt: new Date(),
        nilaiPenampilan: 4.5, nilaiKemampuan: 4.2, nilaiSikap: 4.0, nilaiAkhir: 4.25,
        rating: 'Baik',
        detail: {
          create: [
            { kodeAspek: 'A1', nilaiMentah: 92, skor: 4, bobotAspek: 0.4 },
            { kodeAspek: 'B1', nilaiMentah: 88, skor: 3, bobotAspek: 0.2 },
          ],
        },
      },
    });

    const r3 = await get(`/laporan/${penilaian.id}`, token);
    cek(r3.status === 200, `halaman laporan bisa dibuka (status ${r3.status})`);
    // Sejak Opsi 1, foto TIDAK lagi ditanam sebagai data URL di HTML —
    // halaman memakai alamat /foto/... supaya browser bisa menyimpannya di
    // cache dan tidak mengunduh ulang. Yang diperiksa: alamat itu benar-benar
    // dipakai, DAN route-nya benar-benar mengembalikan gambar.
    cek(
      !r3.html.includes('data:image/jpeg;base64,'),
      'HTML tidak lagi memuat data URL foto (hemat lalu lintas)'
    );
    cek(
      r3.html.includes('/foto/pegawai/'),
      'foto pegawai dirender lewat alamat /foto/pegawai/<id>'
    );
    const ujiFoto = await get(`/laporan/${penilaian.id}`, token);
    const alamat = /\/foto\/pegawai\/[^"?]+\?v=[a-z0-9]+/.exec(ujiFoto.html)?.[0];
    cek(Boolean(alamat), `alamat foto punya penanda versi (${alamat ?? 'tidak ada'})`);
    if (alamat) {
      const resFoto = await fetch(`${BASE}${alamat}`, {
        headers: { cookie: `sip_sesi=${token}` },
      });
      const isi = await resFoto.arrayBuffer();
      cek(resFoto.status === 200, `route foto mengembalikan 200 (${resFoto.status})`);
      cek(isi.byteLength > 0, `route foto mengembalikan gambar (${isi.byteLength} byte)`);
      // Foto pegawai bisa diganti kapan saja, jadi sengaja TIDAK di-cache
      // lama — kalau di-cache, foto lama terus tampil di laporan setelah
      // diganti. Yang diperiksa: server benar-benar melarang cache lama.
      const cc = resFoto.headers.get('cache-control') ?? '';
      cek(
        cc.includes('no-cache') || cc.includes('max-age=0'),
        `foto pegawai tidak di-cache lama (${cc})`
      );
    }
    cek(!r3.html.includes('FOTO 3×4'), 'placeholder "FOTO 3x4" tidak muncul karena foto ada');

    await prisma.penilaianDetail.deleteMany({ where: { penilaianId: penilaian.id } });
    await prisma.penilaian.delete({ where: { id: penilaian.id } });
  }
  if (periodeDibuat && periode) {
    await prisma.periode.delete({ where: { id: periode.id } });
  }

  // ===== 4. proteksi akses =====
  console.log('\n--- 4. proteksi akses ---');
  const pegawaiLain = await prisma.pegawai.findFirst({
    where: { role: 'PEGAWAI', id: { not: peg.id }, harusGantiPassword: false, aktif: true },
  });
  if (pegawaiLain) {
    const sesiLain = await buatSesi(pegawaiLain.nip);
    const r4 = await get(`/pegawai/${peg.id}`, sesiLain.token);
    cek(
      r4.status === 307 && r4.lokasi === '/dasbor',
      `pegawai lain dialihkan ke dasbor (${r4.status} → ${r4.lokasi})`
    );

    // tapi boleh melihat dirinya sendiri
    const r5 = await get(`/pegawai/${pegawaiLain.id}`, sesiLain.token);
    cek(r5.status === 200, `pegawai boleh melihat detail dirinya sendiri (status ${r5.status})`);
    cek(
      !r5.html.includes('Hapus foto'),
      'pegawai biasa TIDAK melihat kontrol unggah foto'
    );

    await prisma.sesi.deleteMany({ where: { pegawaiId: pegawaiLain.id } });
  } else {
    console.log('   (tidak ada pegawai lain tanpa wajib-ganti-password untuk uji proteksi)');
  }

  // bersihkan
  await prisma.sesi.deleteMany({ where: { pegawaiId: { in: [peg.id] } } });
  const admin = await prisma.pegawai.findUnique({ where: { nip: 'admin' } });
  if (admin) await prisma.sesi.deleteMany({ where: { pegawaiId: admin.id } });
  await prisma.pegawai.delete({ where: { id: peg.id } });
  console.log('\n✓ data uji dibersihkan');

  console.log(`\n=== HASIL: ${lulus} lulus, ${gagal} gagal ===`);
  if (gagal > 0) process.exit(1);
  console.log('✅ HALAMAN DETAIL & FOTO TERVERIFIKASI.');
}

main()
  .catch((e) => {
    console.error('\n❌ GAGAL:', e.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
