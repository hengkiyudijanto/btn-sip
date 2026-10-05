-- CreateEnum
CREATE TYPE "JenisMedia" AS ENUM ('GAMBAR', 'VIDEO');

-- CreateEnum
CREATE TYPE "PlatformSosmed" AS ENUM ('TIKTOK', 'INSTAGRAM');

-- CreateTable
CREATE TABLE "KontenSosmed" (
    "id" TEXT NOT NULL,
    "judul" TEXT NOT NULL,
    "caption" TEXT NOT NULL DEFAULT '',
    "jenis" "JenisMedia" NOT NULL,
    "tujuan" TEXT NOT NULL DEFAULT 'KEDUANYA',
    "mediaData" TEXT,
    "mediaMime" TEXT,
    "mediaByte" INTEGER,
    "mediaLebar" INTEGER,
    "mediaTinggi" INTEGER,
    "durasiDetik" INTEGER,
    "mediaDilihat" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "catatanKreator" TEXT,
    "alasanRevisi" TEXT,
    "catatanPenyetuju" TEXT,
    "pembuatId" TEXT NOT NULL,
    "penyetujuId" TEXT,
    "pengajuId" TEXT,
    "diajukanAt" TIMESTAMP(3),
    "diputusAt" TIMESTAMP(3),
    "jumlahRevisi" INTEGER NOT NULL DEFAULT 0,
    "jadwalAt" TIMESTAMP(3),
    "hasilKirim" JSONB,
    "terkirimAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KontenSosmed_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KeputusanKonten" (
    "id" TEXT NOT NULL,
    "kontenId" TEXT NOT NULL,
    "aksi" TEXT NOT NULL,
    "catatan" TEXT,
    "olehId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KeputusanKonten_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "KontenSosmed_status_idx" ON "KontenSosmed"("status");

-- CreateIndex
CREATE INDEX "KontenSosmed_pembuatId_idx" ON "KontenSosmed"("pembuatId");

-- CreateIndex
CREATE INDEX "KontenSosmed_penyetujuId_idx" ON "KontenSosmed"("penyetujuId");

-- CreateIndex
CREATE INDEX "KontenSosmed_jadwalAt_idx" ON "KontenSosmed"("jadwalAt");

-- CreateIndex
CREATE INDEX "KontenSosmed_createdAt_idx" ON "KontenSosmed"("createdAt");

-- CreateIndex
CREATE INDEX "KeputusanKonten_kontenId_idx" ON "KeputusanKonten"("kontenId");

-- CreateIndex
CREATE INDEX "KeputusanKonten_olehId_idx" ON "KeputusanKonten"("olehId");

-- CreateIndex
CREATE INDEX "KeputusanKonten_createdAt_idx" ON "KeputusanKonten"("createdAt");

-- AddForeignKey
ALTER TABLE "KontenSosmed" ADD CONSTRAINT "KontenSosmed_pembuatId_fkey" FOREIGN KEY ("pembuatId") REFERENCES "Pegawai"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KontenSosmed" ADD CONSTRAINT "KontenSosmed_penyetujuId_fkey" FOREIGN KEY ("penyetujuId") REFERENCES "Pegawai"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KontenSosmed" ADD CONSTRAINT "KontenSosmed_pengajuId_fkey" FOREIGN KEY ("pengajuId") REFERENCES "Pegawai"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KeputusanKonten" ADD CONSTRAINT "KeputusanKonten_kontenId_fkey" FOREIGN KEY ("kontenId") REFERENCES "KontenSosmed"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KeputusanKonten" ADD CONSTRAINT "KeputusanKonten_olehId_fkey" FOREIGN KEY ("olehId") REFERENCES "Pegawai"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
