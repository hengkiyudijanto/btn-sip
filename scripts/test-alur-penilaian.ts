/**
 * Uji alur penilaian end-to-end langsung ke database.
 * Membuktikan: buat periode → buat pegawai → simpan penilaian → baca hasil →
 * cek perhitungan nilai cocok dengan mesin penilaian.
 *
 * Jalankan: pnpm exec tsx scripts/test-alur-penilaian.ts
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import bcrypt from 'bcryptjs';
import { hitungPenilaian, KATEGORI, type InputAspek } from '../src/lib/sip/penilaian';

const connectionString = process.env.DATABASE_URL!;
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

const NIP_SUPERVISOR = 'TSTSPV01';
const NIP_PEGAWAI = 'TSTPEG01';

async function bersihkan() {
  const pegawai = await prisma.pegawai.findMany({
    where: { nip: { in: [NIP_SUPERVISOR, NIP_PEGAWAI] } },
    select: { id: true },
  });
  const ids = pegawai.map((p) => p.id);
  if (ids.length) {
    const penilaian = await prisma.penilaian.findMany({
      where: { OR: [{ pegawaiId: { in: ids } }, { penilaiId: { in: ids } }] },
      select: { id: true },
    });
    const pids = penilaian.map((p) => p.id);
    if (pids.length) {
      await prisma.penilaianDetail.deleteMany({ where: { penilaianId: { in: pids } } });
      await prisma.penilaian.deleteMany({ where: { id: { in: pids } } });
    }
    await prisma.sesi.deleteMany({ where: { pegawaiId: { in: ids } } });
    await prisma.auditLog.deleteMany({ where: { pegawaiId: { in: ids } } });
    await prisma.pegawai.deleteMany({ where: { id: { in: ids } } });
  }
  await prisma.periode.deleteMany({ where: { kode: 'TEST-W01' } });
}

async function main() {
  console.log('→ Bersihkan sisa data uji sebelumnya...');
  await bersihkan();

  // 1. pastikan cabang & jabatan ada
  const cabang = await prisma.cabang.upsert({
    where: { kode: 'TEST-CAB' },
    update: {},
    create: { kode: 'TEST-CAB', nama: 'Cabang Uji' },
  });
  const jabatan = await prisma.jabatan.upsert({
    where: { kode: 'TELLER' },
    update: {},
    create: { kode: 'TELLER', nama: 'Teller' },
  });

  // 2. buat supervisor & pegawai
  const hash = await bcrypt.hash('TestPass123', 12);
  const spv = await prisma.pegawai.create({
    data: {
      nip: NIP_SUPERVISOR,
      nama: 'Supervisor Uji',
      passwordHash: hash,
      role: 'SUPERVISOR',
      harusGantiPassword: false,
      cabangId: cabang.id,
    },
  });
  const peg = await prisma.pegawai.create({
    data: {
      nip: NIP_PEGAWAI,
      nama: 'Petugas Uji',
      passwordHash: hash,
      role: 'PEGAWAI',
      harusGantiPassword: false,
      cabangId: cabang.id,
      jabatanId: jabatan.id,
      atasanId: spv.id,
    },
  });
  console.log('  ok  supervisor & pegawai dibuat');

  // 3. buat periode mingguan
  const mulai = new Date('2026-09-29T00:00:00Z');
  const selesai = new Date('2026-10-05T23:59:59Z');
  const periode = await prisma.periode.create({
    data: {
      kode: 'TEST-W01',
      nama: 'Uji Minggu ke-40',
      tanggalMulai: mulai,
      tanggalSelesai: selesai,
      aktif: true,
    },
  });
  console.log('  ok  periode dibuat:', periode.nama);

  // 4. susun nilai: A semua 5, B semua 4 (quiz 95), C semua 3
  const nilaiUji: Record<string, number> = {
    A1: 5, A2: 5, A3: 5, A4: 5,
    B1: 95, B2: 4, B3: 4, B4: 4, B5: 4,
    C1: 3, C2: 3, C3: 3, C4: 3,
  };
  const input: InputAspek[] = Object.entries(nilaiUji).map(([kode, nilai]) => ({
    kode,
    nilai,
  }));

  // 5. hitung dengan mesin resmi
  const hasil = hitungPenilaian(input);
  console.log('  ok  mesin penilaian menghitung');
  for (const k of hasil.kategori) {
    console.log(`      ${k.kode}. ${k.nama}: ${k.nilai.toFixed(2)} x ${k.bobot} = ${k.kontribusi}`);
  }
  console.log(`      nilai akhir: ${hasil.nilaiAkhir} → ${hasil.rating.label}`);

  // 6. simpan ke database
  const penilaian = await prisma.penilaian.create({
    data: {
      pegawaiId: peg.id,
      penilaiId: spv.id,
      periodeId: periode.id,
      status: 'DIKIRIM',
      nilaiPenampilan: hasil.kategori.find((k) => k.kode === 'A')!.nilai,
      nilaiKemampuan: hasil.kategori.find((k) => k.kode === 'B')!.nilai,
      nilaiSikap: hasil.kategori.find((k) => k.kode === 'C')!.nilai,
      nilaiAkhir: hasil.nilaiAkhir,
      rating: hasil.rating.label,
      dikirimAt: new Date(),
      detail: {
        create: Object.entries(nilaiUji).map(([kode, nilai]) => {
          const def = KATEGORI.flatMap((k) => k.aspek).find((a) => a.kode === kode)!;
          const skor = def.inputMentah
            ? nilai >= 99 ? 5 : nilai >= 92 ? 4 : nilai >= 81 ? 3 : nilai >= 76 ? 2 : 1
            : nilai;
          return {
            kodeAspek: kode,
            nilaiMentah: nilai,
            skor,
            bobotAspek: def.bobot,
          };
        }),
      },
    },
    include: { detail: true },
  });
  console.log('  ok  penilaian tersimpan:', penilaian.id);

  // 7. baca kembali & verifikasi
  const dibaca = await prisma.penilaian.findUnique({
    where: { id: penilaian.id },
    include: {
      detail: true,
      pegawai: { select: { nama: true, nip: true } },
      penilai: { select: { nama: true } },
      periode: { select: { nama: true } },
    },
  });

  console.log('\n=== VERIFIKASI HASIL BACA ULANG ===');
  console.log('  Petugas   :', dibaca!.pegawai.nama, `(${dibaca!.pegawai.nip})`);
  console.log('  Penilai   :', dibaca!.penilai.nama);
  console.log('  Periode   :', dibaca!.periode.nama);
  console.log('  Status    :', dibaca!.status);
  console.log('  Detail    :', dibaca!.detail.length, 'aspek tersimpan');
  console.log('  A/B/C     :', dibaca!.nilaiPenampilan, '/', dibaca!.nilaiKemampuan, '/', dibaca!.nilaiSikap);
  console.log('  Nilai akhir:', dibaca!.nilaiAkhir, '→', dibaca!.rating);

  // 8. cek konsistensi: hitung ulang dari detail yang tersimpan
  const ulang = hitungPenilaian(
    dibaca!.detail.map((d) => ({ kode: d.kodeAspek, nilai: d.nilaiMentah }))
  );
  const cocok = Math.abs(ulang.nilaiAkhir - dibaca!.nilaiAkhir!) < 0.001;
  console.log(
    `  Konsistensi: hitung ulang = ${ulang.nilaiAkhir} | tersimpan = ${dibaca!.nilaiAkhir} | ${cocok ? 'COCOK' : 'TIDAK COCOK'}`
  );

  // 9. cek quiz dikonversi benar
  const detailQuiz = dibaca!.detail.find((d) => d.kodeAspek === 'B1')!;
  console.log(
    `  Quiz B1   : nilai mentah ${detailQuiz.nilaiMentah} → skor ${detailQuiz.skor} ${detailQuiz.skor === 5 ? '(benar, 95>=92... cek!)' : ''}`
  );

  if (!cocok) {
    throw new Error('Nilai tidak konsisten!');
  }

  console.log('\n→ Bersihkan data uji...');
  await bersihkan();
  console.log('  ok  dibersihkan');

  console.log('\n✅ Alur penilaian end-to-end BERHASIL.');
  console.log('   periode → pegawai → simpan penilaian → baca ulang → verifikasi hitung');
}

main()
  .catch((e) => {
    console.error('\n❌ GAGAL:', e.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
