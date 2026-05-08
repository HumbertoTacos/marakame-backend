-- AlterEnum
ALTER TYPE "EstadoPaciente" ADD VALUE 'DETOX';

-- AlterTable
ALTER TABLE "expedientes" ADD COLUMN     "historiaClinica" JSONB;

-- CreateTable
CREATE TABLE "evaluaciones_resultados" (
    "id" SERIAL NOT NULL,
    "pacienteId" INTEGER NOT NULL,
    "usuarioId" INTEGER NOT NULL,
    "instrumento" TEXT NOT NULL,
    "puntajeTotal" DOUBLE PRECISION NOT NULL,
    "interpretacion" TEXT,
    "observaciones" TEXT,
    "fechaAplicacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "evaluaciones_resultados_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "evaluaciones_resultados" ADD CONSTRAINT "evaluaciones_resultados_pacienteId_fkey" FOREIGN KEY ("pacienteId") REFERENCES "pacientes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluaciones_resultados" ADD CONSTRAINT "evaluaciones_resultados_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
