-- CreateEnum
CREATE TYPE "StatusPengajuan" AS ENUM ('MENUNGGU', 'DISETUJUI', 'DITOLAK');

-- CreateTable
CREATE TABLE "PengajuanPegawai" (
    "id" TEXT NOT NULL,
    "status" "StatusPengajuan" NOT NULL DEFAULT 'MENUNGGU',
    "nip" TEXT NOT NULL,
    "nama" TEXT NOT NULL,
    "email" TEXT,
    "passwordHash" TEXT NOT NULL,
    "cabangId" TEXT NOT NULL,
    "jabatanId" TEXT,
    "atasanId" TEXT,
    "pengajuId" TEXT NOT NULL,
    "catatanPengaju" TEXT,
    "diputuskanOlehId" TEXT,
    "catatanAdmin" TEXT,
    "diputuskanAt" TIMESTAMP(3),
    "pegawaiId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PengajuanPegawai_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PengajuanPegawai_pegawaiId_key" ON "PengajuanPegawai"("pegawaiId");

-- CreateIndex
CREATE INDEX "PengajuanPegawai_status_idx" ON "PengajuanPegawai"("status");

-- CreateIndex
CREATE INDEX "PengajuanPegawai_cabangId_idx" ON "PengajuanPegawai"("cabangId");

-- CreateIndex
CREATE INDEX "PengajuanPegawai_pengajuId_idx" ON "PengajuanPegawai"("pengajuId");

-- AddForeignKey
ALTER TABLE "PengajuanPegawai" ADD CONSTRAINT "PengajuanPegawai_cabangId_fkey" FOREIGN KEY ("cabangId") REFERENCES "Cabang"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PengajuanPegawai" ADD CONSTRAINT "PengajuanPegawai_jabatanId_fkey" FOREIGN KEY ("jabatanId") REFERENCES "Jabatan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PengajuanPegawai" ADD CONSTRAINT "PengajuanPegawai_atasanId_fkey" FOREIGN KEY ("atasanId") REFERENCES "Pegawai"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PengajuanPegawai" ADD CONSTRAINT "PengajuanPegawai_pengajuId_fkey" FOREIGN KEY ("pengajuId") REFERENCES "Pegawai"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PengajuanPegawai" ADD CONSTRAINT "PengajuanPegawai_diputuskanOlehId_fkey" FOREIGN KEY ("diputuskanOlehId") REFERENCES "Pegawai"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PengajuanPegawai" ADD CONSTRAINT "PengajuanPegawai_pegawaiId_fkey" FOREIGN KEY ("pegawaiId") REFERENCES "Pegawai"("id") ON DELETE SET NULL ON UPDATE CASCADE;
