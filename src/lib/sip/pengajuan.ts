import { prisma } from '@/lib/db';
import bcrypt from 'bcryptjs';
import { kumpulkanTurunan } from '@/lib/sip/hierarki';
import {
  BOLEH_MENGAJUKAN,
  MIN_PANJANG_PASSWORD,
  nipValid,
} from '@/lib/sip/pengajuan-konstanta';

/**
 * Pengajuan penambahan pegawai oleh supervisor.
 *
 * Alur: supervisor mengajukan → admin menyetujui/menolak.
 *
 * Kenapa bukan langsung menambah? Data pegawai mengikat identitas resmi
 * bank (NIP). Kalau setiap supervisor bisa menambah, risikonya: NIP ganda,
 * NIP salah ketik, pegawai di cabang yang bukan wewenangnya, atau pegawai
 * fiktif — dan itu merusak laporan.
 *
 * Aturan yang ditegakkan di sini:
 *  - pengaju harus SUPERVISOR, MANAGER, atau ADMIN
 *  - cabang tujuan harus cabang pengaju atau turunannya
 *  - NIP belum dipakai pegawai mana pun, dan belum diajukan orang lain
 *  - role yang diajukan HANYA PEGAWAI (tidak bisa membuat admin/supervisor)
 *  - password di-hash sejak pengajuan; tidak ada yang melihat password asli
 */

export type HasilAjukan = {
  error?: string;
  sukses?: boolean;
  pesan?: string;
  pengajuanId?: string;
};

/**
 * Cabang mana yang boleh dipakai pengaju.
 * Supervisor cabang KC boleh mengajukan untuk KC-nya dan KCP di bawahnya;
 * admin boleh semua.
 */
export async function cabangYangBoleh(
  pegawaiId: string,
  role: string,
  cabangIdPengaju: string
): Promise<string[]> {
  if (role === 'ADMIN') {
    const semua = await prisma.cabang.findMany({ select: { id: true } });
    return semua.map((c) => c.id);
  }
  const semua = await prisma.cabang.findMany({
    select: { id: true, indukId: true },
  });
  return kumpulkanTurunan(cabangIdPengaju, semua);
}

