-- CreateEnum
CREATE TYPE "EstadoValidacionIngreso" AS ENUM ('PENDIENTE_VALIDACION', 'VALIDADO', 'OBSERVADO', 'DEPOSITADO', 'FACTURADO');

-- CreateEnum
CREATE TYPE "EstadoFacturaMensual" AS ENUM ('BORRADOR', 'EMITIDA', 'CANCELADA');

-- AlterTable
ALTER TABLE "pagos_paciente"
  ADD COLUMN "folioRecibo"      TEXT,
  ADD COLUMN "estadoValidacion" "EstadoValidacionIngreso" NOT NULL DEFAULT 'VALIDADO',
  ADD COLUMN "observaciones"    TEXT,
  ADD COLUMN "validadoPorId"    INTEGER,
  ADD COLUMN "fechaValidacion"  TIMESTAMP(3),
  ADD COLUMN "numeroDeposito"   TEXT,
  ADD COLUMN "fichaDepositoUrl" TEXT,
  ADD COLUMN "fechaDeposito"    TIMESTAMP(3),
  ADD COLUMN "facturaMensualId" INTEGER;

-- CreateIndex (unique folio recibo when present)
CREATE UNIQUE INDEX "pagos_paciente_folioRecibo_key" ON "pagos_paciente"("folioRecibo");

-- CreateTable
CREATE TABLE "facturas_mensuales" (
  "id"                 SERIAL                NOT NULL,
  "folio"              TEXT                  NOT NULL,
  "fecha"              TIMESTAMP(3)          NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "mes"                INTEGER               NOT NULL,
  "anio"               INTEGER               NOT NULL,
  "importeTotal"       DOUBLE PRECISION      NOT NULL,
  "cantidadEnLetra"    TEXT                  NOT NULL,
  "recibosCount"       INTEGER               NOT NULL DEFAULT 0,
  "folioReciboInicial" TEXT,
  "folioReciboFinal"   TEXT,
  "estado"             "EstadoFacturaMensual" NOT NULL DEFAULT 'BORRADOR',
  "archivoUrl"         TEXT,
  "observaciones"      TEXT,
  "creadoPorId"        INTEGER               NOT NULL,
  "fechaEmision"       TIMESTAMP(3),
  "createdAt"          TIMESTAMP(3)          NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "facturas_mensuales_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "facturas_mensuales_folio_key" ON "facturas_mensuales"("folio");
CREATE UNIQUE INDEX "facturas_mensuales_mes_anio_key" ON "facturas_mensuales"("mes", "anio");

-- AddForeignKey
ALTER TABLE "pagos_paciente"
  ADD CONSTRAINT "pagos_paciente_validadoPorId_fkey"
  FOREIGN KEY ("validadoPorId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pagos_paciente"
  ADD CONSTRAINT "pagos_paciente_facturaMensualId_fkey"
  FOREIGN KEY ("facturaMensualId") REFERENCES "facturas_mensuales"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "facturas_mensuales"
  ADD CONSTRAINT "facturas_mensuales_creadoPorId_fkey"
  FOREIGN KEY ("creadoPorId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
