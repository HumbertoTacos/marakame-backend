-- AlterTable
ALTER TABLE "compras_ordenes_pago" ADD COLUMN     "asunto" TEXT,
ADD COLUMN     "dirigidoA" TEXT,
ADD COLUMN     "totalGeneral" DOUBLE PRECISION;

-- CreateTable
CREATE TABLE "compras_ordenes_pago_detalles" (
    "id" SERIAL NOT NULL,
    "ordenPagoId" INTEGER NOT NULL,
    "fechaOrdenCompra" TIMESTAMP(3),
    "folioOrdenCompra" TEXT,
    "numeroFactura" TEXT,
    "proveedor" TEXT,
    "monto" DOUBLE PRECISION NOT NULL DEFAULT 0,

    CONSTRAINT "compras_ordenes_pago_detalles_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "compras_ordenes_pago_detalles" ADD CONSTRAINT "compras_ordenes_pago_detalles_ordenPagoId_fkey" FOREIGN KEY ("ordenPagoId") REFERENCES "compras_ordenes_pago"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
