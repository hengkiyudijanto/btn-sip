/**
 * PENGINGAT MODUL SOSMED — apa yang menunggu tindakan di modul konten.
 *
 * Terpisah dari pengingat SIP (periode penilaian) karena siklusnya beda:
 * pengingat SIP terikat periode, sedangkan konten berjalan terus.
 *
 * Prinsip yang sama dipegang: **jangan tampilkan apa pun kalau tidak ada yang
 * perlu dikerjakan.**
 */

import { prisma } from '@/lib/db';
import type { PegawaiSesi } from '@/lib/auth';
import { bolehEfek, lihatSemuaKonten } from './akses';
import type { Pengingat } from '@/lib/sip/pengingat';

export async function ambilPengingatSosmed(saya: PegawaiSesi): Promise<Pengingat[]> {
  // Hanya peran yang menyentuh modul ini; pegawai biasa tidak diganggu.
  if (!bolehEfek(saya.role, 'kelola_konten') && !bolehEfek(saya.role, 'setujui_konten')) {
    return [];
  }

  const daftar: Pengingat[] = [];
  const semua = lihatSemuaKonten(saya);

  // ===== 1. menunggu persetujuan SAYA (penyetuju yang ditunjuk) =====
  if (bolehEfek(saya.role, 'setujui_konten')) {
    const menunggu = await prisma.kontenSosmed.count({
      where: { status: 'MENUNGGU', penyetujuId: saya.id },
    });
    if (menunggu > 0) {
      daftar.push({
        jenis: 'menunggu',
        prioritas: 2,
        judul: `${menunggu} konten menunggu persetujuan Anda`,
        keterangan: 'Konten tidak akan terkirim ke TikTok/Instagram sebelum Anda memutuskan.',
        href: '/sosmed/persetujuan',
        jumlah: menunggu,
      });
    }
  }

  // ===== 2. konten SAYA yang diminta revisi =====
  if (bolehEfek(saya.role, 'kelola_konten')) {
    const revisi = await prisma.kontenSosmed.count({
      where: { status: 'REVISI', pembuatId: saya.id },
    });
    if (revisi > 0) {
      daftar.push({
        jenis: 'terlambat',
        prioritas: 1,
        judul: `${revisi} konten Anda perlu direvisi`,
        keterangan: 'Baca catatan penyetuju, perbaiki, lalu ajukan ulang.',
        href: '/sosmed',
        jumlah: revisi,
      });
    }
  }

  // ===== 3. disetujui tapi belum dikirim =====
  const belumKirim = await prisma.kontenSosmed.count({
    where: {
      status: 'DISETUJUI',
      ...(semua ? {} : { pembuatId: saya.id }),
    },
  });
  if (belumKirim > 0 && (bolehEfek(saya.role, 'kelola_konten') || semua)) {
    daftar.push({
      jenis: 'belum-dinilai',
      prioritas: 3,
      judul: `${belumKirim} konten disetujui, belum dikirim`,
      keterangan: 'Konten sudah lolos approval — tekan Kirim untuk mempublikasikan.',
      href: '/sosmed',
      jumlah: belumKirim,
    });
  }

  return daftar;
}
