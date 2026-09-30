import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

/**
 * Prisma client singleton.
 *
 * Prisma 7 tidak lagi membaca `url` dari schema — koneksi diserahkan ke
 * driver adapter. Kita pakai @prisma/adapter-pg dengan `pg` (node-postgres).
 *
 * Di mode development, Next.js hot-reload bisa membuat banyak instance —
 * kita simpan di globalThis supaya tidak membuka koneksi baru tiap reload.
 */
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function buatClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      'DATABASE_URL belum diset. Salin dari .env.local atau jalankan `neon link`.'
    );
  }

  const adapter = new PrismaPg({ connectionString });

  return new PrismaClient({
    adapter,
    log:
      process.env.NODE_ENV === 'development'
        ? ['query', 'error', 'warn']
        : ['error'],
  });
}

export const prisma = globalForPrisma.prisma ?? buatClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

export default prisma;
