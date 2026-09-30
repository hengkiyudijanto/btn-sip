-- CreateEnum
CREATE TYPE "Role" AS ENUM ('PEGAWAI', 'SUPERVISOR', 'MANAGER', 'ADMIN');

-- CreateEnum
CREATE TYPE "StatusPenilaian" AS ENUM ('DRAFT', 'DIKIRIM', 'DIKETAHUI', 'FINAL');

-- CreateTable
CREATE TABLE "Cabang" (
    "id" TEXT NOT NULL,
    "kode" TEXT NOT NULL,
    "nama" TEXT NOT NULL,
    "alamat" TEXT,
    "aktif" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Cabang_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Jabatan" (
    "id" TEXT NOT NULL,
    "kode" TEXT NOT NULL,
    "nama" TEXT NOT NULL,
    "namaEn" TEXT,
    "aktif" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Jabatan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Pegawai" (
    "id" TEXT NOT NULL,
    "nip" TEXT NOT NULL,
    "nama" TEXT NOT NULL,
    "email" TEXT,
    "fotoUrl" TEXT,
    "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'PEGAWAI',
    "aktif" BOOLEAN NOT NULL DEFAULT true,
    "harusGantiPassword" BOOLEAN NOT NULL DEFAULT true,
    "lastLoginAt" TIMESTAMP(3),
    "cabangId" TEXT NOT NULL,
    "jabatanId" TEXT,
    "atasanId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Pegawai_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Periode" (
    "id" TEXT NOT NULL,
    "kode" TEXT NOT NULL,
    "nama" TEXT NOT NULL,
    "tanggalMulai" TIMESTAMP(3) NOT NULL,
    "tanggalSelesai" TIMESTAMP(3) NOT NULL,
    "aktif" BOOLEAN NOT NULL DEFAULT true,
    "dikunci" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Periode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Penilaian" (
    "id" TEXT NOT NULL,
    "pegawaiId" TEXT NOT NULL,
    "penilaiId" TEXT NOT NULL,
    "mengetahuiId" TEXT,
    "periodeId" TEXT NOT NULL,
    "status" "StatusPenilaian" NOT NULL DEFAULT 'DRAFT',
    "nilaiPenampilan" DOUBLE PRECISION,
    "nilaiKemampuan" DOUBLE PRECISION,
    "nilaiSikap" DOUBLE PRECISION,
    "nilaiAkhir" DOUBLE PRECISION,
    "rating" TEXT,
    "bobotTersimpan" JSONB,
    "catatanUmum" TEXT,
    "dikirimAt" TIMESTAMP(3),
    "diketahuiAt" TIMESTAMP(3),
    "finalAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Penilaian_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PenilaianDetail" (
    "id" TEXT NOT NULL,
    "penilaianId" TEXT NOT NULL,
    "kodeAspek" TEXT NOT NULL,
    "nilaiMentah" DOUBLE PRECISION NOT NULL,
    "skor" INTEGER NOT NULL,
    "bobotAspek" DOUBLE PRECISION NOT NULL,
    "catatan" TEXT,

    CONSTRAINT "PenilaianDetail_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "pegawaiId" TEXT,
    "aksi" TEXT NOT NULL,
    "entitas" TEXT,
    "entitasId" TEXT,
    "dataLama" JSONB,
    "dataBaru" JSONB,
    "ip" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Sesi" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "pegawaiId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "ip" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Sesi_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Cabang_kode_key" ON "Cabang"("kode");

-- CreateIndex
CREATE INDEX "Cabang_kode_idx" ON "Cabang"("kode");

-- CreateIndex
CREATE UNIQUE INDEX "Jabatan_kode_key" ON "Jabatan"("kode");

-- CreateIndex
CREATE INDEX "Jabatan_kode_idx" ON "Jabatan"("kode");

-- CreateIndex
CREATE UNIQUE INDEX "Pegawai_nip_key" ON "Pegawai"("nip");

-- CreateIndex
CREATE UNIQUE INDEX "Pegawai_email_key" ON "Pegawai"("email");

-- CreateIndex
CREATE INDEX "Pegawai_cabangId_idx" ON "Pegawai"("cabangId");

-- CreateIndex
CREATE INDEX "Pegawai_jabatanId_idx" ON "Pegawai"("jabatanId");

-- CreateIndex
CREATE INDEX "Pegawai_role_idx" ON "Pegawai"("role");

-- CreateIndex
CREATE UNIQUE INDEX "Periode_kode_key" ON "Periode"("kode");

-- CreateIndex
CREATE INDEX "Periode_tanggalMulai_idx" ON "Periode"("tanggalMulai");

-- CreateIndex
CREATE UNIQUE INDEX "Periode_tanggalMulai_tanggalSelesai_key" ON "Periode"("tanggalMulai", "tanggalSelesai");

-- CreateIndex
CREATE INDEX "Penilaian_penilaiId_idx" ON "Penilaian"("penilaiId");

-- CreateIndex
CREATE INDEX "Penilaian_periodeId_status_idx" ON "Penilaian"("periodeId", "status");

-- CreateIndex
CREATE INDEX "Penilaian_pegawaiId_idx" ON "Penilaian"("pegawaiId");

-- CreateIndex
CREATE UNIQUE INDEX "Penilaian_pegawaiId_periodeId_key" ON "Penilaian"("pegawaiId", "periodeId");

-- CreateIndex
CREATE INDEX "PenilaianDetail_penilaianId_idx" ON "PenilaianDetail"("penilaianId");

-- CreateIndex
CREATE UNIQUE INDEX "PenilaianDetail_penilaianId_kodeAspek_key" ON "PenilaianDetail"("penilaianId", "kodeAspek");

-- CreateIndex
CREATE INDEX "AuditLog_pegawaiId_createdAt_idx" ON "AuditLog"("pegawaiId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_entitas_entitasId_idx" ON "AuditLog"("entitas", "entitasId");

-- CreateIndex
CREATE UNIQUE INDEX "Sesi_tokenHash_key" ON "Sesi"("tokenHash");

-- CreateIndex
CREATE INDEX "Sesi_pegawaiId_idx" ON "Sesi"("pegawaiId");

-- CreateIndex
CREATE INDEX "Sesi_expiresAt_idx" ON "Sesi"("expiresAt");

-- AddForeignKey
ALTER TABLE "Pegawai" ADD CONSTRAINT "Pegawai_cabangId_fkey" FOREIGN KEY ("cabangId") REFERENCES "Cabang"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pegawai" ADD CONSTRAINT "Pegawai_jabatanId_fkey" FOREIGN KEY ("jabatanId") REFERENCES "Jabatan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pegawai" ADD CONSTRAINT "Pegawai_atasanId_fkey" FOREIGN KEY ("atasanId") REFERENCES "Pegawai"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Penilaian" ADD CONSTRAINT "Penilaian_pegawaiId_fkey" FOREIGN KEY ("pegawaiId") REFERENCES "Pegawai"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Penilaian" ADD CONSTRAINT "Penilaian_penilaiId_fkey" FOREIGN KEY ("penilaiId") REFERENCES "Pegawai"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Penilaian" ADD CONSTRAINT "Penilaian_mengetahuiId_fkey" FOREIGN KEY ("mengetahuiId") REFERENCES "Pegawai"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Penilaian" ADD CONSTRAINT "Penilaian_periodeId_fkey" FOREIGN KEY ("periodeId") REFERENCES "Periode"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PenilaianDetail" ADD CONSTRAINT "PenilaianDetail_penilaianId_fkey" FOREIGN KEY ("penilaianId") REFERENCES "Penilaian"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_pegawaiId_fkey" FOREIGN KEY ("pegawaiId") REFERENCES "Pegawai"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sesi" ADD CONSTRAINT "Sesi_pegawaiId_fkey" FOREIGN KEY ("pegawaiId") REFERENCES "Pegawai"("id") ON DELETE CASCADE ON UPDATE CASCADE;
