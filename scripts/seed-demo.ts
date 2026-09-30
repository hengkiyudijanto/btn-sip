/**
 * Seed data demo untuk menguji laporan PDF dengan data realistis.
 * Membuat 1 periode, 1 supervisor, 1 manager, dan 3 petugas dengan
 * nilai yang berbeda-beda supaya terlihat variasi rating.
 *
 * Jalankan: pnpm exec tsx scripts/seed-demo.ts
 * Hapus:    pnpm exec tsx scripts/seed-demo.ts --hapus
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import bcrypt from 'bcryptjs';
import { KATEGORI, hitungPenilaian, type InputAspek } from '../src/lib/sip/penilaian';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

const PASSWORD = 'DemoSIP2026';
const NIP_SPV = '90000001';
const NIP_MGR = '90000002';

const PETUGAS = [
  {
    nip: '80000001',
    nama: 'Andi Pratama',
    jabatan: 'TELLER',
    // nilai tinggi → Istimewa
    nilai: { A1: 100, A2: 99, A3: 100, A4: 100, B1: 100, B2: 99, B3: 100, B4: 100, B5: 100, C1: 100, C2: 99, C3: 100, C4: 100 },
  },
  {
    nip: '80000002',
    nama: 'Siti Nurhaliza',
    jabatan: 'CS',
    // nilai menengah → Baik
    nilai: { A1: 92, A2: 90, A3: 95, A4: 88, B1: 88, B2: 93, B3: 91, B4: 89, B5: 92, C1: 94, C2: 90, C3: 85, C4: 92 },
  },
  {
    nip: '80000003',
    nama: 'Budi Santoso',
    jabatan: 'SECURITY',
    // nilai rendah → Cukup/Kurang
    nilai: { A1: 78, A2: 80, A3: 82, A4: 76, B1: 78, B2: 79, B3: 81, B4: 77, B5: 80, C1: 85, C2: 78, C3: 76, C4: 79 },
  },
];

async function hapus() {
  const nips = [NIP_SPV, NIP_MGR, ...PETUGAS.map((p) => p.nip)];
  const pegawai = await prisma.pegawai.findMany({
    where: { nip: { in: nips } },
    select: { id: true },
  });
  const ids = pegawai.map((p) => p.id);
  if (ids.length) {
    const penilaian = await prisma.penilaian.findMany({
      where: { OR: [{ pegawaiId: { in: ids } }, { penilaiId: { in: ids } }] },
      select: { id: true },
    });
    const pids = penilaian.map((x) => x.id);
    if (pids.length) {
      await prisma.penilaianDetail.deleteMany({ where: { penilaianId: { in: pids } } });
      await prisma.penilaian.deleteMany({ where: { id: { in: pids } } });
    }
    await prisma.sesi.deleteMany({ where: { pegawaiId: { in: ids } } });
    await prisma.pegawai.deleteMany({ where: { id: { in: ids } } });
  }
  await prisma.periode.deleteMany({ where: { kode: 'DEMO-W40' } });
  console.log('✓ data demo dihapus');
}

async function main() {
  if (process.argv.includes('--hapus')) return hapus();

  console.log('→ Menyiapkan data demo...');

  const cabang = await prisma.cabang.upsert({
    where: { kode: '0001' },
    update: {},
    create: { kode: '0001', nama: 'Kantor Cabang Jakarta Pusat' },
  });

  // pastikan jabatan ada
  for (const j of [
    { kode: 'TELLER', nama: 'Teller', namaEn: 'Teller' },
    { kode: 'CS', nama: 'Customer Service', namaEn: 'Customer Service' },
    { kode: 'SECURITY', nama: 'Security', namaEn: 'Security' },
  ]) {
    await prisma.jabatan.upsert({ where: { kode: j.kode }, update: {}, create: j });
  }
  const jabatanMap = Object.fromEntries(
    (await prisma.jabatan.findMany()).map((j) => [j.kode, j.id])
  );

  const hash = await bcrypt.hash(PASSWORD, 12);

  const spv = await prisma.pegawai.upsert({
    where: { nip: NIP_SPV },
    update: {},
    create: {
      nip: NIP_SPV,
      nama: 'Dewi Kartika',
      passwordHash: hash,
      role: 'SUPERVISOR',
      harusGantiPassword: false,
      cabangId: cabang.id,
    },
  });

  const mgr = await prisma.pegawai.upsert({
    where: { nip: NIP_MGR },
    update: {},
    create: {
      nip: NIP_MGR,
      nama: 'Hendra Wijaya',
      passwordHash: hash,
      role: 'MANAGER',
      harusGantiPassword: false,
      cabangId: cabang.id,
    },
  });
  console.log('  ok  supervisor:', spv.nama, '| manager:', mgr.nama);

  const periode = await prisma.periode.upsert({
    where: { kode: 'DEMO-W40' },
    update: {},
    create: {
      kode: 'DEMO-W40',
      nama: 'Minggu ke-40',
      tanggalMulai: new Date('2026-09-29T00:00:00Z'),
      tanggalSelesai: new Date('2026-10-05T23:59:59Z'),
      aktif: true,
    },
  });
  console.log('  ok  periode:', periode.nama);

  for (const pt of PETUGAS) {
    const peg = await prisma.pegawai.upsert({
      where: { nip: pt.nip },
      update: {},
      create: {
        nip: pt.nip,
        nama: pt.nama,
        passwordHash: hash,
        role: 'PEGAWAI',
        harusGantiPassword: false,
        cabangId: cabang.id,
        jabatanId: jabatanMap[pt.jabatan],
        atasanId: spv.id,
      },
    });

    const input: InputAspek[] = Object.entries(pt.nilai).map(([kode, nilai]) => ({
      kode,
      nilai: nilai as number,
    }));

    // Konversi angka 0-100 ke skor 1-5 (tabel resmi), baru dihitung.
    const skorPerAspek: Record<string, number> = Object.fromEntries(
      input.map((x) => [
        x.kode,
        x.nilai >= 99 ? 5 : x.nilai >= 92 ? 4 : x.nilai >= 81 ? 3 : x.nilai >= 76 ? 2 : 1,
      ])
    );

    const hasil = hitungPenilaian(
      input.map((x) => ({ kode: x.kode, nilai: skorPerAspek[x.kode] }))
    );

    const detail = Object.entries(pt.nilai).map(([kode, nilai]) => {
      const def = KATEGORI.flatMap((k) => k.aspek).find((a) => a.kode === kode)!;
      const n = nilai as number;
      const skor = n >= 99 ? 5 : n >= 92 ? 4 : n >= 81 ? 3 : n >= 76 ? 2 : 1;
      return {
        kodeAspek: kode,
        nilaiMentah: n,
        skor,
        bobotAspek: def.bobot,
        catatan:
          kode === 'A1' && skor < 5
            ? 'Dasi kurang rapi saat jam sibuk'
            : kode === 'B2' && skor < 5
              ? 'Perlu penguatan tahapan verifikasi'
              : null,
      };
    });

    const ada = await prisma.penilaian.findUnique({
      where: { pegawaiId_periodeId: { pegawaiId: peg.id, periodeId: periode.id } },
    });
    if (ada) {
      await prisma.penilaianDetail.deleteMany({ where: { penilaianId: ada.id } });
      await prisma.penilaian.delete({ where: { id: ada.id } });
    }

    await prisma.penilaian.create({
      data: {
        pegawaiId: peg.id,
        penilaiId: spv.id,
        mengetahuiId: mgr.id,
        periodeId: periode.id,
        status: 'DIKETAHUI',
        diketahuiAt: new Date(),
        nilaiPenampilan: hasil.kategori.find((k) => k.kode === 'A')!.nilai,
        nilaiKemampuan: hasil.kategori.find((k) => k.kode === 'B')!.nilai,
        nilaiSikap: hasil.kategori.find((k) => k.kode === 'C')!.nilai,
        nilaiAkhir: hasil.nilaiAkhir,
        rating: hasil.rating.label,
        bobotTersimpan: JSON.parse(JSON.stringify(KATEGORI)),
        catatanUmum:
          hasil.rating.label === 'Istimewa'
            ? 'Kinerja sangat memuaskan. Pertahankan konsistensi dan dapat dijadikan contoh bagi rekan kerja.'
            : hasil.rating.label === 'Baik'
              ? 'Kinerja baik. Perlu peningkatan pada ketelitian dan konsistensi tata bahasa.'
              : 'Perlu pembinaan pada aspek kerapihan dan alur pelayanan. Akan dilakukan pendampingan.',
        detail: { create: detail },
      },
    });

    console.log(
      `  ok  ${pt.nama.padEnd(18)} → ${hasil.nilaiAkhir.toFixed(2)} (${hasil.rating.label})`
    );
  }

  console.log('\n✅ Data demo siap. Login:');
  console.log(`   Supervisor : ${NIP_SPV} / ${PASSWORD}`);
  console.log(`   Manager    : ${NIP_MGR} / ${PASSWORD}`);
  console.log(`   Petugas    : ${PETUGAS[0].nip} / ${PASSWORD}`);
}

main()
  .catch((e) => {
    console.error('❌ GAGAL:', e.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
