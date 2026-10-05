/**
 * Data demo modul konten sosmed.
 *
 * Jalankan: pnpm exec tsx scripts/seed-sosmed.ts
 * Bersihkan: pnpm exec tsx scripts/seed-sosmed.ts --hapus
 *
 * Sengaja TIDAK memakai berkas nyata untuk semua baris: satu konten tanpa
 * berkas (draft kosong) penting supaya terlihat bagaimana UI menangani berkas
 * yang belum ada — keadaan itu nyata terjadi saat pegawai menyimpan draft lalu
 * menutup peramban.
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('❌ DATABASE_URL tidak ada.');
  process.exit(1);
}
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

/** Gambar JPEG 1x1 piksel (putih) — cukup untuk membuktikan jalur berkas hidup. */
const JPEG_KECIL =
  'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==';

const PREFIX = '[DEMO-SOSMED]';

async function main() {
  const hapus = process.argv.includes('--hapus');

  if (hapus) {
    const hasil = await prisma.kontenSosmed.deleteMany({
      where: { judul: { startsWith: PREFIX } },
    });
    console.log(`✓ Dihapus: ${hasil.count} konten demo.`);
    return;
  }

  // --- tentukan aktor: satu kreator (SUPERVISOR) & satu penyetuju (MANAGER) ---
  const kreator = await prisma.pegawai.findFirst({
    where: { role: 'SUPERVISOR', aktif: true },
    select: { id: true, nama: true },
  });
  const penyetuju = await prisma.pegawai.findFirst({
    where: { role: { in: ['MANAGER', 'ADMIN'] }, aktif: true },
    select: { id: true, nama: true },
  });

  if (!kreator || !penyetuju) {
    console.error(
      '❌ Butuh minimal satu pegawai aktif berperan SUPERVISOR dan satu MANAGER/ADMIN.\n' +
        '   Jalankan dulu seed akun/pegawai, atau buat pegawai lewat menu Pegawai.'
    );
    process.exit(1);
  }
  if (kreator.id === penyetuju.id) {
    console.error('❌ Kreator dan penyetuju tidak boleh orang yang sama.');
    process.exit(1);
  }

  console.log(`Kreator  : ${kreator.nama}`);
  console.log(`Penyetuju: ${penyetuju.nama}`);

  const contoh = [
    {
      judul: `${PREFIX} Promo KPR edisi Oktober`,
      caption: 'Rumah sendiri makin ringan. Cicilan tetap, tanpa biaya provisi. #KPR #BTN',
      jenis: 'VIDEO' as const,
      tujuan: 'KEDUANYA',
      status: 'DRAFT',
      denganBerkas: true,
      mediaMime: 'video/mp4',
      durasiDetik: 42,
    },
    {
      judul: `${PREFIX} Tips menabung untuk pelajar`,
      caption: 'Mulai dari Rp10.000. Sedikit tapi rutin. #Menabung #BTN',
      jenis: 'GAMBAR' as const,
      tujuan: 'INSTAGRAM',
      status: 'MENUNGGU',
      denganBerkas: true,
      mediaMime: 'image/jpeg',
      durasiDetik: null,
    },
    {
      judul: `${PREFIX} Edukasi keamanan PIN`,
      caption: 'Jangan bagikan PIN ke siapa pun, termasuk yang mengaku petugas bank.',
      jenis: 'VIDEO' as const,
      tujuan: 'TIKTOK',
      status: 'REVISI',
      denganBerkas: true,
      mediaMime: 'video/mp4',
      durasiDetik: 30,
    },
    {
      judul: `${PREFIX} Testimoni nasabah Prioritas`,
      caption: 'Pelayanan yang membuat nasabah kembali lagi.',
      jenis: 'GAMBAR' as const,
      tujuan: 'INSTAGRAM',
      status: 'DISETUJUI',
      denganBerkas: true,
      mediaMime: 'image/jpeg',
      durasiDetik: null,
    },
    {
      judul: `${PREFIX} Draft tanpa berkas`,
      caption: '',
      jenis: 'GAMBAR' as const,
      tujuan: 'INSTAGRAM',
      status: 'DRAFT',
      denganBerkas: false,
      mediaMime: null,
      durasiDetik: null,
    },
  ];

  let dibuat = 0;
  for (const c of contoh) {
    const ada = await prisma.kontenSosmed.findFirst({ where: { judul: c.judul } });
    if (ada) {
      console.log(`• Lewati (sudah ada): ${c.judul}`);
      continue;
    }

    const data = {
      judul: c.judul,
      caption: c.caption,
      jenis: c.jenis,
      tujuan: c.tujuan,
      status: c.status,
      pembuatId: kreator.id,
      penyetujuId: penyetuju.id,
      mediaByte: c.denganBerkas ? 12_000 : null,
      mediaLebar: c.denganBerkas ? 1080 : null,
      mediaTinggi: c.denganBerkas ? 1920 : null,
      durasiDetik: c.durasiDetik,
      ...(c.denganBerkas ? { mediaData: JPEG_KECIL, mediaMime: c.mediaMime } : {}),
      ...(c.status === 'MENUNGGU' || c.status === 'DISETUJUI'
        ? { pengajuId: kreator.id, diajukanAt: new Date(), diputusAt: c.status === 'DISETUJUI' ? new Date() : null }
        : {}),
      ...(c.status === 'REVISI'
        ? {
            pengajuId: kreator.id,
            diajukanAt: new Date(),
            diputusAt: new Date(),
            alasanRevisi: 'Narasi di detik ke-10 terlalu cepat. Mohon diperlambat dan ulangi rekaman.',
            jumlahRevisi: 1,
          }
        : {}),
    };

    const konten = await prisma.kontenSosmed.create({ data });
    await prisma.keputusanKonten.create({
      data: {
        kontenId: konten.id,
        aksi: 'DIBUAT',
        olehId: kreator.id,
        catatan: 'Dibuat oleh skrip data demo.',
      },
    });
    console.log(`✓ ${c.status.padEnd(10)} ${c.judul}`);
    dibuat++;
  }

  console.log(`\n✓ ${dibuat} konten demo dibuat.`);
  console.log('  Bersihkan dengan: pnpm exec tsx scripts/seed-sosmed.ts --hapus');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
