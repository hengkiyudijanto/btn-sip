/**
 * Ekspor data ranking ke JSON untuk dibuatkan PPTX.
 *
 * Filter sesuai permintaan user: jenis kantor, periode, posisi yang dinilai.
 * Setiap kombinasi unit+posisi menjadi satu slide.
 *
 * Jalankan:
 *   pnpm exec tsx scripts/ekspor-ranking-pptx.ts \
 *     --periode <periodeId> [--jenis KC|KCP|KANWIL] [--cabang <kode>] \
 *     [--posisi TELLER] [--keluaran ranking.json]
 */
import 'dotenv/config';
import { writeFileSync } from 'node:fs';
import { PrismaClient, JenisCabang } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { kumpulkanTurunan } from '../src/lib/sip/hierarki';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

/** Ambil argumen --nama nilai */
function arg(nama: string): string | undefined {
  const i = process.argv.indexOf(`--${nama}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

/** Kategori dari nilai akhir 0-5 (mengikuti ambang rubrik BTN). */
function kategori(nilai: number): string {
  if (nilai >= 4.8) return 'Istimewa';
  if (nilai >= 4.6) return 'Sangat Baik';
  if (nilai >= 4.0) return 'Baik';
  if (nilai >= 3.6) return 'Cukup';
  return 'Kurang';
}

async function main() {
  const periodeId = arg('periode');
  if (!periodeId) {
    console.error('wajib: --periode <periodeId>');
    process.exit(1);
  }

  const periode = await prisma.periode.findUnique({ where: { id: periodeId } });
  if (!periode) {
    console.error(`periode tidak ditemukan: ${periodeId}`);
    process.exit(1);
  }

  const jenis = arg('jenis') as JenisCabang | undefined;
  const kodeCabang = arg('cabang');
  const posisi = arg('posisi');

  // ---- tentukan cabang yang ikut (mengikuti hierarki) ----
  let cabangIds: string[] | undefined;
  let unitLabel = 'Semua unit';

  if (kodeCabang) {
    const cabang = await prisma.cabang.findUnique({ where: { kode: kodeCabang } });
    if (!cabang) {
      console.error(`cabang tidak ditemukan: ${kodeCabang}`);
      process.exit(1);
    }
    const semua = await prisma.cabang.findMany({
      select: { id: true, kode: true, nama: true, indukId: true, jenis: true },
    });
    // laporan mencakup turunan (Kanwil mencakup KC, KC mencakup KCP)
    const turunan = kumpulkanTurunan(cabang.id, semua);
    cabangIds = [cabang.id, ...turunan];
    unitLabel = `${cabang.kode} ${cabang.nama}`;
  } else if (jenis) {
    const daftar = await prisma.cabang.findMany({
      where: { jenis },
      select: { id: true },
    });
    cabangIds = daftar.map((c) => c.id);
    const label: Record<string, string> = {
      KANWIL: 'Semua Kanwil', KC: 'Semua KC', KCP: 'Semua KCP',
    };
    unitLabel = label[jenis] ?? `Jenis ${jenis}`;
  }

  const penilaian = await prisma.penilaian.findMany({
    where: {
      periodeId,
      pegawai: cabangIds ? { cabangId: { in: cabangIds } } : undefined,
      ...(posisi ? { pegawai: { jabatan: { kode: posisi } } } : {}),
    },
    select: {
      nilaiAkhir: true,
      fotoData: true,
      pegawai: {
        select: {
          nama: true, nip: true,
          jabatan: { select: { kode: true, nama: true } },
          cabang: { select: { kode: true, nama: true, jenis: true } },
        },
      },
    },
  });

  // ---- kelompokkan per cabang + jabatan (satu slide per kelompok) ----
  type Baris = {
    nama: string; nilai: number; kategori: string; foto: string | null;
  };
  const kelompok = new Map<string, {
    unit: string; posisi: string; baris: Baris[];
  }>();

  for (const p of penilaian) {
    if (p.nilaiAkhir === null) continue;
    const jabatan = p.pegawai.jabatan?.nama ?? 'Tanpa jabatan';
    const kunci = `${p.pegawai.cabang.kode}|${jabatan}`;
    if (!kelompok.has(kunci)) {
      kelompok.set(kunci, {
        unit: `${p.pegawai.cabang.kode} ${p.pegawai.cabang.nama}`,
        posisi: jabatan,
        baris: [],
      });
    }
    // foto: ambil isi base64 saja (tanpa awalan data URL)
    let foto: string | null = null;
    if (p.fotoData) {
      const koma = p.fotoData.indexOf(',');
      if (koma > 0) foto = p.fotoData.slice(koma + 1);
    }
    kelompok.get(kunci)!.baris.push({
      nama: p.pegawai.nama,
      nilai: Number(p.nilaiAkhir),
      kategori: kategori(Number(p.nilaiAkhir)),
      foto,
    });
  }

  // urutkan: dalam kelompok dari nilai tertinggi; kelompok dari unit lalu posisi
  const daftarKelompok = [...kelompok.values()]
    .map((k) => ({
      ...k,
      baris: k.baris.sort((a, b) => b.nilai - a.nilai),
    }))
    .sort((a, b) =>
      a.unit === b.unit
        ? a.posisi.localeCompare(b.posisi)
        : a.unit.localeCompare(b.unit)
    );

  const posisiLabel = posisi
    ? (daftarKelompok[0]?.posisi ?? posisi)
    : 'Semua posisi';

  const keluaran = {
    unit: unitLabel,
    posisi: posisiLabel,
    periode: periode.nama,
    jenisKantor: jenis ? `Jenis ${jenis}` : 'Semua jenis',
    jumlahPeserta: penilaian.filter((p) => p.nilaiAkhir !== null).length,
    kelompok: daftarKelompok,
  };

  const berkas = arg('keluaran') ?? 'ranking.json';
  writeFileSync(berkas, JSON.stringify(keluaran), 'utf-8');

  console.log(`=== DATA RANKING ===`);
  console.log(`  unit        : ${keluaran.unit}`);
  console.log(`  posisi      : ${keluaran.posisi}`);
  console.log(`  periode     : ${keluaran.periode}`);
  console.log(`  peserta     : ${keluaran.jumlahPeserta}`);
  console.log(`  slide       : ${daftarKelompok.length} kelompok`);
  for (const k of daftarKelompok) {
    console.log(`    - ${k.unit} / ${k.posisi}: ${k.baris.length} orang`);
    for (const b of k.baris) {
      console.log(
        `        ${b.nama.padEnd(24)} ${b.nilai.toFixed(2)}  ${b.kategori}` +
          `${b.foto ? '  (ada foto)' : ''}`
      );
    }
  }
  console.log(`\n  berkas: ${berkas}`);
}

main()
  .catch((e) => { console.error('GAGAL:', e.message); process.exit(1); })
  .finally(() => prisma.$disconnect());
