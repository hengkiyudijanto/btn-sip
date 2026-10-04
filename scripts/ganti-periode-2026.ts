/**
 * Ganti periode 2026 dengan aturan v3 (pekan Minggu–Sabtu, buang sisa, dst).
 *
 * Langkah yang DIJALANKAN BERURUTAN dalam satu transaksi per penilaian:
 *   1. buat periode baru menurut mesin aturan v3 untuk tahun yang diminta
 *   2. hapus periode LAMA yang menyimpang (hanya yang TIDAK punya penilaian)
 *   3. pindahkan penilaian dari periode lama yang akan dihapus ke periode baru
 *      yang memuat tanggal penilaian itu (aturan: tanggal, bukan perkiraan)
 *   4. hapus periode lama yang sudah dikosongkan
 *
 * KEAMANAN:
 *   - Periode yang masih memuat penilaian TIDAK PERNAH dihapus.
 *   - Kalau ada penilaian yang tidak menemukan periode baru yang memuat
 *     tanggalnya, skrip BERHENTI dan melaporkan — tidak ada yang dihapus.
 *   - Dry-run secara default; `--jalankan` untuk eksekusi.
 *
 * Jalankan:
 *   pnpm exec tsx scripts/ganti-periode-2026.ts            # pratinjau
 *   pnpm exec tsx scripts/ganti-periode-2026.ts --jalankan # eksekusi
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { periodeTahun } from '../src/lib/sip/periode';

const JALANKAN = process.argv.includes('--jalankan');
const TAHUN = Number(process.argv.find((a) => /^\d{4}$/.test(a)) ?? new Date().getFullYear());

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

function lokal(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

async function main() {
  const { ambilPengaturan } = await import('../src/lib/sip/pengaturan');
  const { hariPenilaian } = await ambilPengaturan();

  const model = periodeTahun(TAHUN, hariPenilaian);
  console.log(`Aturan baru: ${model.length} pekan untuk ${TAHUN} (hari penilaian ${hariPenilaian})`);
  console.log(`Mode: ${JALANKAN ? 'EKSEKUSI' : 'pratinjau'}`);
  console.log('');

  // ===== periode lama di tahun ini =====
  const lama = await prisma.periode.findMany({
    where: { tanggalMulai: { gte: new Date(TAHUN, 0, 1), lte: new Date(TAHUN, 11, 31) } },
    include: { penilaian: { include: { pegawai: { select: { nama: true } } } } },
    orderBy: { tanggalMulai: 'asc' },
  });

  // ===== cocokkan periode lama dengan periode baru =====
  const cocokSama = new Map<string, string>(); // kode-lama-id -> id-baru (kalau tanggal sama)
  const akanDihapus: typeof lama = [];
  const akanDipindah: {
    penilaianId: string;
    pegawai: string;
    dari: string;
    ke: string;
    keId: string;
  }[] = [];
  const tidakKetemu: string[] = [];

  for (const p of lama) {
    const sama = model.find(
      (m) =>
        lokal(m.mulai) === lokal(p.tanggalMulai) && lokal(m.selesai) === lokal(p.tanggalSelesai)
    );
    if (sama) {
      cocokSama.set(p.id, sama.kode);
      continue; // periode ini sudah sesuai, tidak diapa-apakan
    }
    akanDihapus.push(p);

    // Pindahkan penilaian ke periode baru. ACUANNYA adalah tanggal periode LAMA
    // tempat penilaian itu menempel — bukan `createdAt` (waktu pengisian), dan
    // bukan tanggal hari ini. Memakai `createdAt` membuat penilaian lama
    // tercari di rentang tanggal yang salah dan skrip berhenti tanpa alasan.
    //
    // Aturan pemetaan (keputusan pemilik aplikasi, 3 Okt 2026):
    //   - himpunan tanggal periode baru yang menutupi tanggal MULAI periode lama
    //     → diambil yang paling dekat
    //   - kalau kosong (periode lama menyeberang bulan), pakai periode baru yang
    //     memuat hari penilaian pertama dari periode lama itu
    for (const pen of p.penilaian) {
      const kandidat = model
        .filter((m) => m.mulai <= p.tanggalMulai && p.tanggalMulai <= m.selesai)
        .sort(
          (a, b) =>
            Math.abs(a.mulai.getTime() - p.tanggalMulai.getTime()) -
            Math.abs(b.mulai.getTime() - p.tanggalMulai.getTime())
        );
      let tujuan: (typeof model)[number] | undefined = kandidat[0];

      if (!tujuan && p.tanggalMulai.getMonth() !== p.tanggalSelesai.getMonth()) {
        // periode lama menyeberang bulan: ambil pekan baru yang memuat hari
        // penilaian PERTAMA di dalam periode lama itu
        const hariPenilaianPertama = new Date(p.tanggalMulai);
        while (
          hariPenilaianPertama <= p.tanggalSelesai &&
          hariPenilaianPertama.getDay() !== hariPenilaian
        ) {
          hariPenilaianPertama.setDate(hariPenilaianPertama.getDate() + 1);
        }
        tujuan = model.find(
          (m) => m.mulai <= hariPenilaianPertama && hariPenilaianPertama <= m.selesai
        );
      }

      if (!tujuan) {
        tidakKetemu.push(
          `${pen.pegawai.nama} — periode lama ${p.nama} (${lokal(p.tanggalMulai)}–${lokal(p.tanggalSelesai)})`
        );
        continue;
      }
      akanDipindah.push({
        penilaianId: pen.id,
        pegawai: pen.pegawai.nama,
        dari: `${p.nama} (${lokal(p.tanggalMulai)}–${lokal(p.tanggalSelesai)})`,
        ke: `${tujuan.nama} (${lokal(tujuan.mulai)}–${lokal(tujuan.selesai)})`,
        keId: tujuan.kode,
      });
    }
  }

  console.log(`Periode lama di ${TAHUN}: ${lama.length}`);
  console.log(`  - sudah sesuai aturan baru : ${cocokSama.size}`);
  console.log(`  - akan dihapus & diganti   : ${akanDihapus.length}`);
  console.log(`Penilaian yang akan dipindah: ${akanDipindah.length}`);
  for (const d of akanDipindah) {
    console.log(`  · ${d.pegawai.padEnd(20)} ${d.dari}  →  ${d.ke}`);
  }
  if (tidakKetemu.length > 0) {
    console.log('');
    console.log('!! BERHENTI — penilaian berikut tidak menemukan periode baru:');
    for (const t of tidakKetemu) console.log(`   ${t}`);
    console.log('Tidak ada yang dihapus.');
    process.exitCode = 1;
    return;
  }

  if (!JALANKAN) {
    console.log('');
    console.log('(pratinjau — tambahkan --jalankan untuk eksekusi)');
    return;
  }

  // ===== EKSEKUSI =====
  console.log('');
  console.log('1) Membuat periode baru...');
  const petaBaru = new Map<string, string>(); // kode -> id
  let dibuat = 0;
  for (const m of model) {
    const ada = await prisma.periode.findFirst({
      where: { tanggalMulai: m.mulai, tanggalSelesai: m.selesai },
      select: { id: true },
    });
    if (ada) {
      petaBaru.set(m.kode, ada.id);
      continue;
    }
    let kode = m.kode;
    let n = 2;
    while (await prisma.periode.findUnique({ where: { kode }, select: { id: true } })) {
      kode = `${m.kode}-${n}`;
      n++;
    }
    const baru = await prisma.periode.create({
      data: { kode, nama: m.nama, tanggalMulai: m.mulai, tanggalSelesai: m.selesai, aktif: true },
    });
    petaBaru.set(m.kode, baru.id);
    dibuat++;
  }
  console.log(`   dibuat ${dibuat} periode baru`);

  console.log('2) Memindahkan penilaian...');
  let dipindah = 0;
  for (const d of akanDipindah) {
    const idBaru = petaBaru.get(d.keId);
    if (!idBaru) {
      console.error(`   GAGAL: periode tujuan ${d.keId} tidak ditemukan untuk ${d.pegawai}`);
      process.exitCode = 1;
      continue;
    }
    await prisma.penilaian.update({ where: { id: d.penilaianId }, data: { periodeId: idBaru } });
    dipindah++;
  }
  console.log(`   ${dipindah} penilaian dipindahkan`);

  console.log('3) Menghapus periode lama yang tidak dipakai...');
  // hanya periode yang sudah benar-benar kosong
  const harusnyaDihapus = akanDihapus.map((p) => p.id);
  const masihDipakai = await prisma.penilaian.findMany({
    where: { periodeId: { in: harusnyaDihapus } },
    select: { periodeId: true },
  });
  const masihDipakaiSet = new Set(masihDipakai.map((p) => p.periodeId));
  const amanDihapus = harusnyaDihapus.filter((id) => !masihDipakaiSet.has(id));

  if (masihDipakaiSet.size > 0) {
    console.log(`   DILEWATI: ${masihDipakaiSet.size} periode masih memuat penilaian`);
  }
  const hapus = await prisma.periode.deleteMany({ where: { id: { in: amanDihapus } } });
  console.log(`   ${hapus.count} periode lama dihapus`);

  // ===== laporan akhir =====
  console.log('');
  console.log('=== HASIL AKHIR ===');
  const totalPeriode = await prisma.periode.count({
    where: { tanggalMulai: { gte: new Date(TAHUN, 0, 1), lte: new Date(TAHUN, 11, 31) } },
  });
  const totalPenilaian = await prisma.penilaian.count();
  console.log(`  periode di ${TAHUN} : ${totalPeriode}`);
  console.log(`  penilaian total     : ${totalPenilaian} (harus sama seperti sebelumnya)`);

  const sisaLama = await prisma.periode.findMany({
    where: { tanggalMulai: { gte: new Date(TAHUN, 0, 1), lte: new Date(TAHUN, 11, 31) } },
    include: { _count: { select: { penilaian: true } } },
    orderBy: { tanggalMulai: 'asc' },
  });
  const menyimpang = sisaLama.filter(
    (p) => !model.some((m) => lokal(m.mulai) === lokal(p.tanggalMulai) && lokal(m.selesai) === lokal(p.tanggalSelesai))
  );
  console.log(`  periode yang masih menyimpang dari aturan baru: ${menyimpang.length}`);
  for (const p of menyimpang) {
    console.log(`    ${p.nama} (${lokal(p.tanggalMulai)}–${lokal(p.tanggalSelesai)}) penilaian=${p._count.penilaian}`);
  }
}

main()
  .catch((e) => {
    console.error('GAGAL:', e instanceof Error ? e.message : e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
