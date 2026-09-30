import { prisma } from '@/lib/db';
import {
  periodeBulan,
  periodeTahun,
  HARI_PENILAIAN_DEFAULT,
  type HariPeriode,
} from '@/lib/sip/periode';

/**
 * Pengaturan aplikasi & pembuatan periode otomatis.
 *
 * Periode TIDAK lagi dibuat manual satu per satu. Aplikasi menghitung
 * sendiri periode dari aturan resmi (lihat src/lib/sip/periode.ts) dan
 * memasukkannya ke database saat pertama kali dibutuhkan.
 */

export type PengaturanAplikasi = {
  hariPenilaian: number;
  periodeTerbuatSampaiTahun: number | null;
};

/** Ambil pengaturan; buat baris default kalau belum ada */
export async function ambilPengaturan(): Promise<PengaturanAplikasi> {
  const ada = await prisma.pengaturan.findUnique({ where: { id: 'utama' } });
  if (ada) {
    return {
      hariPenilaian: ada.hariPenilaian,
      periodeTerbuatSampaiTahun: ada.periodeTerbuatSampaiTahun,
    };
  }
  const baru = await prisma.pengaturan.create({
    data: { id: 'utama', hariPenilaian: HARI_PENILAIAN_DEFAULT },
  });
  return {
    hariPenilaian: baru.hariPenilaian,
    periodeTerbuatSampaiTahun: baru.periodeTerbuatSampaiTahun,
  };
}

/** Ubah hari penilaian (mis. Rabu -> Senin). Hanya admin. */
export async function ubahHariPenilaian(
  hari: number,
  pegawaiId: string,
  hariLama: number
) {
  if (hari < 0 || hari > 6) throw new Error('Hari penilaian tidak valid.');
  await ambilPengaturan(); // pastikan baris ada
  await prisma.pengaturan.update({
    where: { id: 'utama' },
    data: { hariPenilaian: hari, diperbaruiOleh: pegawaiId },
  });
  await prisma.auditLog.create({
    data: {
      pegawaiId,
      aksi: 'UBAH_HARI_PENILAIAN',
      entitas: 'Pengaturan',
      entitasId: 'utama',
      dataLama: { hariPenilaian: hariLama },
      dataBaru: { hariPenilaian: hari },
    },
  });
}

/**
 * Buat periode dalam database dari hasil perhitungan mesin periode.
 * Aman dijalankan berkali-kali: periode yang sudah ada tidak diganggu
 * (unique constraint pada tanggalMulai+tanggalSelesai mencegah duplikat).
 *
 * @returns jumlah periode yang benar-benar baru dibuat
 */
export async function buatPeriodeDariMesin(
  daftar: HariPeriode[]
): Promise<{ dibuat: number; dilewati: number }> {
  let dibuat = 0;
  let dilewati = 0;

  for (const p of daftar) {
    const sudahAda = await prisma.periode.findFirst({
      where: { tanggalMulai: p.mulai, tanggalSelesai: p.selesai },
      select: { id: true },
    });
    if (sudahAda) {
      dilewati++;
      continue;
    }

    // kode bisa bentrok kalau periode lama memakai kode ISO (mis. "2026-W40");
    // pastikan kode unik dengan menambahkan akhiran bila perlu
    let kode = p.kode;
    let n = 2;
    while (await prisma.periode.findUnique({ where: { kode }, select: { id: true } })) {
      kode = `${p.kode}-${n}`;
      n++;
    }

    await prisma.periode.create({
      data: {
        kode,
        nama: p.nama,
        tanggalMulai: p.mulai,
        tanggalSelesai: p.selesai,
        aktif: true,
      },
    });
    dibuat++;
  }

  return { dibuat, dilewati };
}

/**
 * Pastikan periode untuk satu tahun sudah ada di database.
 * Dipanggil otomatis saat aplikasi diakses.
 */
export async function pastikanPeriodeTahun(tahun: number) {
  const { hariPenilaian, periodeTerbuatSampaiTahun } = await ambilPengaturan();

  if (periodeTerbuatSampaiTahun !== null && periodeTerbuatSampaiTahun >= tahun) {
    return { dibuat: 0, dilewati: 0, dilewatiKarenaSudah: true };
  }

  const daftar = periodeTahun(tahun, hariPenilaian);
  const hasil = await buatPeriodeDariMesin(daftar);

  await prisma.pengaturan.update({
    where: { id: 'utama' },
    data: { periodeTerbuatSampaiTahun: tahun },
  });

  return { ...hasil, dilewatiKarenaSudah: false };
}

/**
 * Pastikan periode untuk bulan yang memuat tanggal tertentu sudah ada.
 * Dipakai pada halaman yang butuh periode berjalan.
 */
export async function pastikanPeriodeBulan(tanggal: Date = new Date()) {
  const { hariPenilaian } = await ambilPengaturan();
  const tahun = tanggal.getFullYear();
  const bulan = tanggal.getMonth() + 1;

  const adaBulanIni = await prisma.periode.count({
    where: {
      tanggalMulai: { gte: new Date(tahun, bulan - 1, 1) },
      tanggalSelesai: { lte: new Date(tahun, bulan - 1, 28, 23, 59, 59) },
    },
  });
  if (adaBulanIni > 0) return { dibuat: 0, dilewati: 0 };

  return buatPeriodeDariMesin(periodeBulan(tahun, bulan, hariPenilaian));
}

/** Periode yang sedang berjalan (memuat hari ini) */
export async function periodeBerjalan(tanggal: Date = new Date()) {
  const t = new Date(tanggal.getFullYear(), tanggal.getMonth(), tanggal.getDate());
  return prisma.periode.findFirst({
    where: { tanggalMulai: { lte: t }, tanggalSelesai: { gte: t } },
    orderBy: { tanggalMulai: 'desc' },
  });
}
