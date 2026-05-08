/*
  Warnings:

  - The values [BORRADOR,PENDIENTE_COTIZACION,EN_COMPARATIVO,PENDIENTE_AUTORIZACION,AUTORIZADO] on the enum `EstadoCompra` will be removed. If these variants are still used in the database, this will fail.
  - The values [PENDIENTE] on the enum `EstadoNomina` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `bonos` on the `prenominas` table. All the data in the column will be lost.
  - You are about to drop the column `deducciones` on the `prenominas` table. All the data in the column will be lost.
  - You are about to drop the column `salarioBase` on the `prenominas` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[folio]` on the table `compras_ordenes` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `folio` to the `compras_ordenes` table without a default value. This is not possible if the table is not empty.
  - Added the required column `tipo` to the `compras_requisiciones` table without a default value. This is not possible if the table is not empty.
  - Added the required column `claveUnica` to the `pacientes` table without a default value. This is not possible if the table is not empty.
  - Added the required column `sueldoBruto` to the `prenominas` table without a default value. This is not possible if the table is not empty.
  - Added the required column `totalDeducciones` to the `prenominas` table without a default value. This is not possible if the table is not empty.
  - Added the required column `totalPercepciones` to the `prenominas` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "TipoCompra" AS ENUM ('ORDINARIA', 'EXTRAORDINARIA');

-- CreateEnum
CREATE TYPE "RegimenLaboral" AS ENUM ('CONFIANZA', 'LISTA_RAYA');

-- CreateEnum
CREATE TYPE "TipoIncidencia" AS ENUM ('INASISTENCIA', 'RETARDO', 'SALIDA_ANTICIPADA', 'FALTA_JUSTIFICADA');

-- CreateTable
CREATE TABLE "compras_historial" (
    "id" SERIAL NOT NULL,
    "requisicionId" INTEGER NOT NULL,
    "estado" "EstadoCompra" NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "usuarioId" INTEGER NOT NULL,

    CONSTRAINT "compras_historial_pkey" PRIMARY KEY ("id")
);

-- AlterEnum
BEGIN;
CREATE TYPE "EstadoCompra_new" AS ENUM ('REQUISICION_CREADA', 'REQUISICION_REVISADA', 'COTIZACIONES_CARGADAS', 'PROVEEDOR_SELECCIONADO', 'NEGOCIACION_COMPLETADA', 'EN_REVISION_ADMIN', 'EN_AUTORIZACION_DIRECCION', 'AUTORIZADA', 'ORDEN_GENERADA', 'FACTURAS_RECIBIDAS', 'PAGO_GENERADO', 'FINALIZADO', 'RECHAZADO');
ALTER TABLE "public"."compras_requisiciones" ALTER COLUMN "estado" DROP DEFAULT;
ALTER TABLE "compras_requisiciones" ALTER COLUMN "estado" TYPE "EstadoCompra_new" USING ("estado"::text::"EstadoCompra_new");
ALTER TABLE "compras_historial" ALTER COLUMN "estado" TYPE "EstadoCompra_new" USING ("estado"::text::"EstadoCompra_new");
ALTER TYPE "EstadoCompra" RENAME TO "EstadoCompra_old";
ALTER TYPE "EstadoCompra_new" RENAME TO "EstadoCompra";
DROP TYPE "public"."EstadoCompra_old";
ALTER TABLE "compras_requisiciones" ALTER COLUMN "estado" SET DEFAULT 'REQUISICION_CREADA';
COMMIT;

-- AlterEnum
BEGIN;
CREATE TYPE "EstadoNomina_new" AS ENUM ('BORRADOR', 'PRE_NOMINA', 'SOLICITUD_SUBSIDIO', 'EN_REVISION', 'AUTORIZADO', 'PAGADO');
ALTER TABLE "public"."nominas" ALTER COLUMN "estado" DROP DEFAULT;
ALTER TABLE "nominas" ALTER COLUMN "estado" TYPE "EstadoNomina_new" USING ("estado"::text::"EstadoNomina_new");
ALTER TYPE "EstadoNomina" RENAME TO "EstadoNomina_old";
ALTER TYPE "EstadoNomina_new" RENAME TO "EstadoNomina";
DROP TYPE "public"."EstadoNomina_old";
ALTER TABLE "nominas" ALTER COLUMN "estado" SET DEFAULT 'BORRADOR';
COMMIT;

-- AlterTable
ALTER TABLE "compras_cotizaciones" ADD COLUMN     "formaPago" TEXT,
ADD COLUMN     "tipoCredito" TEXT;

-- AlterTable
ALTER TABLE "compras_ordenes" ADD COLUMN     "fechaOrden" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "folio" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "compras_requisiciones" ADD COLUMN     "formaPago" TEXT,
ADD COLUMN     "proveedorSeleccionado" TEXT,
ADD COLUMN     "tipo" "TipoCompra" NOT NULL,
ADD COLUMN     "tipoCredito" TEXT,
ADD COLUMN     "totalFinal" DOUBLE PRECISION,
ALTER COLUMN "estado" SET DEFAULT 'REQUISICION_CREADA';

-- AlterTable
ALTER TABLE "empleados" ADD COLUMN     "compensacionFija" DOUBLE PRECISION DEFAULT 0,
ADD COLUMN     "regimen" "RegimenLaboral" NOT NULL DEFAULT 'CONFIANZA';

-- AlterTable
ALTER TABLE "nominas" ADD COLUMN     "fechaRecepcionRecurso" TIMESTAMP(3),
ADD COLUMN     "fechaSolicitudSubsidio" TIMESTAMP(3),
ADD COLUMN     "firmaAdministracion" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "firmaDireccion" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "firmaFinanzas" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "firmaRecursosHumanos" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "totalDeducciones" DOUBLE PRECISION DEFAULT 0,
ADD COLUMN     "totalNetoPagar" DOUBLE PRECISION DEFAULT 0,
ADD COLUMN     "totalPercepciones" DOUBLE PRECISION DEFAULT 0;

-- AlterTable
ALTER TABLE "pacientes" DROP COLUMN "claveUnica",
ADD COLUMN     "claveUnica" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "prenominas" DROP COLUMN "bonos",
DROP COLUMN "deducciones",
DROP COLUMN "salarioBase",
ADD COLUMN     "compensacion" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "descuentoIncidencias" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "otrasDeducciones" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "otrasPercepciones" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "reciboFirmado" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "retencionISR" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "sueldoBruto" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "totalDeducciones" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "totalPercepciones" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "urlReciboFirmado" TEXT;

-- CreateTable
CREATE TABLE "compras_facturas" (
    "id" SERIAL NOT NULL,
    "requisicionId" INTEGER NOT NULL,
    "numero" TEXT NOT NULL,
    "monto" DOUBLE PRECISION NOT NULL,
    "documentoUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "compras_facturas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "compras_pagos" (
    "id" SERIAL NOT NULL,
    "requisicionId" INTEGER NOT NULL,
    "total" DOUBLE PRECISION NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "compras_pagos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "compras_detalles" (
    "id" SERIAL NOT NULL,
    "requisicionId" INTEGER NOT NULL,
    "numero" INTEGER NOT NULL,
    "producto" TEXT NOT NULL,
    "unidad" TEXT NOT NULL,
    "cantidad" INTEGER NOT NULL,

    CONSTRAINT "compras_detalles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "incidencias_nomina" (
    "id" SERIAL NOT NULL,
    "empleadoId" INTEGER NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL,
    "tipo" "TipoIncidencia" NOT NULL,
    "minutosRetardo" INTEGER,
    "justificada" BOOLEAN NOT NULL DEFAULT false,
    "vistoBuenoJefe" BOOLEAN NOT NULL DEFAULT false,
    "documentoJustifUrl" TEXT,
    "descuentoAplicar" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "aplicadoEnNominaId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "incidencias_nomina_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "compras_pagos_requisicionId_key" ON "compras_pagos"("requisicionId");

-- CreateIndex
CREATE UNIQUE INDEX "compras_ordenes_folio_key" ON "compras_ordenes"("folio");

-- CreateIndex
CREATE UNIQUE INDEX "pacientes_claveUnica_key" ON "pacientes"("claveUnica");

-- AddForeignKey
ALTER TABLE "compras_facturas" ADD CONSTRAINT "compras_facturas_requisicionId_fkey" FOREIGN KEY ("requisicionId") REFERENCES "compras_requisiciones"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compras_pagos" ADD CONSTRAINT "compras_pagos_requisicionId_fkey" FOREIGN KEY ("requisicionId") REFERENCES "compras_requisiciones"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compras_detalles" ADD CONSTRAINT "compras_detalles_requisicionId_fkey" FOREIGN KEY ("requisicionId") REFERENCES "compras_requisiciones"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compras_historial" ADD CONSTRAINT "compras_historial_requisicionId_fkey" FOREIGN KEY ("requisicionId") REFERENCES "compras_requisiciones"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compras_historial" ADD CONSTRAINT "compras_historial_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incidencias_nomina" ADD CONSTRAINT "incidencias_nomina_empleadoId_fkey" FOREIGN KEY ("empleadoId") REFERENCES "empleados"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
