'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { pegawaiDariSesi, catatAudit } from '@/lib/auth';
import { boleh, wajibKemampuan } from '@/lib/sip/akses';
import { KATEGORI, hitungPenilaian, nilaiKeSkala, type InputAspek } from '@/lib/sip/penilaian';

const skemaSimpan = z.object({
  pegawaiId: z.string().min(1),
  periodeId: z.string().min(1),
  catatanUmum: z.string().max(2000).optional(),
  aspek: z.array(
    z.object({
      kode: z.string(),
      nilai: z.number(),
      catatan: z.string().max(1000).optional(),
    })
  ),
  kirim: z.boolean().optional(),
});

export type HasilSimpan = {
  error?: string;
  sukses?: boolean;
  nilaiAkhir?: number;
  rating?: string;
  /** true bila ini mengubah penilaian yang sudah ada (bukan yang baru) */
  diubah?: boolean;
};


export async function simpanPenilaian(
  _sebelumnya: HasilSimpan,
  formData: FormData
): Promise<HasilSimpan> {
  const penilai = await pegawaiDariSesi();
  if (!penilai) return { error: 'Sesi habis. Silakan masuk kembali.' };
  const tolakMenilai = wajibKemampuan(penilai, 'menilai');
  if (tolakMenilai) return { error: tolakMenilai };

  let mentah: unknown;
  try {
    mentah = JSON.parse(String(formData.get('data') ?? '{}'));
  } catch {
    return { error: 'Data penilaian tidak valid.' };
  }

  const parsed = skemaSimpan.safeParse(mentah);
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }
  const { pegawaiId, periodeId, aspek, catatanUmum, kirim } = parsed.data;

  // Validasi: semua 13 aspek harus terisi
  const semuaKode = KATEGORI.flatMap((k) => k.aspek.map((a) => a.kode));
  const terkirim = new Set(aspek.map((a) => a.kode));
  const belum = semuaKode.filter((k) => !terkirim.has(k));
  if (belum.length > 0) {
    return { error: `Masih ada ${belum.length} aspek yang belum dinilai: ${belum.join(', ')}` };
  }

  // Validasi rentang nilai per aspek
  for (const kat of KATEGORI) {
    for (const asp of kat.aspek) {
      const item = aspek.find((a) => a.kode === asp.kode)!;
      if (!Number.isFinite(item.nilai)) {
        return { error: `Nilai aspek ${asp.kode} belum diisi.` };
      }
      // SEMUA aspek kini menerima angka 0-100 dari atasan.
      if (item.nilai < 0 || item.nilai > 100) {
        return { error: `Angka untuk ${asp.kode} harus 0-100.` };
      }
    }
  }

  // Pastikan pegawai & periode valid
  const [target, periode] = await Promise.all([
    prisma.pegawai.findUnique({ where: { id: pegawaiId } }),
    prisma.periode.findUnique({ where: { id: periodeId } }),
  ]);
  if (!target) return { error: 'Pegawai tidak ditemukan.' };
  if (!periode) return { error: 'Periode tidak ditemukan.' };
  if (periode.dikunci) return { error: 'Periode sudah dikunci, penilaian tidak dapat diubah.' };

  // Foto diwajibkan saat mengirim penilaian. Draft boleh tanpa foto,
  // supaya atasan bisa mengisi skor dulu dan memotret di lain waktu.
  if (kirim) {
    const ada = await prisma.penilaian.findUnique({
      where: { pegawaiId_periodeId: { pegawaiId, periodeId } },
      select: { fotoData: true },
    });
    if (!ada?.fotoData) {
      return {
        error:
          'Foto penilaian belum ada. Unggah foto terlebih dahulu sebelum mengirim penilaian.',
      };
    }
  }

  // Konversi angka 0-100 setiap aspek ke skor 1-5, lalu hitung nilai.
  const denganSkor = aspek.map((a) => {
    const def = KATEGORI.flatMap((k) => k.aspek).find((x) => x.kode === a.kode)!;
    // Selalu pakai fungsi konversi resmi — jangan duplikasi logika di sini,
    // supaya tidak pernah menyimpang dari mesin penilaian.
    const skor = nilaiKeSkala(a.nilai);
    return { ...a, skor, bobotAspek: def.bobot };
  });

  // Mesin penilaian menerima skor 1-5 (hasil konversi), bukan angka mentah.
  const inputMesin: InputAspek[] = denganSkor.map((a) => ({
    kode: a.kode,
    nilai: a.skor,
  }));

  let hasil;
  try {
    hasil = hitungPenilaian(inputMesin);
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Gagal menghitung nilai.' };
  }

  const nilaiA = hasil.kategori.find((k) => k.kode === 'A')!.nilai;
  const nilaiB = hasil.kategori.find((k) => k.kode === 'B')!.nilai;
  const nilaiC = hasil.kategori.find((k) => k.kode === 'C')!.nilai;

  const status = kirim ? 'DIKIRIM' : 'DRAFT';

  try {
    // ambil nilai lama (kalau ada) untuk dicatat di audit log — penting
    // ketika atasan mengubah penilaian yang sudah pernah disimpan
    const sebelumnya = await prisma.penilaian.findUnique({
      where: { pegawaiId_periodeId: { pegawaiId, periodeId } },
      select: {
        status: true,
        nilaiAkhir: true,
        rating: true,
        nilaiPenampilan: true,
        nilaiKemampuan: true,
        nilaiSikap: true,
      },
    });

    const penilaian = await prisma.$transaction(async (tx) => {
      const p = await tx.penilaian.upsert({
        where: { pegawaiId_periodeId: { pegawaiId, periodeId } },
        update: {
          penilaiId: penilai.id,
          status,
          nilaiPenampilan: nilaiA,
          nilaiKemampuan: nilaiB,
          nilaiSikap: nilaiC,
          nilaiAkhir: hasil.nilaiAkhir,
          rating: hasil.rating.label,
          bobotTersimpan: JSON.parse(JSON.stringify(KATEGORI)),
          catatanUmum,
          dikirimAt: kirim ? new Date() : null,
        },
        create: {
          pegawaiId,
          penilaiId: penilai.id,
          periodeId,
          status,
          nilaiPenampilan: nilaiA,
          nilaiKemampuan: nilaiB,
          nilaiSikap: nilaiC,
          nilaiAkhir: hasil.nilaiAkhir,
          rating: hasil.rating.label,
          bobotTersimpan: JSON.parse(JSON.stringify(KATEGORI)),
          catatanUmum,
          dikirimAt: kirim ? new Date() : null,
        },
      });

      // ganti detail: hapus lalu tulis ulang supaya tidak ada sisa aspek lama
      await tx.penilaianDetail.deleteMany({ where: { penilaianId: p.id } });
      await tx.penilaianDetail.createMany({
        data: denganSkor.map((a) => ({
          penilaianId: p.id,
          kodeAspek: a.kode,
          nilaiMentah: a.nilai,
          skor: a.skor,
          bobotAspek: a.bobotAspek,
          catatan: a.catatan || null,
        })),
      });

      return p;
    });

    await catatAudit({
      pegawaiId: penilai.id,
      aksi: kirim
        ? sebelumnya
          ? 'UBAH_LALU_KIRIM_PENILAIAN'
          : 'KIRIM_PENILAIAN'
        : sebelumnya
          ? 'UBAH_DRAFT_PENILAIAN'
          : 'SIMPAN_DRAFT_PENILAIAN',
      entitas: 'Penilaian',
      entitasId: penilaian.id,
      dataLama: sebelumnya
        ? {
            status: sebelumnya.status,
            nilaiAkhir: sebelumnya.nilaiAkhir,
            rating: sebelumnya.rating,
            nilaiPenampilan: sebelumnya.nilaiPenampilan,
            nilaiKemampuan: sebelumnya.nilaiKemampuan,
            nilaiSikap: sebelumnya.nilaiSikap,
          }
        : undefined,
      dataBaru: {
        pegawaiDinilai: target.nip,
        periode: periode.kode,
        status,
        nilaiAkhir: hasil.nilaiAkhir,
        rating: hasil.rating.label,
        nilaiPenampilan: nilaiA,
        nilaiKemampuan: nilaiB,
        nilaiSikap: nilaiC,
      },
    });

    revalidatePath('/penilaian');
    revalidatePath('/dasbor');

    return {
      sukses: true,
      nilaiAkhir: hasil.nilaiAkhir,
      rating: hasil.rating.label,
      // beri tahu pemanggil bahwa ini mengubah penilaian yang sudah ada
      diubah: Boolean(sebelumnya),
    };
  } catch (e) {
    console.error('[simpanPenilaian]', e);
    return { error: 'Gagal menyimpan penilaian. Coba lagi.' };
  }
}

