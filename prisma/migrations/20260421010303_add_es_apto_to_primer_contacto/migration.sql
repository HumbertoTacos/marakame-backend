/*
  Warnings:

  - The values [LLAMARA_PROSPECTO,LLAMARA_MARAKAME] on the enum `TipoAcuerdoSeguimiento` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `acuerdo` on the `primer_contacto` table. All the data in the column will be lost.
  - You are about to drop the column `dia` on the `primer_contacto` table. All the data in the column will be lost.
  - You are about to drop the column `estadoPrevioTratamiento` on the `primer_contacto` table. All the data in the column will be lost.
  - You are about to drop the column `fechaSeguimiento` on the `primer_contacto` table. All the data in the column will be lost.
  - You are about to drop the column `fuenteReferencia` on the `primer_contacto` table. All the data in the column will be lost.
  - You are about to drop the column `observaciones` on the `primer_contacto` table. All the data in the column will be lost.
  - You are about to drop the column `relacionPaciente` on the `primer_contacto` table. All the data in the column will be lost.
  - You are about to drop the column `requiereIntervencion` on the `primer_contacto` table. All the data in the column will be lost.
  - You are about to drop the column `solicitanteCelular` on the `primer_contacto` table. All the data in the column will be lost.
  - You are about to drop the column `solicitanteDireccion` on the `primer_contacto` table. All the data in the column will be lost.
  - You are about to drop the column `solicitanteNombre` on the `primer_contacto` table. All the data in the column will be lost.
  - You are about to drop the column `solicitanteOcupacion` on the `primer_contacto` table. All the data in the column will be lost.
  - You are about to drop the column `solicitanteTelefono` on the `primer_contacto` table. All the data in the column will be lost.
  - You are about to drop the column `antecedentes` on the `valoraciones_medicas` table. All the data in the column will be lost.
  - You are about to drop the column `diagnosticoCIE10` on the `valoraciones_medicas` table. All the data in the column will be lost.
  - You are about to drop the column `exploracionFisica` on the `valoraciones_medicas` table. All the data in the column will be lost.
  - You are about to drop the column `signosVitales` on the `valoraciones_medicas` table. All the data in the column will be lost.
  - You are about to drop the column `tratamientoSugerido` on the `valoraciones_medicas` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "EstadoValoracion" AS ENUM ('BORRADOR', 'COMPLETADA', 'FIRMADA');

-- AlterEnum
BEGIN;
CREATE TYPE "TipoAcuerdoSeguimiento_new" AS ENUM ('LLAMARLE', 'ESPERAR_LLAMADA', 'ESPERAR_VISITA', 'POSIBLE_INGRESO', 'RECHAZADO', 'OTRO', 'CITA_PROGRAMADA');
ALTER TABLE "primer_contacto" ALTER COLUMN "acuerdoSeguimiento" TYPE "TipoAcuerdoSeguimiento_new" USING ("acuerdoSeguimiento"::text::"TipoAcuerdoSeguimiento_new");
ALTER TYPE "TipoAcuerdoSeguimiento" RENAME TO "TipoAcuerdoSeguimiento_old";
ALTER TYPE "TipoAcuerdoSeguimiento_new" RENAME TO "TipoAcuerdoSeguimiento";
DROP TYPE "TipoAcuerdoSeguimiento_old";
COMMIT;

-- AlterTable
ALTER TABLE "primer_contacto" DROP COLUMN "acuerdo",
DROP COLUMN "dia",
DROP COLUMN "estadoPrevioTratamiento",
DROP COLUMN "fechaSeguimiento",
DROP COLUMN "fuenteReferencia",
DROP COLUMN "observaciones",
DROP COLUMN "relacionPaciente",
DROP COLUMN "requiereIntervencion",
DROP COLUMN "solicitanteCelular",
DROP COLUMN "solicitanteDireccion",
DROP COLUMN "solicitanteNombre",
DROP COLUMN "solicitanteOcupacion",
DROP COLUMN "solicitanteTelefono",
ADD COLUMN     "activo" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "acuerdoEsperarLlamada" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "acuerdoEsperarVisita" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "acuerdoLlamarle" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "acuerdoOtro" TEXT,
ADD COLUMN     "acuerdoPosibleIngreso" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "celularLlamada" TEXT,
ADD COLUMN     "conclusionIntervencion" TEXT,
ADD COLUMN     "conclusionMedica" TEXT,
ADD COLUMN     "direccionPaciente" TEXT,
ADD COLUMN     "domicilioLlamada" TEXT,
ADD COLUMN     "edadInicioConsumo" INTEGER,
ADD COLUMN     "edadPaciente" INTEGER,
ADD COLUMN     "esApto" BOOLEAN DEFAULT true,
ADD COLUMN     "escolaridadPaciente" TEXT,
ADD COLUMN     "estadoCivilPaciente" TEXT,
ADD COLUMN     "fechaAcuerdo" TIMESTAMP(3),
ADD COLUMN     "hijosPaciente" INTEGER,
ADD COLUMN     "hora" TEXT,
ADD COLUMN     "lugarLlamada" TEXT,
ADD COLUMN     "lugarTratamiento" TEXT,
ADD COLUMN     "medicoValoro" TEXT,
ADD COLUMN     "medioEnterado" TEXT,
ADD COLUMN     "nombreLlamada" TEXT,
ADD COLUMN     "nombrePaciente" TEXT,
ADD COLUMN     "ocupacionLlamada" TEXT,
ADD COLUMN     "ocupacionPaciente" TEXT,
ADD COLUMN     "origenPaciente" TEXT,
ADD COLUMN     "parentescoLlamada" TEXT,
ADD COLUMN     "parentescoOtro" TEXT,
ADD COLUMN     "realizoIntervencion" TEXT,
ADD COLUMN     "sintomasReportados" TEXT,
ADD COLUMN     "sustancias" TEXT[],
ADD COLUMN     "sustanciasOtros" TEXT[],
ADD COLUMN     "telCasaLlamada" TEXT,
ADD COLUMN     "telefonoPaciente" TEXT,
ADD COLUMN     "tratamientoPrevio" TEXT,
ALTER COLUMN "dispuestoInternarse" DROP NOT NULL,
ALTER COLUMN "acuerdoSeguimiento" SET DEFAULT 'ESPERAR_LLAMADA';

-- AlterTable
ALTER TABLE "valoraciones_medicas" DROP COLUMN "antecedentes",
DROP COLUMN "diagnosticoCIE10",
DROP COLUMN "exploracionFisica",
DROP COLUMN "signosVitales",
DROP COLUMN "tratamientoSugerido",
ADD COLUMN     "antecedentesHeredofamiliares" TEXT,
ADD COLUMN     "antecedentesNoPatologicos" TEXT,
ADD COLUMN     "antecedentesPatologicos" TEXT,
ADD COLUMN     "estado" "EstadoValoracion" NOT NULL DEFAULT 'BORRADOR',
ADD COLUMN     "exploracionFisicaDesc" TEXT,
ADD COLUMN     "fechaValoracion" TIMESTAMP(3),
ADD COLUMN     "frecuenciaCardiaca" TEXT,
ADD COLUMN     "frecuenciaRespiratoria" TEXT,
ADD COLUMN     "historialConsumo" TEXT,
ADD COLUMN     "horaValoracion" TEXT,
ADD COLUMN     "impresionDiagnostica" TEXT,
ADD COLUMN     "motivoConsulta" TEXT,
ADD COLUMN     "peso" TEXT,
ADD COLUMN     "planTratamiento" TEXT,
ADD COLUMN     "residente" TEXT,
ADD COLUMN     "sintomasGenerales" TEXT,
ADD COLUMN     "talla" TEXT,
ADD COLUMN     "temperatura" TEXT,
ADD COLUMN     "tensionArterial" TEXT,
ADD COLUMN     "tipoValoracion" TEXT,
ADD COLUMN     "tratamientosPrevios" TEXT,
ALTER COLUMN "examenMental" SET DATA TYPE TEXT;

-- CreateTable
CREATE TABLE "sustancias" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "sustancias_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "sustancias_nombre_key" ON "sustancias"("nombre");
