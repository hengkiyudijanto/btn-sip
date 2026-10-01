import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { rapikanHasil } from './rapikan-data';

/**
 * Prisma client singleton.
 *
 * Prisma 7 tidak lagi membaca `url` dari schema — koneksi diserahkan ke
 * driver adapter. Kita pakai @prisma/adapter-pg dengan `pg` (node-postgres).
 *
 * Di mode development, Next.js hot-reload bisa membuat banyak instance —
 * kita simpan di globalThis supaya tidak membuka koneksi baru tiap reload.
 *
 * ATURAN KAPITALISASI (permintaan user) diterapkan di sini lewat `$extends`:
 * setiap hasil query dari model Pegawai/Cabang/Jabatan dirapikan hurufnya
 * sebelum sampai ke tampilan. Ditaruh di satu titik ini supaya tidak ada
 * halaman yang terlewat — lihat src/lib/rapikan-data.ts.
 */
const globalForPrisma = globalThis as unknown as {
  prisma: ReturnType<typeof buatClient> | undefined;
};

/** Model yang nama-nya memakai aturan khusus cabang (KC/KCP kapital semua). */
const MODEL_COBA_RAPI = new Set(['Pegawai', 'Cabang', 'Jabatan']);

function buatClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      'DATABASE_URL belum diset. Salin dari .env.local atau jalankan `neon link`.'
    );
  }

  const adapter = new PrismaPg({ connectionString });
  const dasar = new PrismaClient({
    adapter,
    log:
      process.env.NODE_ENV === 'development'
        ? ['query', 'error', 'warn']
        : ['error'],
  });

  return dasar.$extends({
    name: 'rapikan-nama',
    query: {
      $allModels: {
        async $allOperations({ model, args, query }) {
          const hasil = await query(args);

          // JANGAN saring berdasarkan nama model di sini.
          //
          // Awalnya kode ini melewati model yang tidak ada di daftar, dan
          // akibatnya nama pada RELASI bersarang tidak ikut dirapikan:
          // `prisma.penilaian.findMany({ select: { pegawai: { select: {
          // nama: true } } } })` mengembalikan "MARINA KADIR" apa adanya,
          // karena query-nya ke model Penilaian (bukan Pegawai) sehingga
          // dilewati lebih dulu. Yang salah bukan hanya nilainya, tapi
          // seluruh hasil query itu jadi tidak pernah ditelusuri.
          //
          // Penelusurannya murah (hanya menyentuh objek yang punya `nama`),
          // jadi dijalankan untuk semua model. Aturan mana yang dipakai
          // ditentukan dari nama model yang sebenarnya (lihat rapikanHasil).
          return rapikanHasil(hasil, model ?? '', MODEL_COBA_RAPI);
        },
      },
    },
  });
}

export const prisma = globalForPrisma.prisma ?? buatClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

export default prisma;
