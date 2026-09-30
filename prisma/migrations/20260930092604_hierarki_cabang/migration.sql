-- CreateEnum
CREATE TYPE "JenisCabang" AS ENUM ('KANWIL', 'KC', 'KCP');

-- AlterTable
ALTER TABLE "Cabang" ADD COLUMN     "indukId" TEXT,
ADD COLUMN     "jenis" "JenisCabang" NOT NULL DEFAULT 'KC';

-- CreateIndex
CREATE INDEX "Cabang_indukId_idx" ON "Cabang"("indukId");

-- CreateIndex
CREATE INDEX "Cabang_jenis_idx" ON "Cabang"("jenis");

-- AddForeignKey
ALTER TABLE "Cabang" ADD CONSTRAINT "Cabang_indukId_fkey" FOREIGN KEY ("indukId") REFERENCES "Cabang"("id") ON DELETE SET NULL ON UPDATE CASCADE;
