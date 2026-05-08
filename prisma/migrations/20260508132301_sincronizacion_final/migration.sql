-- CreateEnum
CREATE TYPE "TipoEgreso" AS ENUM ('ALTA_MEDICA', 'ALTA_VOLUNTARIA', 'EXPULSION', 'FUGA', 'TRASLADO');

-- CreateEnum
CREATE TYPE "TipoSesion" AS ENUM ('PSICOLOGIA', 'CONSEJERIA', 'FAMILIA', 'SEGUIMIENTO');

-- CreateEnum
CREATE TYPE "TipoNotificacion" AS ENUM ('INFO', 'ALERTA', 'EXITO', 'ERROR');

-- CreateTable
CREATE TABLE "egresos_registros" (
    "id" SERIAL NOT NULL,
    "pacienteId" INTEGER NOT NULL,
    "fechaEgreso" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tipoEgreso" "TipoEgreso" NOT NULL,
    "notaMedica" TEXT,
    "saldoPendiente" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "pertenenciasEntregadas" BOOLEAN NOT NULL DEFAULT false,
    "inscritoReforzamiento" BOOLEAN NOT NULL DEFAULT false,
    "autorizadoPorId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "egresos_registros_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notas_sesiones_clinicas" (
    "id" SERIAL NOT NULL,
    "expedienteId" INTEGER NOT NULL,
    "usuarioId" INTEGER NOT NULL,
    "tipo" "TipoSesion" NOT NULL,
    "nota" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notas_sesiones_clinicas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "planes_nutricionales" (
    "id" SERIAL NOT NULL,
    "expedienteId" INTEGER NOT NULL,
    "usuarioId" INTEGER NOT NULL,
    "peso" DOUBLE PRECISION,
    "talla" DOUBLE PRECISION,
    "imc" DOUBLE PRECISION,
    "diagnostico" TEXT,
    "objetivos" TEXT,
    "recomendaciones" TEXT,
    "restricciones" TEXT,
    "observaciones" TEXT,
    "fechaEvaluacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "planes_nutricionales_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notificaciones" (
    "id" SERIAL NOT NULL,
    "titulo" TEXT NOT NULL,
    "mensaje" TEXT NOT NULL,
    "tipo" "TipoNotificacion" NOT NULL DEFAULT 'INFO',
    "leida" BOOLEAN NOT NULL DEFAULT false,
    "link" TEXT,
    "usuarioId" INTEGER,
    "rol" "Rol",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notificaciones_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "egresos_registros_pacienteId_key" ON "egresos_registros"("pacienteId");

-- CreateIndex
CREATE UNIQUE INDEX "planes_nutricionales_expedienteId_key" ON "planes_nutricionales"("expedienteId");

-- AddForeignKey
ALTER TABLE "egresos_registros" ADD CONSTRAINT "egresos_registros_pacienteId_fkey" FOREIGN KEY ("pacienteId") REFERENCES "pacientes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "egresos_registros" ADD CONSTRAINT "egresos_registros_autorizadoPorId_fkey" FOREIGN KEY ("autorizadoPorId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notas_sesiones_clinicas" ADD CONSTRAINT "notas_sesiones_clinicas_expedienteId_fkey" FOREIGN KEY ("expedienteId") REFERENCES "expedientes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notas_sesiones_clinicas" ADD CONSTRAINT "notas_sesiones_clinicas_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "planes_nutricionales" ADD CONSTRAINT "planes_nutricionales_expedienteId_fkey" FOREIGN KEY ("expedienteId") REFERENCES "expedientes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "planes_nutricionales" ADD CONSTRAINT "planes_nutricionales_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notificaciones" ADD CONSTRAINT "notificaciones_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;
