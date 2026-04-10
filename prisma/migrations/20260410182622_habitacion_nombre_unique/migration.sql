/*
  Warnings:

  - A unique constraint covering the columns `[nombre]` on the table `habitaciones` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "habitaciones_nombre_key" ON "habitaciones"("nombre");
