/*
  Warnings:

  - You are about to drop the `compras_ordenes` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "compras_ordenes" DROP CONSTRAINT "compras_ordenes_requisicionId_fkey";

-- DropTable
DROP TABLE "compras_ordenes";

-- CreateTable
CREATE TABLE "CompraOrden" (
    "id" SERIAL NOT NULL,
    "requisicionId" INTEGER NOT NULL,
    "folio" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "proveedor" TEXT NOT NULL,
    "total" DOUBLE PRECISION NOT NULL,
    "elaboradoPorId" INTEGER,
    "revisadoPorId" INTEGER,
    "autorizadoPorId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CompraOrden_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CompraOrden_requisicionId_key" ON "CompraOrden"("requisicionId");

-- AddForeignKey
ALTER TABLE "CompraOrden" ADD CONSTRAINT "CompraOrden_requisicionId_fkey" FOREIGN KEY ("requisicionId") REFERENCES "compras_requisiciones"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompraOrden" ADD CONSTRAINT "CompraOrden_elaboradoPorId_fkey" FOREIGN KEY ("elaboradoPorId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompraOrden" ADD CONSTRAINT "CompraOrden_revisadoPorId_fkey" FOREIGN KEY ("revisadoPorId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompraOrden" ADD CONSTRAINT "CompraOrden_autorizadoPorId_fkey" FOREIGN KEY ("autorizadoPorId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;
