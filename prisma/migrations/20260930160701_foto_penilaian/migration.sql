-- AlterTable
ALTER TABLE "Penilaian" ADD COLUMN     "fotoCatatan" TEXT,
ADD COLUMN     "fotoData" TEXT,
ADD COLUMN     "fotoDiperbarui" TIMESTAMP(3),
ADD COLUMN     "fotoMime" TEXT,
ADD COLUMN     "fotoUkuran" INTEGER;
