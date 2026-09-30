'use server';

import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import {
  verifikasiPassword,
  buatSesi,
  hapusSesi,
  catatAudit,
  pegawaiDariSesi,
  hashPassword,
  validasiKekuatanPassword,
} from '@/lib/auth';

const skemaLogin = z.object({
  nip: z.string().min(1, 'NIP wajib diisi').max(30).trim(),
  password: z.string().min(1, 'Password wajib diisi').max(200),
});

export type HasilLogin = { error?: string; sukses?: boolean };

export async function masuk(
  _sebelumnya: HasilLogin,
  formData: FormData
): Promise<HasilLogin> {
  const parsed = skemaLogin.safeParse({
    nip: formData.get('nip'),
    password: formData.get('password'),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const { nip, password } = parsed.data;
  const h = await headers();
  const ip = h.get('x-forwarded-for')?.split(',')[0]?.trim() ?? undefined;
  const userAgent = h.get('user-agent') ?? undefined;

  const pegawai = await prisma.pegawai.findUnique({ where: { nip } });

  // Pesan error sengaja disamakan untuk NIP tidak ada vs password salah,
  // supaya tidak bisa dipakai menebak NIP mana yang terdaftar.
  const PESAN_GAGAL = 'NIP atau password salah';

  if (!pegawai) {
    await catatAudit({ aksi: 'LOGIN_GAGAL', entitas: 'Pegawai', dataBaru: { nip }, ip, userAgent });
    return { error: PESAN_GAGAL };
  }

  if (!pegawai.aktif) {
    return { error: 'Akun tidak aktif. Hubungi admin.' };
  }

  const cocok = await verifikasiPassword(password, pegawai.passwordHash);
  if (!cocok) {
    await catatAudit({
      pegawaiId: pegawai.id,
      aksi: 'LOGIN_GAGAL',
      entitas: 'Pegawai',
      entitasId: pegawai.id,
      ip,
      userAgent,
    });
    return { error: PESAN_GAGAL };
  }

  await buatSesi(pegawai.id, { ip, userAgent });
  await prisma.pegawai.update({
    where: { id: pegawai.id },
    data: { lastLoginAt: new Date() },
  });
  await catatAudit({
    pegawaiId: pegawai.id,
    aksi: 'LOGIN',
    entitas: 'Pegawai',
    entitasId: pegawai.id,
    ip,
    userAgent,
  });

  if (pegawai.harusGantiPassword) {
    redirect('/ubah-password');
  }
  redirect('/dasbor');
}

export async function keluar() {
  const pegawai = await pegawaiDariSesi();
  if (pegawai) {
    await catatAudit({
      pegawaiId: pegawai.id,
      aksi: 'LOGOUT',
      entitas: 'Pegawai',
      entitasId: pegawai.id,
    });
  }
  await hapusSesi();
  redirect('/masuk');
}

export async function gantiPasswordSendiri(
  _sebelumnya: HasilLogin,
  formData: FormData
): Promise<HasilLogin> {
  const pegawai = await pegawaiDariSesi();
  if (!pegawai) return { error: 'Sesi habis. Silakan masuk kembali.' };

  const lama = String(formData.get('passwordLama') ?? '');
  const baru = String(formData.get('passwordBaru') ?? '');
  const ulang = String(formData.get('passwordUlang') ?? '');

  if (!lama || !baru || !ulang) return { error: 'Semua kolom wajib diisi' };
  if (baru !== ulang) return { error: 'Password baru dan ulangi tidak sama' };

  const lemah = validasiKekuatanPassword(baru);
  if (lemah) return { error: lemah };

  const data = await prisma.pegawai.findUnique({ where: { id: pegawai.id } });
  if (!data) return { error: 'Akun tidak ditemukan' };

  const cocok = await verifikasiPassword(lama, data.passwordHash);
  if (!cocok) {
    await catatAudit({
      pegawaiId: pegawai.id,
      aksi: 'GANTI_PASSWORD_GAGAL',
      entitas: 'Pegawai',
      entitasId: pegawai.id,
    });
    return { error: 'Password lama salah' };
  }

  if (await verifikasiPassword(baru, data.passwordHash)) {
    return { error: 'Password baru tidak boleh sama dengan yang lama' };
  }

  await prisma.pegawai.update({
    where: { id: pegawai.id },
    data: {
      passwordHash: await hashPassword(baru),
      harusGantiPassword: false,
    },
  });

  await catatAudit({
    pegawaiId: pegawai.id,
    aksi: 'GANTI_PASSWORD',
    entitas: 'Pegawai',
    entitasId: pegawai.id,
  });

  redirect('/dasbor');
}
