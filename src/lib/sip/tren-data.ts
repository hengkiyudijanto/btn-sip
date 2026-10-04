import { prisma } from '@/lib/db';
import type { PegawaiSesi } from '@/lib/auth';
import { susunTitik, selisihTerakhir, rataRata, type SeriTren } from '@/lib/sip/tren';
import { boleh } from '@/lib/sip/akses';

/**
 * Ambil data tren penilaian untuk dasbor.
 *
 * Cakupan data mengikuti aturan yang sama dengan halaman lain: admin melihat
 * seluruh cabang, peran lain hanya cabangnya sendiri (dan turunannya untuk
 * manager — manager BTN membawahi cabangnya, bukan hierarki Kanwil).
 *
 * Jumlah periode yang diambil sengaja dibatasi (default 12) supaya dasbor
 * tetap ringan walau database sudah memuat beberapa tahun periode.
 */

const PERIODE_TREN = 12;

/** Kode & nama kategori dari mesin penilaian; dipakai untuk ringkasan per kategori. */
const KATEGORI_RINGKAS = [
  { kode: 'A', nama: 'Penampilan', kolom: 'nilaiPenampilan' as const },
  { kode: 'B', nama: 'Kemampuan', kolom: 'nilaiKemampuan' as const },
  { kode: 'C', nama: 'Sikap', kolom: 'nilaiSikap' as const },
];

export async function ambilTren(saya: PegawaiSesi): Promise<SeriTren[]> {
  const semuaCabang = boleh(saya.role, 'lihat_semua_cabang');
  const diCabangku = semuaCabang ? {} : { cabangId: saya.cabang.id };

  // periode yang benar-benar punya penilaian, terbaru dulu lalu dibalik
  // supaya sumbu X memburuk ke kanan (waktu berjalan ke kanan).
  const periode = await prisma.periode.findMany({
    where: { penilaian: { some: { pegawai: diCabangku } } },
    orderBy: { tanggalMulai: 'desc' },
    take: PERIODE_TREN,
    select: { id: true, nama: true, tanggalMulai: true, tanggalSelesai: true },
  });

  if (periode.length === 0) return [];

  const periodeUrut = [...periode].reverse();
  const ids = periodeUrut.map((p) => p.id);

  const penilaian = await prisma.penilaian.findMany({
    where: { periodeId: { in: ids }, pegawai: diCabangku, nilaiAkhir: { not: null } },
    select: {
      periodeId: true,
      nilaiAkhir: true,
      nilaiPenampilan: true,
      nilaiKemampuan: true,
      nilaiSikap: true,
      pegawaiId: true,
    },
  });

  const perPeriode = new Map<string, typeof penilaian>();
  for (const p of penilaian) {
    if (!perPeriode.has(p.periodeId)) perPeriode.set(p.periodeId, []);
    perPeriode.get(p.periodeId)!.push(p);
  }

  // ===== seri 1: rata-rata unit (admin = seluruh cabang) =====
  // Judulnya sengaja menyebut "per periode": grafik ini bergerak di sumbu
  // waktu, bukan membandingkan antar cabang — dan itu pernah terbaca salah.
  const titikUnit = susunTitik(periodeUrut, perPeriode);
  const seriUnit: SeriTren = {
    judul: (semuaCabang ? 'Rata-rata semua cabang' : `Rata-rata ${saya.cabang.nama}`) + ' per periode',
    keterangan: 'Rata-rata nilai akhir tiap periode penilaian',
    titik: titikUnit,
    rataRata: rataRata(penilaian),
    selisih: selisihTerakhir(titikUnit),
    kategori: KATEGORI_RINGKAS.map((k) => {
      const isi = penilaian.map((p) => p[k.kolom]).filter((v): v is number => v != null);
      return {
        kode: k.kode,
        nama: k.nama,
        nilai: isi.length ? isi.reduce((a, b) => a + b, 0) / isi.length : 0,
      };
    }),
  };

  const seri: SeriTren[] = [seriUnit];

  // ===== seri 2 (cakupan semua): lima cabang dengan penilaian terbanyak =====
  // Peran yang cakupannya satu cabang tidak perlu membandingkan antar cabang.
  if (semuaCabang) {
    const perCabang = new Map<string, typeof penilaian>();
    // perlu peta pegawai → cabang untuk memecah seri per cabang
    const idsPegawai = [...new Set(penilaian.map((p) => p.pegawaiId))];
    const cabangPegawai = new Map(
      (
        await prisma.pegawai.findMany({
          where: { id: { in: idsPegawai } },
          select: { id: true, cabangId: true, cabang: { select: { kode: true, nama: true } } },
        })
      ).map((p) => [p.id, p.cabang])
    );

    const hitungCabang = new Map<string, { kode: string; nama: string; jumlah: number }>();
    for (const p of penilaian) {
      const c = cabangPegawai.get(p.pegawaiId);
      if (!c) continue;
      if (!perCabang.has(c.kode)) perCabang.set(c.kode, []);
      perCabang.get(c.kode)!.push(p);
      const h = hitungCabang.get(c.kode) ?? { kode: c.kode, nama: c.nama, jumlah: 0 };
      h.jumlah += 1;
      hitungCabang.set(c.kode, h);
    }

    for (const [, info] of [...hitungCabang.entries()]
      .sort((a, b) => b[1].jumlah - a[1].jumlah)
      .slice(1, 5)) {
      const baris = perCabang.get(info.kode)!;
      const peta = new Map<string, typeof penilaian>();
      for (const p of baris) {
        if (!peta.has(p.periodeId)) peta.set(p.periodeId, []);
        peta.get(p.periodeId)!.push(p);
      }
      const titik = susunTitik(periodeUrut, peta);
      seri.push({
        judul: `${info.kode} — ${info.nama}`,
        keterangan: `${baris.length} penilaian`,
        titik,
        rataRata: rataRata(baris),
        selisih: selisihTerakhir(titik),
      });
    }
  }

  return seri;
}
