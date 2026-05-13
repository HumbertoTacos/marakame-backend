-- CreateEnum
CREATE TYPE "TipoAsistencia" AS ENUM ('ASISTENCIA', 'FALTA', 'RETARDO');

-- CreateEnum
CREATE TYPE "EstadoJustificacion" AS ENUM ('NO_APLICA', 'PENDIENTE', 'APROBADA', 'RECHAZADA');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "EstadoCompra" ADD VALUE 'REQUISICION_REVISADA';
ALTER TYPE "EstadoCompra" ADD VALUE 'EN_REVISION_ADMIN';
ALTER TYPE "EstadoCompra" ADD VALUE 'EN_AUTORIZACION_DIRECCION';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "Rol" ADD VALUE 'RECURSOS_HUMANOS';
ALTER TYPE "Rol" ADD VALUE 'RECURSOS_FINANCIEROS';
ALTER TYPE "Rol" ADD VALUE 'JEFE_ADMINISTRATIVO';

-- AlterTable
ALTER TABLE "nominas" ADD COLUMN     "archivoAsistenciasUrl" TEXT,
ADD COLUMN     "archivoNominaFinalUrl" TEXT,
ADD COLUMN     "archivoSubsidioUrl" TEXT,
ADD COLUMN     "archivoUrl" TEXT,
ADD COLUMN     "regimen" TEXT;

-- CreateTable
CREATE TABLE "registros_asistencia" (
    "id" SERIAL NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL,
    "tipo" "TipoAsistencia" NOT NULL DEFAULT 'ASISTENCIA',
    "motivoJustificacion" TEXT,
    "documentoUrl" TEXT,
    "estadoJustificacion" "EstadoJustificacion" NOT NULL DEFAULT 'NO_APLICA',
    "empleadoId" INTEGER NOT NULL,
    "nominaId" INTEGER,
    "registradoPorId" INTEGER,
    "revisadoPorId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "registros_asistencia_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "registros_asistencia" ADD CONSTRAINT "registros_asistencia_empleadoId_fkey" FOREIGN KEY ("empleadoId") REFERENCES "empleados"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registros_asistencia" ADD CONSTRAINT "registros_asistencia_nominaId_fkey" FOREIGN KEY ("nominaId") REFERENCES "nominas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registros_asistencia" ADD CONSTRAINT "registros_asistencia_registradoPorId_fkey" FOREIGN KEY ("registradoPorId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registros_asistencia" ADD CONSTRAINT "registros_asistencia_revisadoPorId_fkey" FOREIGN KEY ("revisadoPorId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;
