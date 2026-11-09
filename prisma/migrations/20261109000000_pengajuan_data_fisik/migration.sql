CREATE TABLE "PerubahanDataPegawai" (
  "id" TEXT NOT NULL,
  "status" "StatusPengajuan" NOT NULL DEFAULT 'MENUNGGU',
  "pegawaiId" TEXT NOT NULL,
  "pengajuId" TEXT NOT NULL,
  "diputuskanOlehId" TEXT,
  "tanggalLahirLama" TIMESTAMP(3),
  "tanggalLahirBaru" TIMESTAMP(3),
  "tinggiBadanLama" DOUBLE PRECISION,
  "tinggiBadanBaru" DOUBLE PRECISION,
  "catatanPengaju" TEXT,
  "catatanAdmin" TEXT,
  "diputuskanAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PerubahanDataPegawai_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "PerubahanDataPegawai_status_idx" ON "PerubahanDataPegawai"("status");
CREATE INDEX "PerubahanDataPegawai_pegawaiId_idx" ON "PerubahanDataPegawai"("pegawaiId");
CREATE INDEX "PerubahanDataPegawai_pengajuId_idx" ON "PerubahanDataPegawai"("pengajuId");
ALTER TABLE "PerubahanDataPegawai" ADD CONSTRAINT "PerubahanDataPegawai_pegawaiId_fkey" FOREIGN KEY ("pegawaiId") REFERENCES "Pegawai"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PerubahanDataPegawai" ADD CONSTRAINT "PerubahanDataPegawai_pengajuId_fkey" FOREIGN KEY ("pengajuId") REFERENCES "Pegawai"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PerubahanDataPegawai" ADD CONSTRAINT "PerubahanDataPegawai_diputuskanOlehId_fkey" FOREIGN KEY ("diputuskanOlehId") REFERENCES "Pegawai"("id") ON DELETE SET NULL ON UPDATE CASCADE;
