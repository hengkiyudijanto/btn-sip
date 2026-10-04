/**
 * Hapus akun UJI (NIP berawalan TST) dari database.
 *
 * Pengaman:
 *   - hanya menyentuh NIP berawalan `TST` (tidak mungkin mengenai akun asli)
 *   - menolak jalan kalau ada akun uji yang masih dirujuk data penting
 *     (penilaian sebagai dinilai/penilai/pengetahui, atau audit log)
 *   - mencetak ringkasan sebelum & sesudah; pratinjau secara default
 *
 *   pnpm exec tsx scripts/hapus-akun-uji.ts            # pratinjau
 *   pnpm exec tsx scripts/hapus-akun-uji.ts --jalankan # hapus
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const JALANKAN = process.argv.includes('--jalankan');
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

async function main() {
  const uji = await prisma.pegawai.findMany({
    where: { nip: { startsWith: 'TST' } },
    include: {
      _count: {
        select: {
          sesi: true,
          penilaianku: true,
          penilaiankuSebagaiPenilai: true,
          penilaiankuSebagaiMengetahui: true,
          auditLog: true,
        },
      },
    },
  });

  if (uji.length === 0) {
    console.log('Tidak ada akun uji (NIP berawalan TST).');
    return;
  }

  console.log(`Akun uji ditemukan: ${uji.length}\n`);
  let berbahaya = 0;
  for (const p of uji) {
    const c = p._count;
    const dipakai =
      c.penilaianku + c.penilaiankuSebagaiPenilai + c.penilaiankuSebagaiMengetahui + c.auditLog;
    if (dipakai > 0) berbahaya++;
    console.log(`  ${p.nip.padEnd(10)} ${p.nama.padEnd(14)} ${p.role}`);
    console.log(
      `     sesi=${c.sesi} | dinilai=${c.penilaianku} | penilai=${c.penilaiankuSebagaiPenilai} | mengetahui=${c.penilaiankuSebagaiMengetahui} | audit=${c.auditLog}`
    );
  }

  if (berbahaya > 0) {
    console.log(`\n!! BERHENTI — ${berbahaya} akun uji masih dirujuk data penting.`);
    console.log('Menghapusnya akan ikut menghapus data itu. Periksa dulu.');
    process.exitCode = 1;
    return;
  }

  if (!JALANKAN) {
    console.log('\nAman dihapus: tidak ada penilaian/audit yang merujuk akun ini.');
    console.log('(pratinjau — tambahkan --jalankan untuk menghapus)');
    return;
  }

  const id = uji.map((p) => p.id);
  const s = await prisma.sesi.deleteMany({ where: { pegawaiId: { in: id } } });
  const h = await prisma.pegawai.deleteMany({ where: { id: { in: id } } });
  console.log(`\nterhapus: ${h.count} pegawai uji, ${s.count} sesi`);

  const sisaUji = await prisma.pegawai.count({ where: { nip: { startsWith: 'TST' } } });
  const total = await prisma.pegawai.count();
  const penilaian = await prisma.penilaian.count();
  console.log(`akun uji tersisa: ${sisaUji} (harus 0)`);
  console.log(`total pegawai: ${total} | total penilaian: ${penilaian} (harus tetap)`);
}

main()
  .catch((e) => {
    console.error('GAGAL:', e instanceof Error ? e.message : e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
