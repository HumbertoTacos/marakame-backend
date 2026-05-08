-- CreateEnum
CREATE TYPE "EstadoRecepcion" AS ENUM ('PENDIENTE', 'ACEPTADO', 'RECHAZADO');

-- CreateEnum
CREATE TYPE "EstadoSalida" AS ENUM ('PENDIENTE', 'AUTORIZADA', 'ENTREGADA', 'CANCELADA');

-- CreateEnum
CREATE TYPE "EstadoContraRecibo" AS ENUM ('PENDIENTE', 'PAGADO', 'CANCELADO');

-- AlterEnum
ALTER TYPE "CategoriaProducto" ADD VALUE 'ALIMENTO';

-- AlterTable
ALTER TABLE "almacen_movimientos" ADD COLUMN     "autorizadoPorId" INTEGER,
ADD COLUMN     "cantidadCorrecta" BOOLEAN,
ADD COLUMN     "contraReciboUrl" TEXT,
ADD COLUMN     "empaqueCorrecto" BOOLEAN,
ADD COLUMN     "estadoRecepcion" "EstadoRecepcion" NOT NULL DEFAULT 'PENDIENTE',
ADD COLUMN     "estadoSalida" "EstadoSalida",
ADD COLUMN     "facturaUrl" TEXT,
ADD COLUMN     "fechaCaducidad" TIMESTAMP(3),
ADD COLUMN     "fechaEntrega" TIMESTAMP(3),
ADD COLUMN     "fechaNotificacion" TIMESTAMP(3),
ADD COLUMN     "importeFactura" DOUBLE PRECISION,
ADD COLUMN     "motivoRechazo" TEXT,
ADD COLUMN     "notificadoRecursos" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "presentacionCorrecta" BOOLEAN,
ADD COLUMN     "requisicionId" INTEGER;

-- AlterTable
ALTER TABLE "almacen_productos" ADD COLUMN     "ubicacion" TEXT;

-- CreateTable
CREATE TABLE "almacen_lotes" (
    "id" SERIAL NOT NULL,
    "productoId" INTEGER NOT NULL,
    "numeroLote" TEXT NOT NULL,
    "fechaCaducidad" TIMESTAMP(3) NOT NULL,
    "cantidad" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "almacen_lotes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contra_recibos" (
    "id" SERIAL NOT NULL,
    "folio" TEXT NOT NULL,
    "movimientoId" INTEGER NOT NULL,
    "proveedor" TEXT NOT NULL,
    "numeroFactura" TEXT NOT NULL,
    "importe" DOUBLE PRECISION NOT NULL,
    "fechaRecepcion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fechaPagoProgramado" TIMESTAMP(3),
    "recibidoPorId" INTEGER NOT NULL,
    "estado" "EstadoContraRecibo" NOT NULL DEFAULT 'PENDIENTE',
    "contraReciboPdfUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contra_recibos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "contra_recibos_folio_key" ON "contra_recibos"("folio");

-- CreateIndex
CREATE UNIQUE INDEX "contra_recibos_movimientoId_key" ON "contra_recibos"("movimientoId");

-- AddForeignKey
ALTER TABLE "almacen_lotes" ADD CONSTRAINT "almacen_lotes_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "almacen_productos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contra_recibos" ADD CONSTRAINT "contra_recibos_movimientoId_fkey" FOREIGN KEY ("movimientoId") REFERENCES "almacen_movimientos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contra_recibos" ADD CONSTRAINT "contra_recibos_recibidoPorId_fkey" FOREIGN KEY ("recibidoPorId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
