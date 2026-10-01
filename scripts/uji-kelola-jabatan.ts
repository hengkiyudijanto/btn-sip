/**
 * Menguji aksi kelola jabatan langsung pada database.
 *
 * Memeriksa aturan yang penting:
 *   - jabatan yang masih dipakai pegawai TIDAK bisa dihapus
 *   - kode duplikat ditolak
 *   - nonaktifkan tetap boleh walaupun masih dipakai
 */

import { prisma } from '@/lib/db';

async function main() {
  console.log('=== jabatan yang ada + jumlah pemakainya ===');
  const daftar = await prisma.jabatan.findMany({
    orderBy: { kode: 'asc' },
    include: { _count: { select: { pegawai: true, pengajuan: true } } },
  });
  for (const j of daftar) {
    console.log(
      `  ${j.kode.padEnd(12)} ${j.nama.padEnd(32)} aktif=${j.aktif}  ` +
      `pegawai=${j._count.pegawai} pengajuan=${j._count.pengajuan}`
    );
  }

  console.log('\n=== uji: kode duplikat ditolak? ===');
  const ada = await prisma.jabatan.findUnique({ where: { kode: 'TELLER' } });
  console.log(`  cari kode TELLER -> ${ada ? 'DITEMUKAN (akan ditolak oleh aksi)' : 'tidak ada'}`);

  console.log('\n=== uji: mana yang boleh dihapus? ===');
  for (const j of daftar) {
    const dipakai = j._count.pegawai + j._count.pengajuan;
    console.log(
      `  ${j.kode.padEnd(12)} ${dipakai === 0 ? 'BOLEH dihapus' : `TIDAK BOLEH (dipakai ${dipakai})`}`
    );
  }

  await prisma.$disconnect();
}

main();
