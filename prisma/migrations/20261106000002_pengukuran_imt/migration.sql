CREATE TABLE "PengukuranIMT" (
  "id" TEXT NOT NULL,
  "pegawaiId" TEXT NOT NULL,
  "pengukurId" TEXT NOT NULL,
  "periodeId" TEXT NOT NULL,
  "tanggal" TIMESTAMP(3) NOT NULL,
  "tinggiBadan" DOUBLE PRECISION NOT NULL,
  "beratBadan" DOUBLE PRECISION NOT NULL,
  "nilaiIMT" DOUBLE PRECISION NOT NULL,
  "kategori" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PengukuranIMT_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PengukuranIMT_pegawaiId_periodeId_tanggal_key" ON "PengukuranIMT"("pegawaiId", "periodeId", "tanggal");
CREATE INDEX "PengukuranIMT_periodeId_tanggal_idx" ON "PengukuranIMT"("periodeId", "tanggal");
CREATE INDEX "PengukuranIMT_pegawaiId_idx" ON "PengukuranIMT"("pegawaiId");
ALTER TABLE "PengukuranIMT" ADD CONSTRAINT "PengukuranIMT_pegawaiId_fkey" FOREIGN KEY ("pegawaiId") REFERENCES "Pegawai"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PengukuranIMT" ADD CONSTRAINT "PengukuranIMT_pengukurId_fkey" FOREIGN KEY ("pengukurId") REFERENCES "Pegawai"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PengukuranIMT" ADD CONSTRAINT "PengukuranIMT_periodeId_fkey" FOREIGN KEY ("periodeId") REFERENCES "Periode"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
