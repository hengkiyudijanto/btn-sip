'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { pegawaiDariSesi, catatAudit } from '@/lib/auth';
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

/** Role yang boleh menilai petugas. */
const BOLEH_MENILAI = new Set(['SUPERVISOR', 'MANAGER', 'ADMIN']);

export async function simpanPenilaian(
  _sebelumnya: HasilSimpan,
  formData: FormData
): Promise<HasilSimpan> {
  const penilai = await pegawaiDariSesi();
  if (!penilai) return { error: 'Sesi habis. Silakan masuk kembali.' };
  if (!BOLEH_MENILAI.has(penilai.role)) {
    return { error: 'Anda tidak berwenang melakukan penilaian.' };
  }

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
