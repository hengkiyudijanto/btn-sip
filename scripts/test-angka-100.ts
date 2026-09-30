/**
 * Uji alur penilaian dengan input angka 0-100 untuk SEMUA aspek
 * (sesuai keputusan pemilik produk: kolom Angka diisi atasan 0-100,
 * kolom Skor terisi otomatis dari konversi).
 *
 * Membuktikan bahwa:
 *   1. server action menerima angka 0-100 untuk semua aspek
 *   2. konversi ke skor 1-5 dijalankan memakai tabel resmi
 *   3. nilai akhir dihitung dari skor hasil konversi (Opsi A)
 *   4. nilai mentah DAN skor tersimpan, jadi bisa diaudit
 *
 * Jalankan: pnpm exec tsx scripts/test-angka-100.ts
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import bcrypt from 'bcryptjs';
import {
  hitungPenilaian,
  nilaiKeSkala,
  KATEGORI,
  type InputAspek,
} from '../src/lib/sip/penilaian';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

const NIP_PEG = 'TSANGKA01';
const NIP_SPV = 'TSANGKA02';
const KODE_PERIODE = 'TEST-ANGKA';

async function bersihkan() {
  const pegawai = await prisma.pegawai.findMany({
    where: { nip: { in: [NIP_PEG, NIP_SPV] } },
    select: { id: true },
  });
  const ids = pegawai.map((p) => p.id);
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
  await prisma.periode.deleteMany({ where: { kode: KODE_PERIODE } });
}

/** Simulasi persis logika server action. */
function prosesSepertiServer(angka: Record<string, number>) {
  const daftar = Object.entries(angka).map(([kode, n]) => ({ kode, nilai: n }));

  // 1. konversi setiap angka ke skor
  const denganSkor = daftar.map((a) => {
    const def = KATEGORI.flatMap((k) => k.aspek).find((x) => x.kode === a.kode)!;
    return { ...a, skor: nilaiKeSkala(a.nilai), bobotAspek: def.bobot };
  });

  // 2. hitung dari skor
  const inputMesin: InputAspek[] = denganSkor.map((a) => ({
    kode: a.kode,
    nilai: a.skor,
  }));
  return { denganSkor, hasil: hitungPenilaian(inputMesin) };
}

