import { prisma } from '@/lib/db';
import type { PegawaiSesi } from '@/lib/auth';
import { pilihPeriodeRelevan } from '@/lib/sip/periode-aktif';
import { boleh } from '@/lib/sip/akses';

/**
 * Pengingat periode: apa yang belum selesai sebelum periode berjalan ditutup.
 *
 * Dipakai bersama oleh panel di `/penilaian` dan lonceng di bilah atas, supaya
 * kedua tempat tidak pernah berbeda hitungan. Semua hitungan dilakukan di
 * server (halaman), bukan di komponen klien — jumlahnya menyentuh banyak tabel.
 *
 * Prinsip: **jangan menampilkan apa pun kalau tidak ada yang perlu dikerjakan.**
 * Panel peringatan yang menyala terus-menerus akan diabaikan, dan itu lebih
 * buruk daripada tidak ada panel.
 */

export type JenisPengingat = 'terlambat' | 'segera' | 'belum-dinilai' | 'menunggu' | 'draft';

export type Pengingat = {
  jenis: JenisPengingat;
  /** 1 = paling mendesak */
  prioritas: number;
  judul: string;
  keterangan: string;
  href?: string;
  jumlah?: number;
};

export type RingkasanPengingat = {
  periode: {
    id: string;
    nama: string;
    tanggalMulai: Date;
    tanggalSelesai: Date;
    dikunci: boolean;
  } | null;
  /** jumlah hari tersisa sampai periode berakhir (0 = hari terakhir, negatif = lewat) */
  sisaHari: number;
  daftar: Pengingat[];
  /** jumlah butir yang perlu ditindak — dipakai lonceng di bilah atas */
  jumlahButir: number;
};

/** selisih hari kalender (bukan selisih jam) antara hari ini dan tanggal akhir */
export function selisihHari(hariIni: Date, tanggal: Date): number {
  const a = new Date(hariIni.getFullYear(), hariIni.getMonth(), hariIni.getDate());
  const b = new Date(tanggal.getFullYear(), tanggal.getMonth(), tanggal.getDate());
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}

/**
 * Ambang "periode hampir ditutup": 2 hari terakhir. Dua hari memberi ruang
 * untuk memotret dan mengisi 13 aspek tanpa menunggu sampai hari terakhir.
 */
export const AMBANG_SEGERA_HARI = 2;

export async function ambilPengingat(
  saya: PegawaiSesi,
  hariIni: Date = new Date()
): Promise<RingkasanPengingat> {
  const kosong: RingkasanPengingat = {
    periode: null,
    sisaHari: 0,
    daftar: [],
    jumlahButir: 0,
  };

  const periode = await pilihPeriodeRelevan(hariIni);
  if (!periode) return kosong;

  const sisaHari = selisihHari(hariIni, periode.tanggalSelesai);
  const daftar: Pengingat[] = [];
  const bolehMenilai = boleh(saya.role, 'menilai');

  // Cakupan petugas mengikuti aturan yang sama dengan halaman /penilaian:
  // admin melihat semua cabang, peran lain hanya cabangnya sendiri.
  const diCabangku = saya.role === 'ADMIN' || saya.role === 'PENGAMAT' ? {} : { cabangId: saya.cabang.id };

  // ===== 1. yang jadi tugas SAYA: petugas belum dinilai =====
  // Hanya dihitung untuk periode yang belum dikunci dan belum lewat — bukan
  // untuk periode arsip, supaya peringatannya tidak berbunyi selamanya.
  if (bolehMenilai && !periode.dikunci && sisaHari >= 0) {
    const [petugas, sudah] = await Promise.all([
      prisma.pegawai.findMany({
        where: { aktif: true, role: 'PEGAWAI', ...diCabangku },
        select: { id: true },
      }),
      prisma.penilaian.findMany({
        where: { periodeId: periode.id, pegawai: diCabangku },
        select: { pegawaiId: true },
      }),
    ]);
    const sudahDinilai = new Set(sudah.map((p) => p.pegawaiId));
    const belum = petugas.filter((p) => !sudahDinilai.has(p.id)).length;

    if (belum > 0) {
      const mendesak = sisaHari <= AMBANG_SEGERA_HARI;
      daftar.push({
        jenis: mendesak ? 'segera' : 'belum-dinilai',
        prioritas: mendesak ? 1 : 3,
        judul: `${belum} petugas belum dinilai`,
        keterangan: mendesak
          ? `Periode ${periode.nama} berakhir dalam ${sisaHari === 0 ? 'hari ini' : `${sisaHari} hari`}.`
          : `Periode ${periode.nama} masih berjalan.`,
        href: '/penilaian',
        jumlah: belum,
      });
    }
  }

  // ===== 2. yang menunggu tindakan saya: DIKIRIM =====
  if (saya.role === 'MANAGER' || saya.role === 'ADMIN') {
    const menunggu = await prisma.penilaian.count({
      where: { periodeId: periode.id, status: 'DIKIRIM', pegawai: diCabangku },
    });
    if (menunggu > 0) {
      daftar.push({
        jenis: 'menunggu',
        prioritas: 2,
        judul: `${menunggu} penilaian menunggu diketahui`,
        keterangan: 'Atasan belum menyatakan mengetahui penilaian yang sudah dikirim.',
        href: '/persetujuan',
        jumlah: menunggu,
      });
    }
  }

  // ===== 3. draft tertinggal di periode yang sudah lewat =====
  if (bolehMenilai && !periode.dikunci && sisaHari < 0) {
    const draft = await prisma.penilaian.count({
      where: { periodeId: periode.id, status: 'DRAFT', pegawai: diCabangku },
    });
    if (draft > 0) {
      daftar.push({
        jenis: 'terlambat',
        prioritas: 1,
        judul: `${draft} penilaian masih berstatus draft`,
        keterangan: `Periode ${periode.nama} sudah berakhir. Kirim atau lengkapi sekarang.`,
        href: '/penilaian',
        jumlah: draft,
      });
    }
  }

  // ===== 4. periode akan dikunci: diingatkan ke seluruh pengguna =====
  if (!periode.dikunci && sisaHari >= 0 && sisaHari <= AMBANG_SEGERA_HARI) {
    daftar.push({
      jenis: 'segera',
      prioritas: 0,
      judul:
        sisaHari === 0
          ? 'Periode ditutup hari ini'
          : `Periode ditutup dalam ${sisaHari} hari`,
      keterangan: `${periode.nama} berakhir ${periode.tanggalSelesai.toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })}. Setelah ditutup, penilaian tidak dapat diubah lagi.`,
      href: bolehMenilai ? '/penilaian' : undefined,
    });
  }

  daftar.sort((a, b) => a.prioritas - b.prioritas);

  return {
    periode: {
      id: periode.id,
      nama: periode.nama,
      tanggalMulai: periode.tanggalMulai,
      tanggalSelesai: periode.tanggalSelesai,
      dikunci: periode.dikunci,
    },
    sisaHari,
    daftar,
    jumlahButir: daftar.filter((d) => d.jenis !== 'segera' || d.prioritas === 0).length,
  };
}
