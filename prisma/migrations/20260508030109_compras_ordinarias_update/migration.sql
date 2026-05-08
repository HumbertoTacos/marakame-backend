-- AlterEnum
ALTER TYPE "EstadoCompra" ADD VALUE 'ORDEN_PAGO_GENERADA';

-- AlterTable
ALTER TABLE "compras_requisiciones" ADD COLUMN     "esCompraMayor" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "compras_ordenes_pago" (
    "id" SERIAL NOT NULL,
    "requisicionId" INTEGER NOT NULL,
    "folio" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "observaciones" TEXT,
    "elaboradoPorId" INTEGER,
    "revisadoPorId" INTEGER,
    "autorizadoPorId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "compras_ordenes_pago_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "compras_ordenes_pago_requisicionId_key" ON "compras_ordenes_pago"("requisicionId");

-- AddForeignKey
ALTER TABLE "compras_ordenes_pago" ADD CONSTRAINT "compras_ordenes_pago_elaboradoPorId_fkey" FOREIGN KEY ("elaboradoPorId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compras_ordenes_pago" ADD CONSTRAINT "compras_ordenes_pago_revisadoPorId_fkey" FOREIGN KEY ("revisadoPorId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compras_ordenes_pago" ADD CONSTRAINT "compras_ordenes_pago_autorizadoPorId_fkey" FOREIGN KEY ("autorizadoPorId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compras_ordenes_pago" ADD CONSTRAINT "compras_ordenes_pago_requisicionId_fkey" FOREIGN KEY ("requisicionId") REFERENCES "compras_requisiciones"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
