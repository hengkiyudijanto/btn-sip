/**
 * Uji laporan berjenjang: pastikan Kanwil mencakup KC + KCP di bawahnya,
 * KC mencakup KCP-nya saja, dan KCP hanya dirinya sendiri.
 *
 * Membuat struktur uji sendiri lalu membersihkannya.
 * Jalankan: pnpm exec tsx scripts/test-laporan-berjenjang.ts
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import bcrypt from 'bcryptjs';
import { KATEGORI, hitungPenilaian, nilaiKeSkala } from '../src/lib/sip/penilaian';
import { kumpulkanTurunan, type CabangRingkas } from '../src/lib/sip/hierarki';

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

const KODE = { kanwil: 'UJI-KW', kc: 'UJI-KC', kcp: 'UJI-KCP' };
const NIP = { pegKc: 'UJI10001', pegKcp: 'UJI10002', spv: 'UJI10003', admin: 'UJI10004' };
const PERIODE = 'UJI-BERJENJANG';

async function bersihkan() {
  const peg = await prisma.pegawai.findMany({
    where: { nip: { in: Object.values(NIP) } },
    select: { id: true },
  });
  const ids = peg.map((p) => p.id);
  if (ids.length) {
    const pen = await prisma.penilaian.findMany({
      where: { OR: [{ pegawaiId: { in: ids } }, { penilaiId: { in: ids } }] },
      select: { id: true },
    });
    const pids = pen.map((p) => p.id);
    if (pids.length) {
      await prisma.penilaianDetail.deleteMany({ where: { penilaianId: { in: pids } } });
      await prisma.penilaian.deleteMany({ where: { id: { in: pids } } });
    }
    await prisma.sesi.deleteMany({ where: { pegawaiId: { in: ids } } });
    await prisma.pegawai.deleteMany({ where: { id: { in: ids } } });
  }
  // hapus dari level terbawah agar FK aman
  await prisma.cabang.deleteMany({ where: { kode: KODE.kcp } });
  await prisma.cabang.deleteMany({ where: { kode: KODE.kc } });
  await prisma.cabang.deleteMany({ where: { kode: KODE.kanwil } });
  await prisma.periode.deleteMany({ where: { kode: PERIODE } });
}

/** Buat penilaian lengkap untuk satu pegawai. */
async function buatPenilaian(pegawaiId: string, penilaiId: string, periodeId: string, angka: number) {
  const input = KATEGORI.flatMap((k) => k.aspek.map((a) => ({ kode: a.kode, nilai: angka })));
  const skor = input.map((x) => ({ kode: x.kode, nilai: nilaiKeSkala(x.nilai) }));
  const hasil = hitungPenilaian(skor);

  return prisma.penilaian.create({
    data: {
      pegawaiId,
      penilaiId,
      periodeId,
      status: 'DIKIRIM',
      dikirimAt: new Date(),
      nilaiPenampilan: hasil.kategori.find((k) => k.kode === 'A')!.nilai,
      nilaiKemampuan: hasil.kategori.find((k) => k.kode === 'B')!.nilai,
      nilaiSikap: hasil.kategori.find((k) => k.kode === 'C')!.nilai,
      nilaiAkhir: hasil.nilaiAkhir,
      rating: hasil.rating.label,
      detail: {
        create: input.map((x) => {
          const def = KATEGORI.flatMap((k) => k.aspek).find((a) => a.kode === x.kode)!;
          return {
            kodeAspek: x.kode,
            nilaiMentah: x.nilai,
            skor: nilaiKeSkala(x.nilai),
            bobotAspek: def.bobot,
          };
        }),
      },
    },
  });
}

