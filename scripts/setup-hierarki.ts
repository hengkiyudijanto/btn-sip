/**
 * Susun hierarki cabang: buat Kanwil, lalu pasang KC di bawahnya.
 *
 * Jalankan: pnpm exec tsx scripts/setup-hierarki.ts
 *
 * Idempoten — aman dijalankan berkali-kali, tidak akan membuat duplikat.
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

/** Kanwil yang akan dibuat. Sesuaikan kalau perlu. */
const KANWIL = {
  kode: 'KANWIL-06',
  nama: 'Kanwil VI Makassar',
  alamat: 'Makassar, Sulawesi Selatan',
};

async function main() {
  const host = (process.env.DATABASE_URL ?? '').split('@')[1]?.split('/')[0];
  console.log('Database:', host);
  console.log('');

  // ===== 1. Buat / ambil Kanwil =====
  const kanwil = await prisma.cabang.upsert({
    where: { kode: KANWIL.kode },
    update: { jenis: 'KANWIL', indukId: null },
    create: {
      kode: KANWIL.kode,
      nama: KANWIL.nama,
      jenis: 'KANWIL',
      alamat: KANWIL.alamat,
      indukId: null,
    },
  });
  console.log(`✓ Kanwil: ${kanwil.kode} — ${kanwil.nama}`);

  // ===== 2. Pasang cabang level KC yang belum punya induk =====
  const daftar = await prisma.cabang.findMany({
    where: { id: { not: kanwil.id }, indukId: null },
    orderBy: { kode: 'asc' },
  });

  if (daftar.length === 0) {
    console.log('(tidak ada cabang tanpa induk untuk dipasang)');
  }

  for (const c of daftar) {
    // "Kantor Pusat" biasanya bukan KC — pakai KC sebagai default yang aman,
    // tapi beri tahu supaya bisa disesuaikan.
    await prisma.cabang.update({
      where: { id: c.id },
      data: { indukId: kanwil.id, jenis: c.jenis ?? 'KC' },
    });
    console.log(`✓ ${c.kode} — ${c.nama}  →  induk: ${kanwil.nama}`);
  }

  // ===== 3. Tampilkan struktur akhir =====
  console.log('');
  console.log('=== STRUKTUR HIERARKI ===');
  const semua = await prisma.cabang.findMany({
    include: { induk: { select: { kode: true, nama: true } } },
    orderBy: [{ jenis: 'asc' }, { kode: 'asc' }],
  });

  const kanwilList = semua.filter((c) => c.jenis === 'KANWIL');
  for (const k of kanwilList) {
    console.log(`${k.jenis}  ${k.kode} — ${k.nama}`);
    const anak = semua.filter((c) => c.indukId === k.id);
    for (const a of anak) {
      console.log(`   └─ ${a.jenis}  ${a.kode} — ${a.nama}`);
      const cucu = semua.filter((c) => c.indukId === a.id);
      for (const g of cucu) {
        console.log(`        └─ ${g.jenis}  ${g.kode} — ${g.nama}`);
      }
    }
  }
  const tanpaInduk = semua.filter((c) => !c.indukId && c.jenis !== 'KANWIL');
  if (tanpaInduk.length > 0) {
    console.log('');
    console.log('Cabang tanpa induk (perlu disesuaikan manual):');
    for (const c of tanpaInduk) console.log(`   ${c.kode} — ${c.nama} (${c.jenis})`);
  }
}

main()
  .catch((e) => {
    console.error('❌ GAGAL:', e.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
