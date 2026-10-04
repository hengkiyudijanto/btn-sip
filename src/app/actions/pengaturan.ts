'use server';

import { revalidatePath } from 'next/cache';
import { pegawaiDariSesi } from '@/lib/auth';
import { ubahHariPenilaian, pastikanPeriodeBulan, ambilPengaturan } from '@/lib/sip/pengaturan';
import { NAMA_HARI } from '@/lib/sip/periode';
import { boleh } from '@/lib/sip/akses';

export type HasilPengaturan = {
  error?: string;
  sukses?: boolean;
  pesan?: string;
  periodeDibuat?: number;
};

/**
 * Ubah hari penilaian (mis. Rabu -> Senin).
 * Hanya admin. Periode yang sudah ada TIDAK diubah — perubahan hanya
 * mempengaruhi perhitungan periode ke depan.
 */
export async function ubahHariPenilaianAksi(
  _sebelumnya: HasilPengaturan,
  formData: FormData
): Promise<HasilPengaturan> {
  const saya = await pegawaiDariSesi();
  if (!saya) return { error: 'Sesi berakhir. Silakan masuk kembali.' };
  if (!boleh(saya.role, 'kelola_induk')) return { error: 'Peran Anda hanya bisa melihat, tidak bisa mengubah data.' };

  const nilai = Number(formData.get('hariPenilaian'));
  if (!Number.isInteger(nilai) || nilai < 0 || nilai > 6) {
    return { error: 'Hari tidak valid.' };
  }

  const sebelum = await ambilPengaturan();
  if (sebelum.hariPenilaian === nilai) {
    return { error: `Hari penilaian sudah ${NAMA_HARI[nilai]} — tidak ada yang diubah.` };
  }

  await ubahHariPenilaian(nilai, saya.id, sebelum.hariPenilaian);

  // hitung ulang periode untuk bulan-bulan yang belum terbuat,
  // supaya perubahan langsung terasa manfaatnya
  const hasil = await pastikanPeriodeBulan(new Date());

  revalidatePath('/parameter/periode');
  revalidatePath('/penilaian');

  return {
    sukses: true,
    pesan: `Hari penilaian diubah dari ${NAMA_HARI[sebelum.hariPenilaian]} menjadi ${NAMA_HARI[nilai]}.`,
    periodeDibuat: hasil.dibuat,
  };
}
