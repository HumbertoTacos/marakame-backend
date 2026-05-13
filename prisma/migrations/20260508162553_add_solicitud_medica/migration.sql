-- CreateEnum
CREATE TYPE "EstadoSolicitudMedica" AS ENUM ('PENDIENTE', 'ATENDIDA');

-- CreateTable
CREATE TABLE "solicitudes_medicas" (
    "id" SERIAL NOT NULL,
    "emisorId" INTEGER NOT NULL,
    "contenido" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "estado" "EstadoSolicitudMedica" NOT NULL DEFAULT 'PENDIENTE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "solicitudes_medicas_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "solicitudes_medicas" ADD CONSTRAINT "solicitudes_medicas_emisorId_fkey" FOREIGN KEY ("emisorId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