/** Ajukan pegawai baru */
export async function ajukanPegawai(
  pengajuId: string,
  data: {
    nip: string;
    nama: string;
    email?: string;
    password: string;
    cabangId: string;
    jabatanId?: string;
    catatan?: string;
  }
): Promise<HasilAjukan> {
  const pengaju = await prisma.pegawai.findUnique({ where: { id: pengajuId } });
  if (!pengaju) return { error: 'Pengaju tidak ditemukan.' };
  if (!BOLEH_MENGAJUKAN.has(pengaju.role)) {
    return { error: 'Hanya supervisor, manager, atau admin yang dapat mengajukan pegawai.' };
  }

  const nip = data.nip.trim();
  const nama = data.nama.trim();

  if (!nipValid(nip)) {
    return { error: 'NIP hanya boleh huruf, angka, dan tanda hubung (3-30 karakter).' };
  }
  if (nama.length < 3) return { error: 'Nama minimal 3 karakter.' };
  if (data.password.length < MIN_PANJANG_PASSWORD) {
    return { error: `Password minimal ${MIN_PANJANG_PASSWORD} karakter.` };
  }

  // NIP tidak boleh sudah dipakai pegawai
  const nipDipakai = await prisma.pegawai.findUnique({ where: { nip } });
  if (nipDipakai) return { error: `NIP ${nip} sudah dipakai pegawai lain.` };

  // NIP tidak boleh sedang diajukan orang lain
  const sedangDiajukan = await prisma.pengajuanPegawai.findFirst({
    where: { nip, status: 'MENUNGGU' },
    include: { pengaju: { select: { nama: true } } },
  });
  if (sedangDiajukan) {
    return {
      error: `NIP ${nip} sedang diajukan oleh ${sedangDiajukan.pengaju.nama} dan belum diputuskan.`,
    };
  }

  // cakupan cabang
  const boleh = await cabangYangBoleh(pengaju.id, pengaju.role, pengaju.cabangId);
  if (!boleh.includes(data.cabangId)) {
    return { error: 'Anda hanya dapat mengajukan pegawai untuk unit kerja Anda sendiri.' };
  }

  const cabang = await prisma.cabang.findUnique({ where: { id: data.cabangId } });
  if (!cabang) return { error: 'Cabang tidak ditemukan.' };
  if (!cabang.aktif) return { error: `Cabang ${cabang.nama} sedang nonaktif.` };

  if (data.jabatanId) {
    const jab = await prisma.jabatan.findUnique({ where: { id: data.jabatanId } });
    if (!jab) return { error: 'Jabatan tidak ditemukan.' };
  }

  const passwordHash = await bcrypt.hash(data.password, 12);

  const pengajuan = await prisma.pengajuanPegawai.create({
    data: {
      nip,
      nama,
      email: data.email?.trim() || null,
      passwordHash,
      cabangId: data.cabangId,
      jabatanId: data.jabatanId || null,
      pengajuId: pengaju.id,
      catatanPengaju: data.catatan?.trim() || null,
      status: 'MENUNGGU',
    },
  });

  await prisma.auditLog.create({
    data: {
      pegawaiId: pengaju.id,
      aksi: 'AJUKAN_PEGAWAI',
      entitas: 'PengajuanPegawai',
      entitasId: pengajuan.id,
      dataBaru: { nip, nama, cabang: cabang.kode },
    },
  });

  return {
    sukses: true,
    pengajuanId: pengajuan.id,
    pesan: `Pengajuan ${nama} (${nip}) dikirim. Menunggu persetujuan admin.`,
  };
}

/** Setujui pengajuan — membuat pegawai sungguhan */
export async function setujuiPengajuan(
  adminId: string,
  pengajuanId: string,
  catatan?: string
): Promise<HasilAjukan> {
  const admin = await prisma.pegawai.findUnique({ where: { id: adminId } });
  if (!admin) return { error: 'Admin tidak ditemukan.' };
  if (admin.role !== 'ADMIN') return { error: 'Hanya admin yang dapat menyetujui pengajuan.' };

  const p = await prisma.pengajuanPegawai.findUnique({
    where: { id: pengajuanId },
    include: { cabang: true },
  });
  if (!p) return { error: 'Pengajuan tidak ditemukan.' };
  if (p.status !== 'MENUNGGU') {
    return { error: `Pengajuan ini sudah ${p.status === 'DISETUJUI' ? 'disetujui' : 'ditolak'}.` };
  }

  // periksa ulang saat menyetujui: NIP bisa saja terpakai sejak diajukan
  const nipDipakai = await prisma.pegawai.findUnique({ where: { nip: p.nip } });
  if (nipDipakai) {
    return {
      error: `NIP ${p.nip} sudah dipakai pegawai lain sejak pengajuan dibuat. Tolak pengajuan ini.`,
    };
  }
  if (p.email) {
    const emailDipakai = await prisma.pegawai.findUnique({ where: { email: p.email } });
    if (emailDipakai) {
      return { error: `Email ${p.email} sudah dipakai pegawai lain. Tolak pengajuan ini.` };
    }
  }

  const pegawai = await prisma.$transaction(async (tx) => {
    const baru = await tx.pegawai.create({
      data: {
        nip: p.nip,
        nama: p.nama,
        email: p.email,
        // password sudah ter-hash sejak pengajuan — admin tidak perlu
        // mengetik ulang, dan password asli tidak pernah terlihat
        passwordHash: p.passwordHash,
        role: 'PEGAWAI', // selalu PEGAWAI, walau pengajuan dimanipulasi
        aktif: true,
        // wajib ganti password saat login pertama
        harusGantiPassword: true,
        cabangId: p.cabangId,
        jabatanId: p.jabatanId,
        atasanId: p.atasanId,
      },
    });

    await tx.pengajuanPegawai.update({
      where: { id: p.id },
      data: {
        status: 'DISETUJUI',
        pegawaiId: baru.id,
        diputuskanOlehId: admin.id,
        catatanAdmin: catatan?.trim() || null,
        diputuskanAt: new Date(),
      },
    });

    return baru;
  });

  await prisma.auditLog.create({
    data: {
      pegawaiId: admin.id,
      aksi: 'SETUJUI_PENGAJUAN_PEGAWAI',
      entitas: 'PengajuanPegawai',
      entitasId: p.id,
      dataBaru: {
        nip: p.nip,
        nama: p.nama,
        cabang: p.cabang.kode,
        pegawaiDibuat: pegawai.id,
        pengaju: p.pengajuId,
      },
    },
  });

  return {
    sukses: true,
    pesan: `${p.nama} (${p.nip}) disetujui dan sekarang terdaftar sebagai pegawai.`,
  };
}

