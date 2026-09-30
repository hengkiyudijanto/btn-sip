import { prisma } from '@/lib/db';
import type { Periode } from '@prisma/client';

/**
 * Memilih periode yang paling relevan untuk "sekarang".
 *
 * Sebelumnya halaman penilaian memakai `orderBy: tanggalMulai desc`, yang
 * mengambil periode PALING AKHIR di database. Setelah periode otomatis
 * dibuat untuk beberapa tahun ke depan, itu membuat halaman menampilkan
 * periode Desember 2027 padahal sekarang baru September 2026.
 *
 * Urutan pilihan sekarang:
 *   1. periode yang MEMUAT hari ini (periode berjalan)
 *   2. kalau tidak ada, periode terdekat ke depan yang belum lewat
 *   3. kalau tidak ada, periode terakhir yang sudah lewat
 *
 * Periode yang tidak aktif (dinonaktifkan admin) tidak dipilih, kecuali
 * tidak ada pilihan lain sama sekali.
 */
export async function pilihPeriodeRelevan(tanggal: Date = new Date()): Promise<Periode | null> {
  const hariIni = new Date(tanggal.getFullYear(), tanggal.getMonth(), tanggal.getDate());

  // 1. periode berjalan
  const berjalan = await prisma.periode.findFirst({
    where: {
      aktif: true,
      tanggalMulai: { lte: hariIni },
      tanggalSelesai: { gte: hariIni },
    },
    orderBy: { tanggalMulai: 'desc' },
  });
  if (berjalan) return berjalan;

  // 2. periode terdekat ke depan
  const keDepan = await prisma.periode.findFirst({
    where: { aktif: true, tanggalMulai: { gt: hariIni } },
    orderBy: { tanggalMulai: 'asc' },
  });
  if (keDepan) return keDepan;

  // 3. periode terakhir yang sudah lewat
  const keBelakang = await prisma.periode.findFirst({
    where: { aktif: true, tanggalSelesai: { lt: hariIni } },
    orderBy: { tanggalSelesai: 'desc' },
  });
  if (keBelakang) return keBelakang;

  // 4. cadangan terakhir: periode apa pun yang ada
  return prisma.periode.findFirst({ orderBy: { tanggalMulai: 'desc' } });
}

/**
 * Ambil daftar periode untuk pemilih (dropdown), diurutkan dari yang
 * terbaru sampai terlama, tapi dibatasi di sekitar hari ini supaya
 * tidak menampilkan ratusan periode dari tahun-tahun jauh.
 */
export async function daftarPeriodeUntukPemilih(tanggal: Date = new Date()) {
  const hariIni = new Date(tanggal.getFullYear(), tanggal.getMonth(), tanggal.getDate());

  const sekitar = await prisma.periode.findMany({
    where: {
      // 3 bulan ke belakang sampai 6 bulan ke depan
      tanggalSelesai: { gte: new Date(hariIni.getFullYear(), hariIni.getMonth() - 3, 1) },
      tanggalMulai: { lte: new Date(hariIni.getFullYear(), hariIni.getMonth() + 6, 31) },
    },
    orderBy: { tanggalMulai: 'desc' },
    select: { id: true, nama: true, aktif: true, tanggalMulai: true, tanggalSelesai: true },
  });

  // kalau jendela itu kosong (mis. data uji di tahun lain), pakai semua
  if (sekitar.length > 0) return sekitar;

  return prisma.periode.findMany({
    orderBy: { tanggalMulai: 'desc' },
    take: 30,
    select: { id: true, nama: true, aktif: true, tanggalMulai: true, tanggalSelesai: true },
  });
}
