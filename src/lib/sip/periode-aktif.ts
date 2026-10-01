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
 * terbaru sampai terlama.
 *
 * Hanya **tahun berjalan** yang ditampilkan, sama seperti halaman
 * `/periode`. Sebelumnya jendela "3 bulan ke belakang s/d 6 bulan ke
 * depan" dipakai, dan itu membuat dropdown memuat periode tahun depan
 * (mis. Desember 2027) yang tidak pernah terlihat di `/periode` —
 * user bisa memilih periode masa depan tanpa sadar. Aturan periode
 * menentukan periode dibuat otomatis beberapa tahun ke depan, jadi
 * dropdown TIDAK boleh mengambil semuanya.
 *
 * Desember tahun lalu dan Januari tahun depan tetap disertakan supaya
 * penilaian di batas tahun (periode yang menyeberang tahun) masih bisa
 * dipilih. Duplikat dibuang oleh `id`.
 */
export async function daftarPeriodeUntukPemilih(tanggal: Date = new Date()) {
  const pilih = {
    id: true, nama: true, aktif: true, tanggalMulai: true, tanggalSelesai: true,
  } as const;

  const tahun = tanggal.getFullYear();

  const daftar = await prisma.periode.findMany({
    where: {
      // tahun berjalan + Desember tahun lalu + Januari tahun depan
      OR: [
        { tanggalMulai: { gte: new Date(tahun, 0, 1), lte: new Date(tahun, 11, 31, 23, 59, 59) } },
        { tanggalSelesai: { gte: new Date(tahun - 1, 11, 1), lte: new Date(tahun - 1, 11, 31, 23, 59, 59) } },
        { tanggalMulai: { gte: new Date(tahun + 1, 0, 1), lte: new Date(tahun + 1, 0, 31, 23, 59, 59) } },
      ],
    },
    orderBy: { tanggalMulai: 'desc' },
    select: pilih,
  });

  // buang duplikat (periode Des 2025 dan Jan 2026 bisa tertangkap dua syarat)
  const unik = new Map<string, (typeof daftar)[number]>();
  for (const p of daftar) unik.set(p.id, p);
  return [...unik.values()].sort(
    (a, b) => b.tanggalMulai.getTime() - a.tanggalMulai.getTime()
  );
}

/**
 * Daftar periode dikelompokkan per tahun, untuk halaman `/periode` supaya
 * periode tahun lain bisa dilihat tanpa mengubah halaman jadi lintas tahun
 * dalam satu tabel panjang.
 */
export async function daftarPeriodePerTahun() {
  const semua = await prisma.periode.findMany({
    orderBy: [{ tanggalMulai: 'desc' }],
    include: { _count: { select: { penilaian: true } } },
  });

  const perTahun = new Map<number, typeof semua>();
  for (const p of semua) {
    const t = p.tanggalMulai.getFullYear();
    if (!perTahun.has(t)) perTahun.set(t, []);
    perTahun.get(t)!.push(p);
  }

  // tahun terbaru lebih dulu
  return [...perTahun.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([tahun, daftar]) => ({ tahun, daftar }));
}
