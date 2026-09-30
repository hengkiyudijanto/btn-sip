import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/db';

const NAMA_COOKIE = 'sip_sesi';
const UMUR_SESI_HARI = 7;

// ===========================================================================
// Password
// ===========================================================================

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 12);
}

export async function verifikasiPassword(
  plain: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

/**
 * Aturan password minimum. Sengaja tidak terlalu kaku supaya pegawai tidak
 * menuliskan password di kertas, tapi tetap menolak yang terlalu lemah.
 */
export function validasiKekuatanPassword(pw: string): string | null {
  if (pw.length < 8) return 'Password minimal 8 karakter';
  if (!/[a-z]/.test(pw)) return 'Password harus mengandung huruf kecil';
  if (!/[A-Z]/.test(pw)) return 'Password harus mengandung huruf besar';
  if (!/[0-9]/.test(pw)) return 'Password harus mengandung angka';
  return null;
}

// ===========================================================================
// Sesi
// ===========================================================================

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export async function buatSesi(
  pegawaiId: string,
  meta?: { ip?: string; userAgent?: string }
): Promise<void> {
  const token = crypto.randomBytes(32).toString('base64url');
  const expiresAt = new Date(
    Date.now() + UMUR_SESI_HARI * 24 * 60 * 60 * 1000
  );

  await prisma.sesi.create({
    data: {
      tokenHash: hashToken(token),
      pegawaiId,
      expiresAt,
      ip: meta?.ip,
      userAgent: meta?.userAgent,
    },
  });

  const jar = await cookies();
  jar.set(NAMA_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    expires: expiresAt,
  });
}

export type PegawaiSesi = {
  id: string;
  nip: string;
  nama: string;
  role: 'PEGAWAI' | 'SUPERVISOR' | 'MANAGER' | 'ADMIN';
  fotoUrl: string | null;
  harusGantiPassword: boolean;
  cabang: { id: string; kode: string; nama: string };
  jabatan: { id: string; kode: string; nama: string } | null;
};

/** Ambil pegawai dari sesi aktif, atau null kalau tidak ada / kedaluwarsa. */
export async function pegawaiDariSesi(): Promise<PegawaiSesi | null> {
  const jar = await cookies();
  const token = jar.get(NAMA_COOKIE)?.value;
  if (!token) return null;

  const sesi = await prisma.sesi.findUnique({
    where: { tokenHash: hashToken(token) },
    include: {
      pegawai: {
        include: {
          cabang: { select: { id: true, kode: true, nama: true } },
          jabatan: { select: { id: true, kode: true, nama: true } },
        },
      },
    },
  });

  if (!sesi || sesi.revokedAt || sesi.expiresAt < new Date()) return null;
  if (!sesi.pegawai.aktif) return null;

  const p = sesi.pegawai;
  return {
    id: p.id,
    nip: p.nip,
    nama: p.nama,
    role: p.role,
    fotoUrl: p.fotoUrl,
    harusGantiPassword: p.harusGantiPassword,
    cabang: p.cabang,
    jabatan: p.jabatan,
  };
}

export async function hapusSesi(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(NAMA_COOKIE)?.value;
  if (token) {
    await prisma.sesi.updateMany({
      where: { tokenHash: hashToken(token) },
      data: { revokedAt: new Date() },
    });
  }
  jar.delete(NAMA_COOKIE);
}

/** Catat aksi ke audit log. Gagal mencatat tidak boleh menggagalkan aksi utama. */
export async function catatAudit(data: {
  pegawaiId?: string;
  aksi: string;
  entitas?: string;
  entitasId?: string;
  dataLama?: unknown;
  dataBaru?: unknown;
  ip?: string;
  userAgent?: string;
}): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        pegawaiId: data.pegawaiId,
        aksi: data.aksi,
        entitas: data.entitas,
        entitasId: data.entitasId,
        dataLama: data.dataLama as never,
        dataBaru: data.dataBaru as never,
        ip: data.ip,
        userAgent: data.userAgent,
      },
    });
  } catch (e) {
    console.error('[audit] gagal mencatat:', e);
  }
}
