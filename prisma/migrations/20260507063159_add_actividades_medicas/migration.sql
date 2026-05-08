-- CreateEnum
CREATE TYPE "TipoActividadMedica" AS ENUM ('INDIVIDUAL', 'COMUNITARIA');

-- CreateTable
CREATE TABLE "actividades_medicas" (
    "id" SERIAL NOT NULL,
    "titulo" TEXT NOT NULL,
    "descripcion" TEXT,
    "fecha" TIMESTAMP(3) NOT NULL,
    "hora" TEXT NOT NULL,
    "tipo" "TipoActividadMedica" NOT NULL,
    "responsable" TEXT NOT NULL,
    "icono" TEXT NOT NULL DEFAULT 'activity',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "actividades_medicas_pkey" PRIMARY KEY ("id")
);
