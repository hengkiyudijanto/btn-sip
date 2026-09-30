'use server';

import { revalidatePath } from 'next/cache';
import { pegawaiDariSesi } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { catatAudit } from '@/lib/auth';
import { validasiFotoPenilaian, simpanFotoPenilaian } from '@/lib/sip/foto-penilaian';

export type HasilFotoPenilaian = {
  error?: string;
  sukses?: boolean;
  pesan?: string;
  ukuran?: number;
};

/**
 * Simpan foto pada sebuah penilaian.
 *
 * Foto melekat pada penilaian (per periode), bukan pada pegawai — setiap
 * periode penilaian memerlukan foto baru. Hanya penilai yang bersangkutan
 * atau admin yang boleh mengunggah.
 */
export async function simpanFotoPenilaianAksi(
  _sebelumnya: HasilFotoPenilaian,
  formData: FormData
): Promise<HasilFotoPenilaian> {
  const saya = await pegawaiDariSesi();
  if (!saya) return { error: 'Sesi berakhir. Silakan masuk kembali.' };
  if (saya.harusGantiPassword) return { error: 'Ganti password dulu.' };

  const penilaianId = String(formData.get('penilaianId') ?? '');
  const dataUrl = String(formData.get('dataUrl') ?? '');
  const mime = String(formData.get('mime') ?? 'image/jpeg');
  const byte = Number(formData.get('byte') ?? 0);
  const catatan = String(formData.get('catatan') ?? '');

  if (!penilaianId) return { error: 'Penilaian tidak dikenal.' };

  const p = await prisma.penilaian.findUnique({
    where: { id: penilaianId },
    include: { periode: { select: { dikunci: true, nama: true } } },
  });
  if (!p) return { error: 'Penilaian tidak ditemukan.' };

  // hanya penilai bersangkutan atau admin
  if (p.penilaiId !== saya.id && saya.role !== 'ADMIN') {
    return { error: 'Hanya penilai yang bersangkutan atau admin yang dapat mengunggah foto.' };
  }
  if (p.periode.dikunci) {
    return { error: `Periode ${p.periode.nama} sudah dikunci, foto tidak dapat diubah.` };
  }

  const cek = validasiFotoPenilaian(dataUrl);
  if (!cek.ok) return { error: cek.error };

  try {
    await simpanFotoPenilaian(penilaianId, {
      dataUrl,
      mime,
      byte: byte > 0 ? byte : cek.byte,
      catatan,
    });

    await catatAudit({
      pegawaiId: saya.id,
      aksi: 'SIMPAN_FOTO_PENILAIAN',
      entitas: 'Penilaian',
      entitasId: penilaianId,
      dataBaru: { periode: p.periode.nama, ukuran: byte > 0 ? byte : cek.byte },
    });

    revalidatePath(`/penilaian/${p.pegawaiId}`);
    revalidatePath('/penilaian');
    revalidatePath(`/laporan/${penilaianId}`);

    return {
      sukses: true,
      pesan: 'Foto penilaian tersimpan.',
      ukuran: byte > 0 ? byte : cek.byte,
    };
  } catch (e) {
    console.error('[simpanFotoPenilaianAksi]', e);
    return { error: 'Gagal menyimpan foto. Coba lagi.' };
  }
}

/** Hapus foto penilaian */
export async function hapusFotoPenilaianAksi(
  _sebelumnya: HasilFotoPenilaian,
  formData: FormData
): Promise<HasilFotoPenilaian> {
  const saya = await pegawaiDariSesi();
  if (!saya) return { error: 'Sesi berakhir. Silakan masuk kembali.' };

  const penilaianId = String(formData.get('penilaianId') ?? '');
  if (!penilaianId) return { error: 'Penilaian tidak dikenal.' };

  const p = await prisma.penilaian.findUnique({
    where: { id: penilaianId },
    include: { periode: { select: { dikunci: true, nama: true } } },
  });
  if (!p) return { error: 'Penilaian tidak ditemukan.' };
  if (p.penilaiId !== saya.id && saya.role !== 'ADMIN') {
    return { error: 'Hanya penilai yang bersangkutan atau admin yang dapat menghapus foto.' };
  }
  if (p.periode.dikunci) {
    return { error: `Periode ${p.periode.nama} sudah dikunci.` };
  }
  if (p.status !== 'DRAFT') {
    return {
      error: `Penilaian sudah ${p.status === 'DIKIRIM' ? 'dikirim' : 'diketahui'} dan wajib berfoto. Hapus hanya bisa saat masih draft.`,
    };
  }

  await prisma.penilaian.update({
    where: { id: penilaianId },
    data: {
      fotoData: null,
      fotoMime: null,
      fotoUkuran: null,
      fotoDiperbarui: null,
      fotoCatatan: null,
    },
  });

  await catatAudit({
    pegawaiId: saya.id,
    aksi: 'HAPUS_FOTO_PENILAIAN',
    entitas: 'Penilaian',
    entitasId: penilaianId,
    dataLama: { ukuran: p.fotoUkuran },
  });

  revalidatePath(`/penilaian/${p.pegawaiId}`);
  revalidatePath(`/laporan/${penilaianId}`);

  return { sukses: true, pesan: 'Foto penilaian dihapus.' };
}
