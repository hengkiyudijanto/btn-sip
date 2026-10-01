/** Menguji aturan kapitalisasi langsung pada data nyata dari database. */

import { prisma } from '@/lib/db';

async function main() {
  console.log('=== CABANG (aturan khusus: KC/KCP kapital semua) ===');
  const cabang = await prisma.cabang.findMany({
    select: { kode: true, nama: true },
    orderBy: { kode: 'asc' },
  });
  for (const c of cabang) {
    console.log(`  "${c.nama}"   (asli di DB: cek di bawah)`);
  }

  console.log('\n=== PEGAWAI (aturan umum) ===');
  const pegawai = await prisma.pegawai.findMany({
    select: { nip: true, nama: true, cabang: { select: { nama: true } }, jabatan: { select: { nama: true } } },
    take: 8,
  });
  for (const p of pegawai) {
    console.log(`  nip=${p.nip}  nama="${p.nama}"  cabang="${p.cabang?.nama ?? "-"}"  jabatan="${p.jabatan?.nama ?? "-"}"`);
  }

  // bandingkan dengan nilai ASLI di database (query mentah, tanpa ekstensi)
  console.log('\n=== NILAI ASLI DI DATABASE (query mentah) ===');
  const asli = await prisma.$queryRaw<Array<{ kode: string; nama: string }>>`
    SELECT kode, nama FROM "Cabang" ORDER BY kode ASC
  `;
  for (const c of asli) {
    console.log(`  kode=${c.kode}  nama="${c.nama}"`);
  }

  const asliPegawai = await prisma.$queryRaw<Array<{ nama: string }>>`
    SELECT nama FROM "Pegawai" LIMIT 8
  `;
  console.log('  pegawai:');
  for (const p of asliPegawai) {
    console.log(`    "${p.nama}"`);
  }

  await prisma.$disconnect();
}

main();
