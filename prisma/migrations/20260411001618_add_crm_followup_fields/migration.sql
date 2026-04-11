-- CreateEnum
CREATE TYPE "TipoAcuerdoSeguimiento" AS ENUM ('LLAMARA_PROSPECTO', 'LLAMARA_MARAKAME', 'CITA_PROGRAMADA', 'RECHAZADO');

-- AlterEnum
ALTER TYPE "EstadoDocumentoExpediente" ADD VALUE 'COMPLETADO';

-- AlterTable
ALTER TABLE "documentos_expediente_fisico" ADD COLUMN     "archivoUrl" TEXT;

-- AlterTable
ALTER TABLE "nominas" ADD COLUMN     "fechaAutorizacion" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "primer_contacto" ADD COLUMN     "acuerdoSeguimiento" "TipoAcuerdoSeguimiento",
ADD COLUMN     "fechaSeguimiento" TIMESTAMP(3);
