'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { pegawaiDariSesi, catatAudit } from '@/lib/auth';
import { rentangPeriode } from '@/lib/sip/laporan';

export type HasilPeriode = { error?: string; sukses?: boolean; pesan?: string };

async function pastikanAdmin() {
  const saya = await pegawaiDariSesi();
  if (!saya) return { error: 'Sesi habis. Silakan masuk kembali.' as const };
  if (saya.role !== 'ADMIN') return { error: 'Hanya admin yang dapat mengelola periode.' as const };
  return { saya };
}

/** Hitung nomor minggu ISO dan tanggal Senin/Minggu dari sebuah tanggal. */
function batasMinggu(tanggal: Date) {
  const d = new Date(Date.UTC(tanggal.getUTCFullYear(), tanggal.getUTCMonth(), tanggal.getUTCDate()));
  const hari = d.getUTCDay() || 7; // Minggu = 7
  const senin = new Date(d);
  senin.setUTCDate(d.getUTCDate() - hari + 1);
  const minggu = new Date(senin);
  minggu.setUTCDate(senin.getUTCDate() + 6);
  minggu.setUTCHours(23, 59, 59, 0);

  // nomor minggu ISO
  const target = new Date(senin);
  target.setUTCDate(senin.getUTCDate() + 3); // Kamis di minggu yang sama
  const awalTahun = new Date(Date.UTC(target.getUTCFullYear(), 0, 4));
  const nomor = 1 + Math.round(((target.getTime() - awalTahun.getTime()) / 86400000 - 3) / 7);

  return { senin, minggu, nomor, tahun: target.getUTCFullYear() };
}

const skemaBuat = z.object({
  tanggal: z.string().min(1, 'Tanggal wajib diisi'),
  kodeManual: z.string().max(30).optional(),
});