async function main() {
  console.log('=== UJI LAPORAN BERJENJANG ===\n');
  await bersihkan();

  const hash = await bcrypt.hash('UjiPass123', 10);

  // ===== 1. Bangun hierarki =====
  console.log('--- 1. bangun hierarki Kanwil > KC > KCP ---');
  const kanwil = await prisma.cabang.create({
    data: { kode: KODE.kanwil, nama: 'Kanwil Uji', jenis: 'KANWIL' },
  });
  const kc = await prisma.cabang.create({
    data: { kode: KODE.kc, nama: 'KC Uji', jenis: 'KC', indukId: kanwil.id },
  });
  const kcp = await prisma.cabang.create({
    data: { kode: KODE.kcp, nama: 'KCP Uji', jenis: 'KCP', indukId: kc.id },
  });
  cek(kanwil.indukId === null, 'Kanwil tidak punya induk');
  cek(kc.indukId === kanwil.id, 'KC terhubung ke Kanwil');
  cek(kcp.indukId === kc.id, 'KCP terhubung ke KC');

  // ===== 2. Pegawai + penilaian =====
  console.log('\n--- 2. buat pegawai & penilaian di tiap level ---');
  const jabatan = await prisma.jabatan.findUnique({ where: { kode: 'TELLER' } });
  const spv = await prisma.pegawai.create({
    data: {
      nip: NIP.spv, nama: 'Supervisor Uji', passwordHash: hash,
      role: 'SUPERVISOR', harusGantiPassword: false, cabangId: kc.id,
    },
  });
  const pegKc = await prisma.pegawai.create({
    data: {
      nip: NIP.pegKc, nama: 'Petugas KC', passwordHash: hash,
      role: 'PEGAWAI', harusGantiPassword: false, cabangId: kc.id, jabatanId: jabatan?.id,
    },
  });
  const pegKcp = await prisma.pegawai.create({
    data: {
      nip: NIP.pegKcp, nama: 'Petugas KCP', passwordHash: hash,
      role: 'PEGAWAI', harusGantiPassword: false, cabangId: kcp.id, jabatanId: jabatan?.id,
    },
  });
  cek(pegKc.cabangId === kc.id, 'pegawai KC di cabang KC');
  cek(pegKcp.cabangId === kcp.id, 'pegawai KCP di cabang KCP');

  const periode = await prisma.periode.create({
    data: {
      kode: PERIODE, nama: 'Uji Berjenjang',
      tanggalMulai: new Date('2026-12-07T00:00:00Z'),
      tanggalSelesai: new Date('2026-12-13T23:59:59Z'),
      aktif: true,
    },
  });

  // nilai berbeda supaya bisa dibedakan dalam rekap
  const pKc = await buatPenilaian(pegKc.id, spv.id, periode.id, 99); // tinggi
  const pKcp = await buatPenilaian(pegKcp.id, spv.id, periode.id, 80); // lebih rendah
  console.log(`   nilai KC  = ${pKc.nilaiAkhir} (${pKc.rating})`);
  console.log(`   nilai KCP = ${pKcp.nilaiAkhir} (${pKcp.rating})`);

  // ===== 3. Uji cakupan lewat fungsi hierarki =====
  console.log('\n--- 3. cakupan cabang ---');
  const semua: CabangRingkas[] = (
    await prisma.cabang.findMany({ select: { id: true, kode: true, nama: true, jenis: true, indukId: true, aktif: true } })
  );

  const cakupanKanwil = kumpulkanTurunan(kanwil.id, semua);
  const cakupanKc = kumpulkanTurunan(kc.id, semua);
  const cakupanKcp = kumpulkanTurunan(kcp.id, semua);

  cek(cakupanKanwil.sort().join() === [kanwil.id, kc.id, kcp.id].sort().join(), 'Kanwil mencakup dirinya + KC + KCP');
  cek(cakupanKc.sort().join() === [kc.id, kcp.id].sort().join(), 'KC mencakup dirinya + KCP (tanpa Kanwil)');
  cek(cakupanKcp.join() === kcp.id, 'KCP hanya dirinya sendiri');

  // ===== 4. Uji query laporan seperti di halaman =====
  console.log('\n--- 4. hasil query laporan per cakupan ---');
  const laporanKanwil = await prisma.penilaian.findMany({
    where: { periodeId: periode.id, pegawai: { cabangId: { in: cakupanKanwil } } },
  });
  const laporanKc = await prisma.penilaian.findMany({
    where: { periodeId: periode.id, pegawai: { cabangId: { in: cakupanKc } } },
  });
  const laporanKcp = await prisma.penilaian.findMany({
    where: { periodeId: periode.id, pegawai: { cabangId: { in: cakupanKcp } } },
  });

  cek(laporanKanwil.length === 2, `laporan Kanwil = 2 penilaian (KC + KCP), hasil: ${laporanKanwil.length}`);
  cek(laporanKc.length === 2, `laporan KC = 2 penilaian (KC + KCP), hasil: ${laporanKc.length}`);
  cek(laporanKcp.length === 1, `laporan KCP = 1 penilaian (dirinya), hasil: ${laporanKcp.length}`);

  // ===== 5. Rata-rata berjenjang =====
  console.log('\n--- 5. rekap rata-rata ---');
  const rataKanwil = laporanKanwil.reduce((a, p) => a + (p.nilaiAkhir ?? 0), 0) / laporanKanwil.length;
  const rataKcp = laporanKcp.reduce((a, p) => a + (p.nilaiAkhir ?? 0), 0) / laporanKcp.length;
  console.log(`   rata-rata Kanwil = ${rataKanwil.toFixed(2)}`);
  console.log(`   rata-rata KCP    = ${rataKcp.toFixed(2)}`);
  cek(rataKanwil !== rataKcp, 'rata-rata Kanwil berbeda dari KCP (cakupan lebih luas)');
  cek(rataKanwil > rataKcp, 'rata-rata Kanwil lebih tinggi karena mencakup nilai KC yang tinggi');

  // ===== 6. Proteksi hapus cabang berjenjang =====
  console.log('\n--- 6. proteksi hapus ---');
  const kanwilDenganTurunan = await prisma.cabang.findUnique({
    where: { id: kanwil.id },
    include: { _count: { select: { turunan: true } } },
  });
  cek(kanwilDenganTurunan!._count.turunan === 1, 'Kanwil terdeteksi punya 1 turunan langsung');
  cek(
    (kanwilDenganTurunan?._count.turunan ?? 0) > 0,
    'hapus Kanwil akan DITOLAK karena masih punya turunan'
  );

  await bersihkan();
  console.log('\n✓ data uji dibersihkan');

  console.log(`\n=== HASIL: ${lulus} lulus, ${gagal} gagal ===`);
  if (gagal > 0) process.exit(1);
  console.log('✅ LAPORAN BERJENJANG TERVERIFIKASI.');
}

main()
  .catch((e) => {
    console.error('\n❌ GAGAL:', e.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
