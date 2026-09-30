'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { pegawaiDariSesi, catatAudit } from '@/lib/auth';

export type HasilCabang = {
  error?: string;
  sukses?: boolean;
  pesan?: string;
  peringatan?: string;
};

async function pastikanAdmin() {
  const saya = await pegawaiDariSesi();
  if (!saya) return { error: 'Sesi habis. Silakan masuk kembali.' as const };
  if (saya.role !== 'ADMIN') return { error: 'Hanya admin yang dapat mengelola cabang.' as const };
  return { saya };
}

const skema = z.object({
  kode: z
    .string()
    .min(1, 'Kode cabang wajib diisi')
    .max(20, 'Kode maksimal 20 karakter')
    .regex(/^[A-Za-z0-9-]+$/, 'Kode hanya boleh huruf, angka, dan tanda hubung'),
  nama: z.string().min(1, 'Nama cabang wajib diisi').max(120),
  alamat: z.string().max(300).optional(),
});

/** Tambah cabang baru. */
export async function tambahCabang(
  _sebelumnya: HasilCabang,
  formData: FormData
): Promise<HasilCabang> {
  const cek = await pastikanAdmin();
  if ('error' in cek) return { error: cek.error };
  const saya = cek.saya;

  const parsed = skema.safeParse({
    kode: String(formData.get('kode') ?? '').trim(),
    nama: String(formData.get('nama') ?? '').trim(),
    alamat: String(formData.get('alamat') ?? '').trim() || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const { kode, nama, alamat } = parsed.data;
  const kodeUpper = kode.toUpperCase();

  const ada = await prisma.cabang.findUnique({ where: { kode: kodeUpper } });
  if (ada) return { error: `Kode cabang ${kodeUpper} sudah dipakai (${ada.nama}).` };

  const cabang = await prisma.cabang.create({
    data: { kode: kodeUpper, nama, alamat },
  });

  await catatAudit({
    pegawaiId: saya.id,
    aksi: 'TAMBAH_CABANG',
    entitas: 'Cabang',
    entitasId: cabang.id,
    dataBaru: { kode: kodeUpper, nama },
  });

  revalidatePath('/cabang');
  revalidatePath('/pegawai');
  return { sukses: true, pesan: `Cabang ${kodeUpper} — ${nama} berhasil ditambahkan.` };
}

/** Ubah nama/alamat cabang. Kode tidak diubah agar tidak memutus data pegawai. */
export async function ubahCabang(
  _sebelumnya: HasilCabang,
  formData: FormData
): Promise<HasilCabang> {
  const cek = await pastikanAdmin();
  if ('error' in cek) return { error: cek.error };
  const saya = cek.saya;

  const id = String(formData.get('id') ?? '');
  const nama = String(formData.get('nama') ?? '').trim();
  const alamat = String(formData.get('alamat') ?? '').trim();

  if (!id) return { error: 'Cabang tidak ditemukan.' };
  if (!nama) return { error: 'Nama cabang wajib diisi.' };

  const lama = await prisma.cabang.findUnique({ where: { id } });
  if (!lama) return { error: 'Cabang tidak ditemukan.' };

  await prisma.cabang.update({ where: { id }, data: { nama, alamat: alamat || null } });

  await catatAudit({
    pegawaiId: saya.id,
    aksi: 'UBAH_CABANG',
    entitas: 'Cabang',
    entitasId: id,
    dataLama: { nama: lama.nama, alamat: lama.alamat },
    dataBaru: { nama, alamat },
  });

  revalidatePath('/cabang');
  revalidatePath('/pegawai');
  return { sukses: true, pesan: `Cabang ${lama.kode} diperbarui.` };
}

/**
 * Hapus cabang. Ditolak kalau masih ada pegawai atau penilaian yang
 * terhubung — supaya data historis tidak ikut hilang.
 */
export async function hapusCabang(
  _sebelumnya: HasilCabang,
  formData: FormData
): Promise<HasilCabang> {
  const cek = await pastikanAdmin();
  if ('error' in cek) return { error: cek.error };
  const saya = cek.saya;

  const id = String(formData.get('id') ?? '');
  const cabang = await prisma.cabang.findUnique({
    where: { id },
    include: { _count: { select: { pegawai: true } } },
  });
  if (!cabang) return { error: 'Cabang tidak ditemukan.' };

  if (cabang._count.pegawai > 0) {
    return {
      error:
        `Cabang ${cabang.kode} masih punya ${cabang._count.pegawai} pegawai. ` +
        'Pindahkan atau nonaktifkan pegawainya dulu, lalu hapus cabang ini.',
    };
  }

  await prisma.cabang.delete({ where: { id } });

  await catatAudit({
    pegawaiId: saya.id,
    aksi: 'HAPUS_CABANG',
    entitas: 'Cabang',
    entitasId: id,
    dataLama: { kode: cabang.kode, nama: cabang.nama },
  });

  revalidatePath('/cabang');
  revalidatePath('/pegawai');
  return { sukses: true, pesan: `Cabang ${cabang.kode} dihapus.` };
}

/** Aktifkan / nonaktifkan cabang. */
export async function ubahStatusCabang(
  _sebelumnya: HasilCabang,
  formData: FormData
): Promise<HasilCabang> {
  const cek = await pastikanAdmin();
  if ('error' in cek) return { error: cek.error };
  const saya = cek.saya;

  const id = String(formData.get('id') ?? '');
  const cabang = await prisma.cabang.findUnique({ where: { id } });
  if (!cabang) return { error: 'Cabang tidak ditemukan.' };

  const baru = !cabang.aktif;
  await prisma.cabang.update({ where: { id }, data: { aktif: baru } });

  await catatAudit({
    pegawaiId: saya.id,
    aksi: baru ? 'AKTIFKAN_CABANG' : 'NONAKTIFKAN_CABANG',
    entitas: 'Cabang',
    entitasId: id,
  });

  revalidatePath('/cabang');
  revalidatePath('/pegawai');
  return {
    sukses: true,
    pesan: `Cabang ${cabang.kode} kini ${baru ? 'aktif' : 'nonaktif'}.`,
  };
}
