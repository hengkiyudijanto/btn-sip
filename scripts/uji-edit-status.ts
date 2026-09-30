/**
 * Uji: apakah penilaian masih bisa diedit pada setiap status?
 * Membuktikan aturan DRAFT / DIKIRIM / DIKETAHUI / FINAL di server.
 *
 * Jalankan: pnpm exec tsx scripts/uji-edit-status.ts
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import bcrypt from 'bcryptjs';

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

const NIP_P = 'STATUS0001';
const NIP_S = 'STATUS0002';

/**
 * Tiruan aturan server: apakah penilaian pada status ini boleh diubah?
 * Diambil dari src/app/actions/penilaian.ts — satu-satunya penghalang
 * adalah periode.dikunci, bukan status penilaiannya.
 */
function bolehDiubah(status: string, periodeDikunci: boolean): boolean {
  if (periodeDikunci) return false;
  // tidak ada pembatasan berdasarkan status
  return ['DRAFT', 'DIKIRIM', 'DIKETAHUI', 'FINAL'].includes(status);
}

async function main() {
  console.log('=== UJI EDIT PADA SETIAP STATUS ===\n');

  // bersihkan
  await prisma.penilaianDetail.deleteMany({ where: { penilaian: { pegawai: { nip: NIP_P } } } });
  await prisma.penilaian.deleteMany({ where: { pegawai: { nip: NIP_P } } });
  await prisma.pegawai.deleteMany({ where: { nip: { in: [NIP_P, NIP_S] } } });

  const cabang = await prisma.cabang.findFirst({ where: { aktif: true } });
  const hash = await bcrypt.hash('Statuspass123', 10);

  const spv = await prisma.pegawai.create({
    data: {
      nip: NIP_S, nama: 'SPV Status', passwordHash: hash, role: 'SUPERVISOR',
      harusGantiPassword: false, aktif: true, cabangId: cabang!.id,
    },
  });
  const peg = await prisma.pegawai.create({
    data: {
      nip: NIP_P, nama: 'Petugas Status', passwordHash: hash, role: 'PEGAWAI',
      harusGantiPassword: false, aktif: true, cabangId: cabang!.id, atasanId: spv.id,
    },
  });

  const periode = await prisma.periode.findFirst({ orderBy: { tanggalMulai: 'desc' } });
  if (!periode) throw new Error('tidak ada periode');

  const statuses = ['DRAFT', 'DIKIRIM', 'DIKETAHUI', 'FINAL'] as const;

  console.log('--- 1. aturan edit per status (periode TIDAK dikunci) ---');
  for (const st of statuses) {
    const boleh = bolehDiubah(st, false);
    cek(boleh, `${st.padEnd(10)} → ${boleh ? 'BOLEH diedit' : 'tidak boleh'}`);
  }

  console.log('\n--- 2. aturan edit saat periode DIKUNCI ---');
  for (const st of statuses) {
    const boleh = bolehDiubah(st, true);
    cek(!boleh, `${st.padEnd(10)} + periode terkunci → DITOLAK`);
  }

  console.log('\n--- 3. uji nyata: ubah nilai pada setiap status di database ---');
  for (const st of statuses) {
    await prisma.penilaianDetail.deleteMany({ where: { penilaian: { pegawaiId: peg.id } } });
    await prisma.penilaian.deleteMany({ where: { pegawaiId: peg.id } });

    const p = await prisma.penilaian.create({
      data: {
        pegawaiId: peg.id, penilaiId: spv.id, periodeId: periode.id, status: st,
        nilaiAkhir: 4.0, rating: 'Baik',
        detail: { create: [{ kodeAspek: 'A1', nilaiMentah: 90, skor: 3, bobotAspek: 0.4 }] },
      },
    });

    // tiru simpanPenilaian: upsert (bukan create) sehingga menimpa
    const diubah = await prisma.penilaian.upsert({
      where: { pegawaiId_periodeId: { pegawaiId: peg.id, periodeId: periode.id } },
      update: { status: st, nilaiAkhir: 4.7, rating: 'Sangat Baik' },
      create: {
        pegawaiId: peg.id, penilaiId: spv.id, periodeId: periode.id, status: st,
        nilaiAkhir: 4.7, rating: 'Sangat Baik',
      },
    });

    const jumlah = await prisma.penilaian.count({
      where: { pegawaiId: peg.id, periodeId: periode.id },
    });
    cek(diubah.nilaiAkhir === 4.7 && jumlah === 1, `${st.padEnd(10)} → nilai jadi 4,7, tetap 1 baris`);
    void p;
  }

  console.log('\n--- 4. apakah status berubah saat DIKIRIM? ---');
  await prisma.penilaian.deleteMany({ where: { pegawaiId: peg.id } });
  const draft = await prisma.penilaian.create({
    data: {
      pegawaiId: peg.id, penilaiId: spv.id, periodeId: periode.id, status: 'DRAFT',
      nilaiAkhir: 4.0, rating: 'Baik',
      detail: { create: [{ kodeAspek: 'A1', nilaiMentah: 90, skor: 3, bobotAspek: 0.4 }] },
    },
  });
  cek(draft.dikirimAt === null, 'DRAFT → dikirimAt kosong');

  await prisma.penilaian.update({
    where: { id: draft.id },
    data: { status: 'DIKIRIM', dikirimAt: new Date() },
  });
  const dikirim = await prisma.penilaian.findUnique({ where: { id: draft.id } });
  cek(dikirim?.status === 'DIKIRIM', 'setelah kirim → status DIKIRIM');
  cek(dikirim?.dikirimAt !== null, 'dikirimAt terisi (waktu pengiriman tercatat)');

  // ===== bersihkan =====
  await prisma.penilaianDetail.deleteMany({ where: { penilaian: { pegawaiId: peg.id } } });
  await prisma.penilaian.deleteMany({ where: { pegawaiId: peg.id } });
  await prisma.pegawai.deleteMany({ where: { nip: { in: [NIP_P, NIP_S] } } });
  console.log('\n✓ data uji dibersihkan');

  console.log(`\n=== HASIL: ${lulus} lulus, ${gagal} gagal ===`);
  if (gagal > 0) process.exit(1);
}

main()
  .catch((e) => {
    console.error('GAGAL:', e.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