/** Buat periode mingguan baru dari tanggal apa pun (otomatis Senin–Minggu). */
export async function buatPeriode(
  _sebelumnya: HasilPeriode,
  formData: FormData
): Promise<HasilPeriode> {
  const cek = await pastikanAdmin();
  if ('error' in cek) return { error: cek.error };
  const saya = cek.saya;

  const parsed = skemaBuat.safeParse({
    tanggal: formData.get('tanggal'),
    kodeManual: formData.get('kodeManual') ?? undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const tgl = new Date(parsed.data.tanggal);
  if (Number.isNaN(tgl.getTime())) return { error: 'Tanggal tidak valid.' };

  const { senin, minggu, nomor, tahun } = batasMinggu(tgl);
  const kode = parsed.data.kodeManual?.trim() || `${tahun}-W${String(nomor).padStart(2, '0')}`;
  const nama = `Minggu ke-${nomor} (${rentangPeriode(senin, minggu)})`;

  const ada = await prisma.periode.findFirst({
    where: { OR: [{ kode }, { tanggalMulai: senin, tanggalSelesai: minggu }] },
  });
  if (ada) return { error: `Periode ${nama} sudah ada.` };

  const periode = await prisma.periode.create({
    data: { kode, nama, tanggalMulai: senin, tanggalSelesai: minggu, aktif: true },
  });

  await catatAudit({
    pegawaiId: saya.id,
    aksi: 'BUAT_PERIODE',
    entitas: 'Periode',
    entitasId: periode.id,
    dataBaru: { kode, nama },
  });

  revalidatePath('/parameter/periode');
  revalidatePath('/penilaian');
  revalidatePath('/laporan');
  return { sukses: true, pesan: `Periode ${nama} dibuat.` };
}

/** Aktifkan / nonaktifkan periode. */
export async function ubahStatusPeriode(
  _sebelumnya: HasilPeriode,
  formData: FormData
): Promise<HasilPeriode> {
  const cek = await pastikanAdmin();
  if ('error' in cek) return { error: cek.error };
  const saya = cek.saya;

  const periodeId = String(formData.get('periodeId') ?? '');
  const p = await prisma.periode.findUnique({ where: { id: periodeId } });
  if (!p) return { error: 'Periode tidak ditemukan.' };

  const baru = !p.aktif;
  await prisma.periode.update({ where: { id: periodeId }, data: { aktif: baru } });

  await catatAudit({
    pegawaiId: saya.id,
    aksi: baru ? 'AKTIFKAN_PERIODE' : 'NONAKTIFKAN_PERIODE',
    entitas: 'Periode',
    entitasId: periodeId,
  });

  revalidatePath('/parameter/periode');
  revalidatePath('/penilaian');
  return { sukses: true, pesan: `Periode ${p.nama} kini ${baru ? 'aktif' : 'nonaktif'}.` };
}

/** Kunci / buka kunci periode. Periode terkunci tidak bisa dinilai. */
export async function kunciPeriode(
  _sebelumnya: HasilPeriode,
  formData: FormData
): Promise<HasilPeriode> {
  const cek = await pastikanAdmin();
  if ('error' in cek) return { error: cek.error };
  const saya = cek.saya;

  const periodeId = String(formData.get('periodeId') ?? '');
  const p = await prisma.periode.findUnique({
    where: { id: periodeId },
    include: { _count: { select: { penilaian: true } } },
  });
  if (!p) return { error: 'Periode tidak ditemukan.' };

  const baru = !p.dikunci;
  await prisma.periode.update({ where: { id: periodeId }, data: { dikunci: baru } });

  await catatAudit({
    pegawaiId: saya.id,
    aksi: baru ? 'KUNCI_PERIODE' : 'BUKA_KUNCI_PERIODE',
    entitas: 'Periode',
    entitasId: periodeId,
    dataBaru: { dikunci: baru, jumlahPenilaian: p._count.penilaian },
  });

  revalidatePath('/parameter/periode');
  revalidatePath('/penilaian');
  revalidatePath('/laporan');
  return {
    sukses: true,
    pesan: baru
      ? `Periode ${p.nama} dikunci. ${p._count.penilaian} penilaian tidak dapat diubah.`
      : `Kunci periode ${p.nama} dibuka.`,
  };
}

/**
 * Buat beberapa periode sekaligus (mis. 8 minggu ke depan) supaya admin
 * tidak perlu input satu per satu tiap minggu.
 */
export async function buatBeberapaPeriode(
  _sebelumnya: HasilPeriode,
  formData: FormData
): Promise<HasilPeriode> {
  const cek = await pastikanAdmin();
  if ('error' in cek) return { error: cek.error };
  const saya = cek.saya;

  const mulaiStr = String(formData.get('mulai') ?? '');
  const jumlah = Number(formData.get('jumlah') ?? 4);
  if (!mulaiStr) return { error: 'Tanggal mulai wajib diisi.' };
  if (!Number.isInteger(jumlah) || jumlah < 1 || jumlah > 52) {
    return { error: 'Jumlah minggu harus antara 1 dan 52.' };
  }

  const mulai = new Date(mulaiStr);
  if (Number.isNaN(mulai.getTime())) return { error: 'Tanggal mulai tidak valid.' };

  const { senin } = batasMinggu(mulai);
  let dibuat = 0;
  let dilewati = 0;

  for (let i = 0; i < jumlah; i++) {
    const t = new Date(senin);
    t.setUTCDate(senin.getUTCDate() + i * 7);
    const { senin: s, minggu, nomor, tahun } = batasMinggu(t);
    const kode = `${tahun}-W${String(nomor).padStart(2, '0')}`;
    const nama = `Minggu ke-${nomor} (${rentangPeriode(s, minggu)})`;

    const ada = await prisma.periode.findFirst({
      where: { OR: [{ kode }, { tanggalMulai: s, tanggalSelesai: minggu }] },
    });
    if (ada) {
      dilewati++;
      continue;
    }
    await prisma.periode.create({
      data: { kode, nama, tanggalMulai: s, tanggalSelesai: minggu, aktif: true },
    });
    dibuat++;
  }

  await catatAudit({
    pegawaiId: saya.id,
    aksi: 'BUAT_PERIODE_MASSAL',
    entitas: 'Periode',
    dataBaru: { jumlahDiminta: jumlah, dibuat, dilewati },
  });

  revalidatePath('/parameter/periode');
  return {
    sukses: true,
    pesan: `${dibuat} periode dibuat${dilewati > 0 ? `, ${dilewati} dilewati karena sudah ada` : ''}.`,
  };
}
