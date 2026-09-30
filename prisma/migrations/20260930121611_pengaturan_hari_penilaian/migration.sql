-- CreateTable
CREATE TABLE "pengaturan" (
    "id" TEXT NOT NULL DEFAULT 'utama',
    "hariPenilaian" INTEGER NOT NULL DEFAULT 3,
    "periodeTerbuatSampaiTahun" INTEGER,
    "diperbaruiOleh" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pengaturan_pkey" PRIMARY KEY ("id")
);
