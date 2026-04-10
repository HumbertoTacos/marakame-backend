/*
  Warnings:

  - You are about to drop the column `conclusionMedica` on the `primer_contacto` table. All the data in the column will be lost.
  - You are about to drop the column `medicoNombre` on the `primer_contacto` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "primer_contacto" DROP COLUMN "conclusionMedica",
DROP COLUMN "medicoNombre";
