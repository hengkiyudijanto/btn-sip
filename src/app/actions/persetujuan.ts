'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db';
import { pegawaiDariSesi, catatAudit } from '@/lib/auth';

export type HasilAksi = { error?: string; sukses?: boolean; pesan?: string };

const BOLEH_MENGETAHUI = new Set(['MANAGER', 'ADMIN']);

/**
 * Atasan/manager menyatakan mengetahui penilaian yang sudah dikirim.
 * Mengubah status DIKIRIM -> DIKETAHUI.
 */
export async function tandaiDiketahui(
  _sebelumnya: HasilAksi,
  formData: FormData
): Promise<HasilAksi> {
  const saya = await pegawaiDariSesi();
  if (!saya) return { error: 'Sesi habis. Silakan masuk kembali.' };
  if (!BOLEH_MENGETAHUI.has(saya.role)) {
    return { error: 'Hanya manager atau admin yang dapat menyatakan mengetahui.' };
  }

  const penilaianId = String(formData.get('penilaianId') ?? '');
  if (!penilaianId) return { error: 'Data penilaian tidak valid.' };

  const p = await prisma.penilaian.findUnique({
    where: { id: penilaianId },
    include: { pegawai: { select: { cabangId: true, nama: true } } },
  });
  if (!p) return { error: 'Penilaian tidak ditemukan.' };

  // Manager hanya untuk cabangnya sendiri
  if (saya.role === 'MANAGER' && p.pegawai.cabangId !== saya.cabang.id) {
    return { error: 'Anda hanya dapat mengetahui penilaian di cabang Anda.' };
  }

  // Manager tidak boleh mengetahui penilaiannya sendiri
  if (p.penilaiId === saya.id && saya.role !== 'ADMIN') {
    return { error: 'Anda tidak dapat menyatakan mengetahui penilaian yang Anda isi sendiri.' };
  }

  if (p.status !== 'DIKIRIM') {
    return {
      error:
        p.status === 'DRAFT'
          ? 'Penilaian belum dikirim oleh penilai.'
          : 'Penilaian sudah diketahui sebelumnya.',
    };
  }

  await prisma.penilaian.update({
    where: { id: penilaianId },
    data: {
      status: 'DIKETAHUI',
      mengetahuiId: saya.id,
      diketahuiAt: new Date(),
    },
  });

  await catatAudit({
    pegawaiId: saya.id,
    aksi: 'MENGETAHUI_PENILAIAN',
    entitas: 'Penilaian',
    entitasId: penilaianId,
    dataBaru: { pegawaiDinilai: p.pegawai.nama, status: 'DIKETAHUI' },
  });

  revalidatePath('/persetujuan');
  revalidatePath('/laporan');
  revalidatePath('/dasbor');
  return { sukses: true, pesan: 'Penilaian ditandai sudah diketahui.' };
}

/**
 * Mengunci penilaian (FINAL) — nilai tidak dapat diubah lagi.
 * Hanya admin.
 */
export async function kunciPenilaian(
  _sebelumnya: HasilAksi,
  formData: FormData
): Promise<HasilAksi> {
  const saya = await pegawaiDariSesi();
  if (!saya) return { error: 'Sesi habis. Silakan masuk kembali.' };
  if (saya.role !== 'ADMIN') return { error: 'Hanya admin yang dapat mengunci penilaian.' };

  const penilaianId = String(formData.get('penilaianId') ?? '');
  const p = await prisma.penilaian.findUnique({ where: { id: penilaianId } });
  if (!p) return { error: 'Penilaian tidak ditemukan.' };
  if (p.status !== 'DIKETAHUI') {
    return { error: 'Hanya penilaian yang sudah diketahui yang dapat dikunci.' };
  }

  await prisma.penilaian.update({
    where: { id: penilaianId },
    data: { status: 'FINAL', finalAt: new Date() },
  });

  await catatAudit({
    pegawaiId: saya.id,
    aksi: 'KUNCI_PENILAIAN',
    entitas: 'Penilaian',
    entitasId: penilaianId,
    dataBaru: { status: 'FINAL' },
  });

  revalidatePath('/persetujuan');
  revalidatePath('/laporan');
  return { sukses: true, pesan: 'Penilaian dikunci.' };
}

/**
 * Mengembalikan penilaian ke penilai untuk revisi.
 * DIKIRIM/DIKETAHUI -> DRAFT, dengan catatan alasan.
 */
export async function kembalikanUntukRevisi(
  _sebelumnya: HasilAksi,
  formData: FormData
): Promise<HasilAksi> {
  const saya = await pegawaiDariSesi();
  if (!saya) return { error: 'Sesi habis. Silakan masuk kembali.' };
  if (!BOLEH_MENGETAHUI.has(saya.role)) {
    return { error: 'Anda tidak berwenang mengembalikan penilaian.' };
  }

  const penilaianId = String(formData.get('penilaianId') ?? '');
  const alasan = String(formData.get('alasan') ?? '').trim();
  if (!alasan) return { error: 'Alasan revisi wajib diisi.' };

  const p = await prisma.penilaian.findUnique({
    where: { id: penilaianId },
    include: { pegawai: { select: { cabangId: true } } },
  });
  if (!p) return { error: 'Penilaian tidak ditemukan.' };

  if (saya.role === 'MANAGER' && p.pegawai.cabangId !== saya.cabang.id) {
    return { error: 'Anda hanya dapat mengembalikan penilaian di cabang Anda.' };
  }
  if (p.status === 'FINAL') {
    return { error: 'Penilaian sudah final dan tidak dapat dikembalikan.' };
  }

  // gabungkan dengan catatan umum yang ada
  const catatanBaru = p.catatanUmum
    ? `${p.catatanUmum}\n\n[Dikembalikan oleh ${saya.nama}]: ${alasan}`
    : `[Dikembalikan oleh ${saya.nama}]: ${alasan}`;

  await prisma.penilaian.update({
    where: { id: penilaianId },
    data: {
      status: 'DRAFT',
      dikirimAt: null,
      diketahuiAt: null,
      mengetahuiId: null,
      catatanUmum: catatanBaru,
    },
  });

  await catatAudit({
    pegawaiId: saya.id,
    aksi: 'KEMBALIKAN_PENILAIAN',
    entitas: 'Penilaian',
    entitasId: penilaianId,
    dataLama: { status: p.status },
    dataBaru: { status: 'DRAFT', alasan },
  });

  revalidatePath('/persetujuan');
  revalidatePath('/penilaian');
  revalidatePath('/laporan');
  return { sukses: true, pesan: 'Penilaian dikembalikan ke penilai untuk revisi.' };
}
