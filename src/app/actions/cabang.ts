'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { pegawaiDariSesi, catatAudit } from '@/lib/auth';
import { akanMembuatSiklus } from '@/lib/sip/hierarki';

export type HasilCabang = {
  error?: string;
  sukses?: boolean;
  pesan?: string;
};

async function pastikanAdmin() {
  const saya = await pegawaiDariSesi();
  if (!saya) return { error: 'Sesi habis. Silakan masuk kembali.' as const };
  if (saya.role !== 'ADMIN') return { error: 'Hanya admin yang dapat mengelola cabang.' as const };
  return { saya };
}

const JENIS = ['KANWIL', 'KC', 'KCP'] as const;

const skema = z.object({
  kode: z
    .string()
    .min(1, 'Kode cabang wajib diisi')
    .max(20, 'Kode maksimal 20 karakter')
    .regex(/^[A-Za-z0-9-]+$/, 'Kode hanya boleh huruf, angka, dan tanda hubung'),
  nama: z.string().min(1, 'Nama cabang wajib diisi').max(120),
  jenis: z.enum(JENIS),
  alamat: z.string().max(300).optional(),
  indukId: z.string().optional(),
});

/** Tambah cabang baru, lengkap dengan jenis & cabang induk. */
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
    jenis: String(formData.get('jenis') ?? 'KC'),
    alamat: String(formData.get('alamat') ?? '').trim() || undefined,
    indukId: String(formData.get('indukId') ?? '').trim() || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const { kode, nama, jenis, alamat, indukId } = parsed.data;
  const kodeUpper = kode.toUpperCase();

  const ada = await prisma.cabang.findUnique({ where: { kode: kodeUpper } });
  if (ada) return { error: `Kode cabang ${kodeUpper} sudah dipakai (${ada.nama}).` };

  // Kanwil adalah level tertinggi — tidak punya induk
  if (jenis === 'KANWIL' && indukId) {
    return { error: 'Kanwil adalah level tertinggi dan tidak boleh punya cabang induk.' };
  }

  // KC & KCP wajib punya induk
  if (jenis !== 'KANWIL' && !indukId) {
    return { error: `${jenis} wajib memiliki cabang induk. Pilih induknya terlebih dahulu.` };
  }

  if (indukId) {
    const induk = await prisma.cabang.findUnique({ where: { id: indukId } });
    if (!induk) return { error: 'Cabang induk tidak ditemukan.' };
    if (jenis === 'KC' && induk.jenis !== 'KANWIL') {
      return { error: 'Cabang induk dari KC harus berupa Kanwil.' };
    }
    if (jenis === 'KCP' && induk.jenis !== 'KC') {
      return { error: 'Cabang induk dari KCP harus berupa KC.' };
    }
  }

  const cabang = await prisma.cabang.create({
    data: { kode: kodeUpper, nama, jenis, alamat, indukId: indukId ?? null },
  });

  await catatAudit({
    pegawaiId: saya.id,
    aksi: 'TAMBAH_CABANG',
    entitas: 'Cabang',
    entitasId: cabang.id,
    dataBaru: { kode: kodeUpper, nama, jenis, indukId },
  });

  revalidatePath('/parameter/cabang');
  revalidatePath('/pegawai');
  revalidatePath('/laporan');
  return { sukses: true, pesan: `${jenis} ${kodeUpper} — ${nama} berhasil ditambahkan.` };
}

/** Ubah data cabang, termasuk memindahkan cabang induk. */
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
  const indukId = String(formData.get('indukId') ?? '').trim() || null;

  if (!id) return { error: 'Cabang tidak ditemukan.' };
  if (!nama) return { error: 'Nama cabang wajib diisi.' };

  const lama = await prisma.cabang.findUnique({ where: { id } });
  if (!lama) return { error: 'Cabang tidak ditemukan.' };

  if (lama.jenis === 'KANWIL' && indukId) {
    return { error: 'Kanwil tidak boleh punya cabang induk.' };
  }

  if (lama.jenis !== 'KANWIL' && !indukId) {
    return { error: `${lama.jenis} wajib memiliki cabang induk.` };
  }

  if (indukId) {
    if (indukId === id) {
      return { error: 'Cabang tidak boleh menjadi induk bagi dirinya sendiri.' };
    }

    // Cegah siklus: induk tidak boleh berasal dari turunan sendiri
    const semua = await prisma.cabang.findMany({ select: { id: true, indukId: true } });
    if (akanMembuatSiklus(id, indukId, semua)) {
      return {
        error:
          'Cabang tersebut tidak dapat dijadikan induk karena akan membentuk lingkaran hierarki.',
      };
    }

    const induk = await prisma.cabang.findUnique({ where: { id: indukId } });
    if (!induk) return { error: 'Cabang induk tidak ditemukan.' };
    if (lama.jenis === 'KC' && induk.jenis !== 'KANWIL') {
      return { error: 'Cabang induk dari KC harus berupa Kanwil.' };
    }
    if (lama.jenis === 'KCP' && induk.jenis !== 'KC') {
      return { error: 'Cabang induk dari KCP harus berupa KC.' };
    }
  }

  await prisma.cabang.update({
    where: { id },
    data: { nama, alamat: alamat || null, indukId },
  });

  await catatAudit({
    pegawaiId: saya.id,
    aksi: 'UBAH_CABANG',
    entitas: 'Cabang',
    entitasId: id,
    dataLama: { nama: lama.nama, alamat: lama.alamat, indukId: lama.indukId },
    dataBaru: { nama, alamat, indukId },
  });

  revalidatePath('/parameter/cabang');
  revalidatePath('/pegawai');
  revalidatePath('/laporan');
  return { sukses: true, pesan: `Cabang ${lama.kode} diperbarui.` };
}

/**
 * Hapus cabang. Ditolak bila masih ada pegawai atau cabang turunan,
 * supaya tidak ada data menggantung.
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
    include: { _count: { select: { pegawai: true, turunan: true } } },
  });
  if (!cabang) return { error: 'Cabang tidak ditemukan.' };

  if (cabang._count.turunan > 0) {
    return {
      error:
        `Cabang ${cabang.kode} masih memiliki ${cabang._count.turunan} cabang turunan. ` +
        'Pindahkan atau hapus turunannya terlebih dahulu.',
    };
  }

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
    dataLama: { kode: cabang.kode, nama: cabang.nama, jenis: cabang.jenis },
  });

  revalidatePath('/parameter/cabang');
  revalidatePath('/pegawai');
  revalidatePath('/laporan');
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

  revalidatePath('/parameter/cabang');
  revalidatePath('/pegawai');
  return {
    sukses: true,
    pesan: `Cabang ${cabang.kode} kini ${baru ? 'aktif' : 'nonaktif'}.`,
  };
}