/** Tolak pengajuan */
export async function tolakPengajuan(
  adminId: string,
  pengajuanId: string,
  alasan: string
): Promise<HasilAjukan> {
  const admin = await prisma.pegawai.findUnique({ where: { id: adminId } });
  if (!admin) return { error: 'Admin tidak ditemukan.' };
  if (admin.role !== 'ADMIN') return { error: 'Hanya admin yang dapat menolak pengajuan.' };

  const alasanBersih = alasan.trim();
  if (alasanBersih.length < 5) {
    return { error: 'Alasan penolakan wajib diisi (minimal 5 karakter).' };
  }

  const p = await prisma.pengajuanPegawai.findUnique({ where: { id: pengajuanId } });
  if (!p) return { error: 'Pengajuan tidak ditemukan.' };
  if (p.status !== 'MENUNGGU') {
    return { error: `Pengajuan ini sudah ${p.status === 'DISETUJUI' ? 'disetujui' : 'ditolak'}.` };
  }

  await prisma.pengajuanPegawai.update({
    where: { id: p.id },
    data: {
      status: 'DITOLAK',
      diputuskanOlehId: admin.id,
      catatanAdmin: alasanBersih,
      diputuskanAt: new Date(),
    },
  });

  await prisma.auditLog.create({
    data: {
      pegawaiId: admin.id,
      aksi: 'TOLAK_PENGAJUAN_PEGAWAI',
      entitas: 'PengajuanPegawai',
      entitasId: p.id,
      dataBaru: { nip: p.nip, nama: p.nama, alasan: alasanBersih },
    },
  });

  return { sukses: true, pesan: `Pengajuan ${p.nama} ditolak.` };
}

/** Batalkan pengajuan sendiri (oleh supervisor yang mengajukan) */
export async function batalkanPengajuan(
  pengajuId: string,
  pengajuanId: string
): Promise<HasilAjukan> {
  const p = await prisma.pengajuanPegawai.findUnique({ where: { id: pengajuanId } });
  if (!p) return { error: 'Pengajuan tidak ditemukan.' };
  if (p.pengajuId !== pengajuId) {
    return { error: 'Anda hanya dapat membatalkan pengajuan Anda sendiri.' };
  }
  if (p.status !== 'MENUNGGU') {
    return { error: 'Pengajuan ini sudah diputuskan, tidak dapat dibatalkan.' };
  }

  await prisma.pengajuanPegawai.delete({ where: { id: p.id } });

  await prisma.auditLog.create({
    data: {
      pegawaiId: pengajuId,
      aksi: 'BATAL_PENGAJUAN_PEGAWAI',
      entitas: 'PengajuanPegawai',
      entitasId: p.id,
      dataLama: { nip: p.nip, nama: p.nama },
    },
  });

  return { sukses: true, pesan: `Pengajuan ${p.nama} dibatalkan.` };
}