// ============================================================================
// PINDAH & HAPUS PENILAIAN (admin)
// ============================================================================
// Sebelumnya periode penilaian terkunci setelah dibuat: tidak ada cara
// memperbaiki penilaian yang salah periode atau salah petugas dari aplikasi.
// Dua aksi di bawah membuka itu untuk ADMIN, dengan pengaman:
//   - pindah  : ditolak kalau periode tujuan sudah punya penilaian petugas yang sama
//   - hapus   : wajib menyebut nama petugas sebagai konfirmasi
//   - keduanya: dicatat ke audit log (siapa, dari mana, ke mana)

export type HasilPindah = {
  error?: string;
  sukses?: boolean;
  pesan?: string;
};

/** Daftar periode yang bisa dipilih sebagai tujuan pindah. */
export async function daftarPeriodeTujuan(penilaianId: string) {
  const admin = await pegawaiDariSesi();
  if (!admin || !boleh(admin.role, 'kelola_penilaian')) return [];

  const penilaian = await prisma.penilaian.findUnique({
    where: { id: penilaianId },
    select: { pegawaiId: true, periodeId: true },
  });
  if (!penilaian) return [];

  // periode yang sudah punya penilaian untuk petugas ini tidak boleh jadi tujuan
  const terpakai = await prisma.penilaian.findMany({
    where: { pegawaiId: penilaian.pegawaiId },
    select: { periodeId: true },
  });
  const dipakai = new Set(terpakai.map((p) => p.periodeId));

  return prisma.periode.findMany({
    where: { id: { notIn: [...dipakai] } },
    select: { id: true, nama: true, tanggalMulai: true, tanggalSelesai: true },
    orderBy: { tanggalMulai: 'desc' },
  });
}

