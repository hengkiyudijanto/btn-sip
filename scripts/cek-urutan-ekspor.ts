/**
 * Bukti urutan: nilai NULL (DRAFT kosong) vs nilai terisi, pada ORDER BY DESC.
 * Membuat data uji sendiri, memeriksa urutan kedua cara, lalu membersihkan diri.
 */
import { prisma } from '@/lib/db';
import bcrypt from 'bcryptjs';

const NIP_NULL = 'URUTNULL01';
const NIP_NILAI = 'URUTNILAI01';

async function bersihkan() {
  await prisma.penilaianDetail.deleteMany({ where: { penilaian: { pegawai: { nip: { in: [NIP_NULL, NIP_NILAI] } } } } });
  await prisma.penilaian.deleteMany({ where: { pegawai: { nip: { in: [NIP_NULL, NIP_NILAI] } } } });
  await prisma.pegawai.deleteMany({ where: { nip: { in: [NIP_NULL, NIP_NILAI] } } });
}

async function main() {
  await bersihkan();

  const spv = await prisma.pegawai.findFirst({ where: { role: { in: ['SUPERVISOR', 'ADMIN'] } } });
  if (!spv) throw new Error('tidak ada supervisor');
  const h = new Date();
  const periode = await prisma.periode.findFirst({ where: { tanggalMulai: { lte: h }, tanggalSelesai: { gte: h } } });
  if (!periode) throw new Error('tidak ada periode berjalan');

  const hash = await bcrypt.hash('Urutpass123', 10);
  const kosong = await prisma.pegawai.create({
    data: { nip: NIP_NULL, nama: 'Zzz Kosong', passwordHash: hash, role: 'PEGAWAI', harusGantiPassword: false, aktif: true, cabangId: spv.cabangId },
  });
  const bernilai = await prisma.pegawai.create({
    data: { nip: NIP_NILAI, nama: 'Aaa Bernilai', passwordHash: hash, role: 'PEGAWAI', harusGantiPassword: false, aktif: true, cabangId: spv.cabangId },
  });

  // satu DRAFT tanpa nilai akhir, satu FINAL dengan nilai tertinggi
  await prisma.penilaian.create({
    data: { pegawaiId: kosong.id, penilaiId: spv.id, periodeId: periode.id, status: 'DRAFT' },
  });
  await prisma.penilaian.create({
    data: {
      pegawaiId: bernilai.id, penilaiId: spv.id, periodeId: periode.id, status: 'FINAL',
      nilaiPenampilan: 5, nilaiKemampuan: 5, nilaiSikap: 5, nilaiAkhir: 5.0, rating: 'Istimewa',
    },
  });

  console.log(`periode ${periode.kode}`);
  console.log('data uji: 1 DRAFT tanpa nilai (Zzz Kosong) + 1 FINAL nilai 5,00 (Aaa Bernilai)\n');

  for (const opsi of [
    { label: "SEKARANG: orderBy { nilaiAkhir: 'desc' }", order: [{ nilaiAkhir: 'desc' as const }] },
    { label: "USULAN: orderBy { nilaiAkhir: { sort: 'desc', nulls: 'last' } }", order: [{ nilaiAkhir: { sort: 'desc' as const, nulls: 'last' as const } }] },
  ]) {
    const a = await prisma.penilaian.findMany({
      where: { periodeId: periode.id, pegawai: { cabangId: spv.cabangId } },
      orderBy: opsi.order,
      select: { nilaiAkhir: true, pegawai: { select: { nama: true } } },
    });
    console.log(`${opsi.label}`);
    a.forEach((x, i) => console.log(`   ${i + 1}. ${x.pegawai.nama} = ${x.nilaiAkhir ?? 'NULL'}`));
    console.log(`   → baris pertama adalah yang BERNILAI? ${a[0].nilaiAkhir !== null ? 'YA (benar)' : 'TIDAK — NULL menyerobot'}\n`);
  }

  await bersihkan();
  console.log('✓ data uji dibersihkan');
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await bersihkan().catch(() => {});
  process.exit(1);
});
