'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { pegawaiDariSesi, catatAudit } from '@/lib/auth';

export type HasilJabatan = {
  error?: string;
  sukses?: boolean;
  pesan?: string;
};

async function pastikanAdmin() {
  const saya = await pegawaiDariSesi();
  if (!saya) return { error: 'Sesi habis. Silakan masuk kembali.' as const };
  if (saya.role !== 'ADMIN') {
    return { error: 'Hanya admin yang dapat mengelola jabatan.' as const };
  }
  return { saya };
}

/** Kode jabatan: huruf besar, angka, dan garis bawah. */
const skemaKode = z
  .string()
  .trim()
  .min(2, 'Kode minimal 2 karakter')
  .max(24, 'Kode maksimal 24 karakter')
  .regex(/^[A-Z0-9_]+$/, 'Kode hanya boleh huruf besar, angka, dan garis bawah');

const skemaTambah = z.object({
  kode: skemaKode,
  nama: z.string().trim().min(2, 'Nama minimal 2 karakter').max(60),
  namaEn: z.string().trim().max(60).optional(),
});

const skemaUbah = z.object({
  id: z.string().min(1),
  nama: z.string().trim().min(2, 'Nama minimal 2 karakter').max(60),
  namaEn: z.string().trim().max(60).optional(),
});

export async function tambahJabatan(
  _sebelumnya: HasilJabatan,
  formData: FormData
): Promise<HasilJabatan> {
  const cek = await pastikanAdmin();
  if (cek.error) return { error: cek.error };

  const mentah = {
    kode: String(formData.get('kode') ?? '').toUpperCase(),
    nama: String(formData.get('nama') ?? ''),
    namaEn: String(formData.get('namaEn') ?? '').trim() || undefined,
  };

  const hasil = skemaTambah.safeParse(mentah);
  if (!hasil.success) {
    return { error: hasil.error.issues[0].message };
  }

  const sudahAda = await prisma.jabatan.findUnique({
    where: { kode: hasil.data.kode },
  });
  if (sudahAda) {
    return { error: `Kode "${hasil.data.kode}" sudah dipakai.` };
  }

  const baru = await prisma.jabatan.create({
    data: {
      kode: hasil.data.kode,
      nama: hasil.data.nama,
      namaEn: hasil.data.namaEn ?? null,
    },
  });

  await catatAudit({
    pegawaiId: cek.saya.id,
    aksi: 'TAMBAH_JABATAN',
    entitas: 'Jabatan',
    entitasId: baru.id,
    dataBaru: { kode: baru.kode, nama: baru.nama },
  });

  revalidatePath('/parameter/jabatan');
  return { sukses: true, pesan: `Jabatan "${baru.nama}" ditambahkan.` };
}

export async function ubahJabatan(
  _sebelumnya: HasilJabatan,
  formData: FormData
): Promise<HasilJabatan> {
  const cek = await pastikanAdmin();
  if (cek.error) return { error: cek.error };

  const hasil = skemaUbah.safeParse({
    id: String(formData.get('id') ?? ''),
    nama: String(formData.get('nama') ?? ''),
    namaEn: String(formData.get('namaEn') ?? '').trim() || undefined,
  });
  if (!hasil.success) {
    return { error: hasil.error.issues[0].message };
  }

  const lama = await prisma.jabatan.findUnique({ where: { id: hasil.data.id } });
  if (!lama) return { error: 'Jabatan tidak ditemukan.' };

  const baru = await prisma.jabatan.update({
    where: { id: hasil.data.id },
    data: { nama: hasil.data.nama, namaEn: hasil.data.namaEn ?? null },
  });

  await catatAudit({
    pegawaiId: cek.saya.id,
    aksi: 'UBAH_JABATAN',
    entitas: 'Jabatan',
    entitasId: baru.id,
    dataLama: { nama: lama.nama, namaEn: lama.namaEn },
    dataBaru: { nama: baru.nama, namaEn: baru.namaEn },
  });

  revalidatePath('/parameter/jabatan');
  return { sukses: true, pesan: `Jabatan "${baru.nama}" diperbarui.` };
}

export async function ubahStatusJabatan(
  _sebelumnya: HasilJabatan,
  formData: FormData
): Promise<HasilJabatan> {
  const cek = await pastikanAdmin();
  if (cek.error) return { error: cek.error };

  const id = String(formData.get('id') ?? '');
  const aktif = String(formData.get('aktif') ?? '') === 'true';

  const jabatan = await prisma.jabatan.findUnique({
    where: { id },
    include: { _count: { select: { pegawai: true } } },
  });
  if (!jabatan) return { error: 'Jabatan tidak ditemukan.' };

  // Nonaktifkan boleh walaupun masih dipakai — supaya tidak bisa dipilih
  // untuk pegawai baru, tapi data lama tetap utuh.
  await prisma.jabatan.update({ where: { id }, data: { aktif } });

  await catatAudit({
    pegawaiId: cek.saya.id,
    aksi: aktif ? 'AKTIFKAN_JABATAN' : 'NONAKTIFKAN_JABATAN',
    entitas: 'Jabatan',
    entitasId: id,
    dataBaru: { kode: jabatan.kode, aktif },
  });

  revalidatePath('/parameter/jabatan');
  return {
    sukses: true,
    pesan: aktif
      ? `Jabatan "${jabatan.nama}" diaktifkan.`
      : `Jabatan "${jabatan.nama}" dinonaktifkan (masih dipakai ${jabatan._count.pegawai} pegawai).`,
  };
}

export async function hapusJabatan(
  _sebelumnya: HasilJabatan,
  formData: FormData
): Promise<HasilJabatan> {
  const cek = await pastikanAdmin();
  if (cek.error) return { error: cek.error };

  const id = String(formData.get('id') ?? '');

  const jabatan = await prisma.jabatan.findUnique({
    where: { id },
    include: { _count: { select: { pegawai: true, pengajuan: true } } },
  });
  if (!jabatan) return { error: 'Jabatan tidak ditemukan.' };

  // Jabatan yang sudah dipakai TIDAK boleh dihapus — kalau dihapus, data
  // pegawai dan pengajuan lama kehilangan rujukannya. Yang tersedia hanya
  // menonaktifkan.
  const dipakai = jabatan._count.pegawai + jabatan._count.pengajuan;
  if (dipakai > 0) {
    return {
      error:
        `Jabatan "${jabatan.nama}" tidak bisa dihapus karena masih dipakai ` +
        `${jabatan._count.pegawai} pegawai dan ${jabatan._count.pengajuan} pengajuan. ` +
        'Nonaktifkan saja supaya tidak bisa dipilih lagi.',
    };
  }

  await prisma.jabatan.delete({ where: { id } });

  await catatAudit({
    pegawaiId: cek.saya.id,
    aksi: 'HAPUS_JABATAN',
    entitas: 'Jabatan',
    entitasId: id,
    dataLama: { kode: jabatan.kode, nama: jabatan.nama },
  });

  revalidatePath('/parameter/jabatan');
  return { sukses: true, pesan: `Jabatan "${jabatan.nama}" dihapus.` };
}
