-- CreateEnum
CREATE TYPE "EstadoIngreso" AS ENUM ('EN_PROCESO', 'COMPLETADO', 'CANCELADO');

-- CreateTable
CREATE TABLE "ingresos" (
    "id" SERIAL NOT NULL,
    "pacienteId" INTEGER NOT NULL,
    "usuarioId" INTEGER NOT NULL,
    "motivoIngreso" TEXT,
    "estado" "EstadoIngreso" NOT NULL DEFAULT 'EN_PROCESO',
    "pasoActual" INTEGER NOT NULL DEFAULT 1,
    "fechaCita" TIMESTAMP(3),
    "horaCita" TEXT,
    "medicoAsignado" TEXT,
    "resultadoValoracion" TEXT,
    "observacionesValoracion" TEXT,
    "esApto" BOOLEAN,
    "motivoNoApto" TEXT,
    "habitacionAsignada" TEXT,
    "areaAsignada" TEXT,
    "fechaIngreso" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ingresos_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "ingresos" ADD CONSTRAINT "ingresos_pacienteId_fkey" FOREIGN KEY ("pacienteId") REFERENCES "pacientes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ingresos" ADD CONSTRAINT "ingresos_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