export async function pindahPenilaian(
  _sebelumnya: HasilPindah,
  formData: FormData
): Promise<HasilPindah> {
  const admin = await pegawaiDariSesi();
  if (!admin) return { error: 'Sesi habis. Silakan masuk kembali.' };
  const tolakPindah = wajibKemampuan(admin, 'kelola_penilaian');
  if (tolakPindah) return { error: tolakPindah };

  const penilaianId = String(formData.get('penilaianId') ?? '');
  const periodeTujuanId = String(formData.get('periodeTujuanId') ?? '');
  if (!penilaianId || !periodeTujuanId) {
    return { error: 'Penilaian dan periode tujuan harus dipilih.' };
  }

  try {
    const penilaian = await prisma.penilaian.findUnique({
      where: { id: penilaianId },
      include: {
        periode: { select: { id: true, nama: true, kode: true } },
        pegawai: { select: { nama: true } },
      },
    });
    if (!penilaian) return { error: 'Penilaian tidak ditemukan.' };

    const tujuan = await prisma.periode.findUnique({
      where: { id: periodeTujuanId },
      select: { id: true, nama: true, kode: true },
    });
    if (!tujuan) return { error: 'Periode tujuan tidak ditemukan.' };

    if (penilaian.periodeId === tujuan.id) {
      return { error: 'Penilaian sudah ada di periode itu.' };
    }

    // pengaman: periode tujuan tidak boleh sudah punya penilaian petugas yang sama
    const bentrok = await prisma.penilaian.findUnique({
      where: {
        pegawaiId_periodeId: { pegawaiId: penilaian.pegawaiId, periodeId: tujuan.id },
      },
      select: { id: true },
    });
    if (bentrok) {
      return {
        error: `${penilaian.pegawai.nama} sudah punya penilaian di ${tujuan.nama}. Hapus dulu yang di sana.`,
      };
    }

    await prisma.penilaian.update({
      where: { id: penilaianId },
      data: { periodeId: tujuan.id },
    });

    await catatAudit({
      pegawaiId: admin.id,
      aksi: 'PINDAH_PENILAIAN',
      entitas: 'Penilaian',
      entitasId: penilaianId,
      dataLama: { periode: penilaian.periode.kode, namaPeriode: penilaian.periode.nama },
      dataBaru: { periode: tujuan.kode, namaPeriode: tujuan.nama, pegawai: penilaian.pegawai.nama },
    });

    revalidatePath('/penilaian');
    revalidatePath('/dasbor');
    revalidatePath('/laporan');
    revalidatePath('/parameter/audit');

    return {
      sukses: true,
      pesan: `${penilaian.pegawai.nama} dipindahkan ke ${tujuan.nama}.`,
    };
  } catch (e) {
    console.error('[pindahPenilaian]', e);
    return { error: 'Gagal memindahkan penilaian. Coba lagi.' };
  }
}