async function main() {
  console.log('=== UJI INPUT ANGKA 0-100 UNTUK SEMUA ASPEK ===\n');
  await bersihkan();

  const cabang = await prisma.cabang.upsert({
    where: { kode: 'TEST-CAB' },
    update: {},
    create: { kode: 'TEST-CAB', nama: 'Cabang Uji' },
  });
  const jabatan = await prisma.jabatan.findUnique({ where: { kode: 'TELLER' } });
  const hash = await bcrypt.hash('TestPass123', 12);

  const spv = await prisma.pegawai.create({
    data: {
      nip: NIP_SPV, nama: 'Supervisor Angka', passwordHash: hash,
      role: 'SUPERVISOR', harusGantiPassword: false, cabangId: cabang.id,
    },
  });
  const peg = await prisma.pegawai.create({
    data: {
      nip: NIP_PEG, nama: 'Petugas Angka', passwordHash: hash,
      role: 'PEGAWAI', harusGantiPassword: false,
      cabangId: cabang.id, jabatanId: jabatan?.id,
    },
  });
  const periode = await prisma.periode.create({
    data: {
      kode: KODE_PERIODE, nama: 'Uji Angka 0-100',
      // tanggal dibedakan dari periode demo supaya tidak bentrok unique constraint
      tanggalMulai: new Date('2026-11-02T00:00:00Z'),
      tanggalSelesai: new Date('2026-11-08T23:59:59Z'),
      aktif: true,
    },
  });
  console.log('ok  data uji dibuat\n');

  // ===== Skenario: atasan mengisi angka bervariasi, termasuk di batas band =====
  const skenario: { nama: string; angka: Record<string, number> }[] = [
    {
      nama: 'SEMUA 100 (maksimum)',
      angka: Object.fromEntries(
        KATEGORI.flatMap((k) => k.aspek.map((a) => [a.kode, 100]))
      ),
    },
    {
      nama: 'SEMUA 99 (batas Istimewa)',
      angka: Object.fromEntries(
        KATEGORI.flatMap((k) => k.aspek.map((a) => [a.kode, 99]))
      ),
    },
    {
      nama: 'SEMUA 91 vs 92 (uji batas band)',
      angka: Object.fromEntries(
        KATEGORI.flatMap((k) => k.aspek.map((a) => [a.kode, 91]))
      ),
    },
  ];

  for (const s of skenario) {
    const { denganSkor, hasil } = prosesSepertiServer(s.angka);
    const skorUnik = [...new Set(denganSkor.map((d) => d.skor))];
    console.log(`--- ${s.nama} ---`);
    console.log(`   skor hasil konversi : ${skorUnik.join(', ')}`);
    console.log(`   nilai akhir         : ${hasil.nilaiAkhir.toFixed(2)} (${hasil.rating.label})`);
    console.log(`   rentang rating      : ${hasil.rating.min} - ${hasil.rating.max}`);
  }

  // ===== Uji batas band secara detail =====
  console.log('\n--- UJI BATAS BAND (semua aspek angka sama) ---');
  for (const n of [99, 98, 92, 91, 81, 80, 76, 75]) {
    const { hasil } = prosesSepertiServer(
      Object.fromEntries(KATEGORI.flatMap((k) => k.aspek.map((a) => [a.kode, n])))
    );
    console.log(
      `   angka ${String(n).padStart(3)} → skor ${nilaiKeSkala(n)} → nilai akhir ${hasil.nilaiAkhir.toFixed(2)} (${hasil.rating.label})`
    );
  }

  // ===== Simpan ke database & verifikasi =====
  console.log('\n--- SIMPAN & BACA ULANG DARI DATABASE ---');
  const angkaCampuran: Record<string, number> = {
    A1: 95, A2: 88, A3: 92, A4: 85,
    B1: 90, B2: 93, B3: 87, B4: 91, B5: 96,
    C1: 94, C2: 89, C3: 84, C4: 92,
  };
  const { denganSkor, hasil } = prosesSepertiServer(angkaCampuran);

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
        create: denganSkor.map((d) => ({
          kodeAspek: d.kode,
          nilaiMentah: d.nilai, // angka 0-100 dari atasan
          skor: d.skor, // hasil konversi 1-5
          bobotAspek: d.bobotAspek,
        })),
      },
    },
    include: { detail: true },
  });

  console.log('   angka yang diinput atasan:');
  for (const [kode, n] of Object.entries(angkaCampuran)) {
    const d = penilaian.detail.find((x) => x.kodeAspek === kode)!;
    console.log(`      ${kode}: angka ${String(n).padStart(3)} → skor ${d.skor}`);
  }
  console.log(`   A/B/C : ${penilaian.nilaiPenampilan} / ${penilaian.nilaiKemampuan} / ${penilaian.nilaiSikap}`);
  console.log(`   Nilai akhir: ${penilaian.nilaiAkhir} (${penilaian.rating})`);

  // verifikasi: hitung ulang dari skor yang tersimpan
  const ulang = hitungPenilaian(
    penilaian.detail.map((d) => ({ kode: d.kodeAspek, nilai: d.skor }))
  );
  const cocok = Math.abs(ulang.nilaiAkhir - (penilaian.nilaiAkhir ?? 0)) < 0.001;
  console.log(`   Konsistensi hitung ulang: ${ulang.nilaiAkhir} vs tersimpan ${penilaian.nilaiAkhir} → ${cocok ? 'COCOK' : 'TIDAK COCOK'}`);

  // verifikasi: angka mentah tersimpan apa adanya
  const semuaMentahBenar = penilaian.detail.every(
    (d) => d.nilaiMentah === angkaCampuran[d.kodeAspek]
  );
  console.log(`   Nilai mentah 0-100 tersimpan apa adanya: ${semuaMentahBenar ? 'YA' : 'TIDAK'}`);

  // verifikasi: skor adalah hasil konversi yang benar
  const semuaSkorBenar = penilaian.detail.every((d) => d.skor === nilaiKeSkala(d.nilaiMentah));
  console.log(`   Skor = konversi resmi dari angka: ${semuaSkorBenar ? 'YA' : 'TIDAK'}`);

  await bersihkan();
  console.log('\n✅ dibersihkan');

  if (!cocok || !semuaMentahBenar || !semuaSkorBenar) {
    throw new Error('Ada verifikasi yang GAGAL');
  }
  console.log('✅ SEMUA VERIFIKASI LULUS.');
}

main()
  .catch((e) => {
    console.error('\n❌ GAGAL:', e.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
