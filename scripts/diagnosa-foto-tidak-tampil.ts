/**
 * Diagnosis: foto sudah diunggah tapi tidak tampil saat cetak.
 *
 * Memeriksa berurutan:
 *   1. Apakah foto BENAR-BENAR tersimpan di database? (data vs fotoData)
 *   2. Apakah kolom fotoDiperbarui terisi? (penentu penanda versi)
 *   3. Apakah alamat di halaman cetak memakai versi terbaru?
 *   4. Apakah route mengembalikan foto TERBARU?
 *   5. Apakah ada penilaian dengan tanggal foto lebih baru dari yang tampil?
 *
 * Jalankan: pnpm exec tsx scripts/diagnosa-foto-tidak-tampil.ts
 */
import 'dotenv/config';
import crypto from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { alamatFoto } from '../src/lib/sip/alamat-foto';

const BASE = process.env.BASE_URL ?? 'https://btn-sip.vercel.app';
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});
const h = (t: string) => crypto.createHash('sha256').update(t).digest('hex');

async function main() {
  console.log(`=== DIAGNOSA FOTO TIDAK TAMPIL (${BASE}) ===\n`);

  // ===== 1. semua foto yang tersimpan =====
  console.log('--- 1. foto tersimpan di database ---');
  const denganFoto = await prisma.penilaian.findMany({
    where: { fotoData: { not: null } },
    orderBy: { fotoDiperbarui: 'desc' },
    select: {
      id: true, fotoData: true, fotoMime: true, fotoUkuran: true,
      fotoDiperbarui: true, fotoCatatan: true, status: true,
      pegawai: { select: { nama: true, nip: true } },
      periode: { select: { nama: true } },
    },
  });
  const fotoPegawai = await prisma.pegawai.findMany({
    where: { fotoData: { not: null } },
    select: {
      id: true, nama: true, nip: true, fotoData: true,
      fotoUkuran: true, fotoDiperbarui: true,
    },
  });

  console.log(`  foto PENILAIAN : ${denganFoto.length}`);
  for (const p of denganFoto) {
    const asli = Buffer.from(p.fotoData!.split(',')[1] ?? '', 'base64').length;
    console.log(
      `    ${p.pegawai.nama} (${p.pegawai.nip}) — ${p.periode?.nama ?? '?'}`
    );
    console.log(
      `      status=${p.status}  ukuran tercatat=${p.fotoUkuran ?? 'null'}  ` +
        `byte asli=${asli}`
    );
    console.log(
      `      fotoDiperbarui=${p.fotoDiperbarui?.toISOString() ?? 'NULL/TIDAK PERNAH DIISI'}`
    );
    console.log(`      fotoCatatan=${JSON.stringify(p.fotoCatatan)}`);
    console.log(
      `      alamat=${alamatFoto('penilaian', p) ?? '(tidak menghasilkan alamat)'}`
    );
  }

  console.log(`\n  foto PEGAWAI : ${fotoPegawai.length}`);
  for (const p of fotoPegawai) {
    console.log(
      `    ${p.nama} (${p.nip})  ukuran=${p.fotoUkuran}  ` +
        `diperbarui=${p.fotoDiperbarui?.toISOString() ?? 'NULL'}`
    );
    console.log(`      alamat=${alamatFoto('pegawai', p) ?? '(tidak ada)'}`);
  }

  if (denganFoto.length === 0) {
    console.log('\n  TIDAK ADA foto penilaian tersimpan sama sekali.');
    console.log('  Artinya unggahan TIDAK sampai ke database — bukan masalah cache.');
    return;
  }

  // ===== 2. uji halaman cetak & route =====
  const admin = await prisma.pegawai.findUnique({ where: { nip: 'admin' } });
  if (!admin) throw new Error('akun admin tidak ada');
  const token = crypto.randomBytes(32).toString('base64url');
  await prisma.sesi.create({
    data: { tokenHash: h(token), pegawaiId: admin.id, expiresAt: new Date(Date.now() + 900000) },
  });
  const cookie = `sip_sesi=${token}`;

  for (const p of denganFoto) {
    console.log(`\n--- 2. uji halaman cetak: ${p.pegawai.nama} ---`);
    const res = await fetch(`${BASE}/laporan/${p.id}`, { headers: { cookie } });
    const html = await res.text();

    const alamatDiHalaman = /\/foto\/(?:penilaian|pegawai)\/[^"'\s?]+\?v=[a-z0-9]+/.exec(html);
    console.log(`  alamat di halaman : ${alamatDiHalaman?.[0] ?? '(tidak ada fotonya)'}`);

    if (alamatDiHalaman) {
      const resFoto = await fetch(`${BASE}${alamatDiHalaman[0]}`, { headers: { cookie } });
      const byte = (await resFoto.arrayBuffer()).byteLength;
      console.log(`  route mengembalikan: ${resFoto.status}, ${byte} byte`);

      // bandingkan dengan byte di database
      const byteDb = Buffer.from(p.fotoData!.split(',')[1] ?? '', 'base64').length;
      if (alamatDiHalaman[0].includes('penilaian')) {
        console.log(
          `  cocok dengan database: ${byte === byteDb ? 'YA' : `TIDAK (db ${byteDb} byte)`}`
        );
      } else {
        console.log('  halaman memakai FOTO PEGAWAI (cadangan), bukan foto penilaian');
        const pegawaiSumber = fotoPegawai.find((f) => alamatDiHalaman[0].includes(f.id));
        if (pegawaiSumber) {
          const bytePeg = Buffer.from(pegawaiSumber.fotoData!.split(',')[1] ?? '', 'base64').length;
          console.log(
            `  cocok dengan foto pegawai: ${byte === bytePeg ? 'YA' : `TIDAK (db ${bytePeg} byte)`}`
          );
        }
      }
    }

    if (p.fotoDiperbarui === null) {
      console.log('  >>> MASALAH: fotoDiperbarui NULL.');
      console.log('      Alamat foto tidak punya penanda versi yang berubah,');
      console.log('      sehingga browser bisa menyajikan FOTO LAMA dari cache.');
    }
  }

  // ===== 3. apakah alamat berubah saat foto diperbarui? =====
  console.log('\n--- 3. apakah fotoDiperbarui benar-benar diperbarui? ---');
  const punya = denganFoto.filter((p) => p.fotoDiperbarui !== null).length;
  console.log(`  foto dengan fotoDiperbarui terisi: ${punya}/${denganFoto.length}`);
  if (punya < denganFoto.length) {
    console.log('  >>> foto tanpa fotoDiperbarui akan memakai versi tetap "1"');
    console.log('      sehingga penggantian foto TIDAK mengubah alamat -> cache lama dipakai');
  }

  await prisma.sesi.deleteMany({ where: { pegawaiId: admin.id } });
}

main()
  .catch((e) => { console.error('GAGAL:', e.message); process.exit(1); })
  .finally(() => prisma.$disconnect());