export type HasilHapus = {
  error?: string;
  sukses?: boolean;
  pesan?: string;
};

export async function hapusPenilaian(
  _sebelumnya: HasilHapus,
  formData: FormData
): Promise<HasilHapus> {
  const admin = await pegawaiDariSesi();
  if (!admin) return { error: 'Sesi habis. Silakan masuk kembali.' };
  const tolakHapus = wajibKemampuan(admin, 'kelola_penilaian');
  if (tolakHapus) return { error: tolakHapus };

  const penilaianId = String(formData.get('penilaianId') ?? '');
  const konfirmasi = String(formData.get('konfirmasi') ?? '').trim();
  if (!penilaianId) return { error: 'Penilaian tidak dipilih.' };

  try {
    const penilaian = await prisma.penilaian.findUnique({
      where: { id: penilaianId },
      include: {
        periode: { select: { kode: true, nama: true } },
        pegawai: { select: { nama: true } },
        detail: true,
      },
    });
    if (!penilaian) return { error: 'Penilaian tidak ditemukan.' };

    // konfirmasi: nama petugas harus diketik persis (tanpa peduli besar-kecil huruf)
    if (konfirmasi.toUpperCase() !== penilaian.pegawai.nama.trim().toUpperCase()) {
      return {
        error: `Konfirmasi tidak cocok. Ketik nama petugas persis: ${penilaian.pegawai.nama}`,
      };
    }

    // hapus detail dulu (FK), lalu penilaiannya
    await prisma.$transaction([
      prisma.penilaianDetail.deleteMany({ where: { penilaianId } }),
      prisma.penilaian.delete({ where: { id: penilaianId } }),
    ]);

    await catatAudit({
      pegawaiId: admin.id,
      aksi: 'HAPUS_PENILAIAN',
      entitas: 'Penilaian',
      entitasId: penilaianId,
      dataLama: {
        pegawai: penilaian.pegawai.nama,
        periode: penilaian.periode.kode,
        namaPeriode: penilaian.periode.nama,
        status: penilaian.status,
        nilaiAkhir: penilaian.nilaiAkhir,
        jumlahAspek: penilaian.detail.length,
      },
    });

    revalidatePath('/penilaian');
    revalidatePath('/dasbor');
    revalidatePath('/laporan');
    revalidatePath('/parameter/audit');

    return {
      sukses: true,
      pesan: `Penilaian ${penilaian.pegawai.nama} (${penilaian.periode.nama}) dihapus.`,
    };
  } catch (e) {
    console.error('[hapusPenilaian]', e);
    return { error: 'Gagal menghapus penilaian. Coba lagi.' };
  }
}
