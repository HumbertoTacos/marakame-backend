-- AlterTable
ALTER TABLE "estudio_socioeconomico" ADD COLUMN     "ingresoMensualRango" TEXT,
ADD COLUMN     "murosMaterial" TEXT,
ADD COLUMN     "numeroHabitacionesRango" TEXT,
ADD COLUMN     "pisoMaterial" TEXT,
ADD COLUMN     "techoMaterial" TEXT,
ADD COLUMN     "tieneMasDeUnaVivienda" BOOLEAN DEFAULT false,
ADD COLUMN     "totalEgresosCalculado" DOUBLE PRECISION;
