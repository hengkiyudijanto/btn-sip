/**
 * Rapikan data foto ganda yang tertinggal dari percobaan user.
 *
 * Situasi: user mengunggah foto saat halaman penilaian terbuka pada periode
 * "Minggu ke-4 September 2026" (periode yang sedang berjalan saat itu),
 * lalu membuka periode "Minggu ke-1 Oktober 2026" dan mengunggah lagi.
 * Hasilnya dua penilaian berbeda masing-masing punya foto — keduanya foto
 * yang sama, dan tidak ada yang salah secara aturan, tapi membingungkan.
 *
 * Skrip ini hanya MELAPORKAN, tidak menghapus apa pun tanpa perintah
 * --hapus. Jalankan dulu tanpa --hapus untuk melihat keadaannya.
 *
 * Jalankan:
 *   pnpm exec tsx scripts/rapikan-foto-ganda.ts
 *   pnpm exec tsx scripts/rapikan-foto-ganda.ts --hapus
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});
const HAPUS = process.argv.includes('--hapus');

async function main() {
  console.log(`=== FOTO PENILAIAN YANG ADA (${HAPUS ? 'MODE HAPUS' : 'mode laporan'}) ===\n`);

  const semua = await prisma.penilaian.findMany({
    where: { fotoData: { not: null } },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true, fotoUkuran: true, fotoDiperbarui: true, status: true,
      catatanUmum: true, nilaiAkhir: true, createdAt: true,
      pegawai: { select: { nama: true, nip: true } },
      periode: { select: { nama: true, tanggalMulai: true, tanggalSelesai: true, dikunci: true } },
      _count: { select: { detail: true } },
    },
  });

  if (semua.length === 0) {
    console.log('  tidak ada foto penilaian.');
    return;
  }

  // kelompokkan per pegawai
  const perPegawai = new Map<string, typeof semua>();
  for (const p of semua) {
    const kunci = p.pegawai.nip;
    if (!perPegawai.has(kunci)) perPegawai.set(kunci, []);
    perPegawai.get(kunci)!.push(p);
  }

  for (const [nip, daftar] of perPegawai) {
    console.log(`${daftar[0].pegawai.nama} (${nip}) — ${daftar.length} foto`);
    for (const p of daftar) {
      const kosong = p._count.detail === 0 && p.nilaiAkhir === null;
      console.log(
        `  ${p.periode?.nama ?? '(tanpa periode)'}\n` +
          `    id=${p.id}\n` +
          `    status=${p.status}  ukuran=${p.fotoUkuran}  ` +
          `diperbarui=${p.fotoDiperbarui?.toISOString() ?? 'null'}\n` +
          `    rincian aspek=${p._count.detail}  nilai akhir=${p.nilaiAkhir ?? '(kosong)'}\n` +
          `    ${kosong ? '<<< PENILAIAN KOSONG (foto saja, belum ada nilai)' : 'ada nilai'}` +
          `${p.periode?.dikunci ? '  [periode TERKUNCI]' : ''}`
      );
    }
    console.log();
  }

  // penilaian yang isinya hanya foto tanpa nilai sama sekali
  const kosong = semua.filter((p) => p._count.detail === 0 && p.nilaiAkhir === null);
  console.log(`=== RINGKASAN ===`);
  console.log(`  total penilaian berfoto : ${semua.length}`);
  console.log(`  penilaian KOSONG (foto saja): ${kosong.length}`);
  for (const p of kosong) {
    console.log(`    - ${p.pegawai.nama} / ${p.periode?.nama}`);
  }

  if (kosong.length === 0) {
    console.log('\n  Tidak ada yang perlu dibersihkan.');
    return;
  }

  if (!HAPUS) {
    console.log('\n  Jalankan ulang dengan --hapus untuk menghapus foto pada');
    console.log('  penilaian kosong itu (penilaiannya sendiri tetap ada).');
    console.log('  Foto pada penilaian yang SUDAH ADA NILAINYA tidak disentuh.');
    return;
  }

  for (const p of kosong) {
    if (p.periode?.dikunci) {
      console.log(`  dilewati (periode terkunci): ${p.pegawai.nama} / ${p.periode?.nama}`);
      continue;
    }
    await prisma.penilaian.update({
      where: { id: p.id },
      data: {
        fotoData: null, fotoMime: null, fotoUkuran: null,
        fotoDiperbarui: null, fotoCatatan: null,
      },
    });
    console.log(`  dibersihkan: ${p.pegawai.nama} / ${p.periode?.nama}`);
  }
  console.log('\n  selesai.');
}

main()
  .catch((e) => { console.error('GAGAL:', e.message); process.exit(1); })
  .finally(() => prisma.$disconnect());
