'use server';

import { revalidatePath } from 'next/cache';
import { pegawaiDariSesi } from '@/lib/auth';
import {
  ajukanPegawai,
  setujuiPengajuan,
  tolakPengajuan,
  batalkanPengajuan,
  type HasilAjukan,
} from '@/lib/sip/pengajuan';

function salah(e: unknown): HasilAjukan {
  console.error('[pengajuan]', e);
  return { error: 'Terjadi kesalahan. Coba lagi.' };
}

/** Supervisor mengajukan pegawai baru */
export async function ajukanPegawaiAksi(
  _sebelumnya: HasilAjukan,
  formData: FormData
): Promise<HasilAjukan> {
  const saya = await pegawaiDariSesi();
  if (!saya) return { error: 'Sesi berakhir. Silakan masuk kembali.' };
  if (saya.harusGantiPassword) return { error: 'Ganti password dulu.' };

  const nip = String(formData.get('nip') ?? '');
  const nama = String(formData.get('nama') ?? '');
  const email = String(formData.get('email') ?? '');
  const password = String(formData.get('password') ?? '');
  const cabangId = String(formData.get('cabangId') ?? '');
  const jabatanId = String(formData.get('jabatanId') ?? '');
  const catatan = String(formData.get('catatan') ?? '');

  if (!nip || !nama || !password || !cabangId) {
    return { error: 'NIP, nama, password, dan unit kerja wajib diisi.' };
  }

  try {
    const hasil = await ajukanPegawai(saya.id, {
      nip, nama, email, password, cabangId, jabatanId, catatan,
    });
    if (hasil.sukses) {
      revalidatePath('/pengajuan-pegawai');
      revalidatePath('/pegawai');
    }
    return hasil;
  } catch (e) {
    return salah(e);
  }
}

/** Admin menyetujui pengajuan */
export async function setujuiPengajuanAksi(
  _sebelumnya: HasilAjukan,
  formData: FormData
): Promise<HasilAjukan> {
  const saya = await pegawaiDariSesi();
  if (!saya) return { error: 'Sesi berakhir. Silakan masuk kembali.' };

  const pengajuanId = String(formData.get('pengajuanId') ?? '');
  const catatan = String(formData.get('catatan') ?? '');
  if (!pengajuanId) return { error: 'Pengajuan tidak dikenal.' };

  try {
    const hasil = await setujuiPengajuan(saya.id, pengajuanId, catatan);
    if (hasil.sukses) {
      revalidatePath('/pengajuan-pegawai');
      revalidatePath('/pegawai');
    }
    return hasil;
  } catch (e) {
    return salah(e);
  }
}

/** Admin menolak pengajuan */
export async function tolakPengajuanAksi(
  _sebelumnya: HasilAjukan,
  formData: FormData
): Promise<HasilAjukan> {
  const saya = await pegawaiDariSesi();
  if (!saya) return { error: 'Sesi berakhir. Silakan masuk kembali.' };

  const pengajuanId = String(formData.get('pengajuanId') ?? '');
  const alasan = String(formData.get('alasan') ?? '');
  if (!pengajuanId) return { error: 'Pengajuan tidak dikenal.' };

  try {
    const hasil = await tolakPengajuan(saya.id, pengajuanId, alasan);
    if (hasil.sukses) revalidatePath('/pengajuan-pegawai');
    return hasil;
  } catch (e) {
    return salah(e);
  }
}

/** Supervisor membatalkan pengajuannya sendiri */
export async function batalkanPengajuanAksi(
  _sebelumnya: HasilAjukan,
  formData: FormData
): Promise<HasilAjukan> {
  const saya = await pegawaiDariSesi();
  if (!saya) return { error: 'Sesi berakhir. Silakan masuk kembali.' };

  const pengajuanId = String(formData.get('pengajuanId') ?? '');
  if (!pengajuanId) return { error: 'Pengajuan tidak dikenal.' };

  try {
    const hasil = await batalkanPengajuan(saya.id, pengajuanId);
    if (hasil.sukses) revalidatePath('/pengajuan-pegawai');
    return hasil;
  } catch (e) {
    return salah(e);
  }
}
