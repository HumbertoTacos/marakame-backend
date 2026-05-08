/*
  Warnings:

  - The values [REQUISICION_REVISADA,EN_REVISION_ADMIN,EN_AUTORIZACION_DIRECCION] on the enum `EstadoCompra` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "EstadoCompra_new" AS ENUM ('REQUISICION_CREADA', 'EN_REVISION_RECURSOS', 'EN_REVISION_COMPRAS', 'EN_REVISION_ADMINISTRACION', 'EN_REVISION_DIRECCION', 'COTIZACIONES_CARGADAS', 'PROVEEDOR_SELECCIONADO', 'NEGOCIACION_COMPLETADA', 'AUTORIZADA', 'ORDEN_GENERADA', 'FACTURAS_RECIBIDAS', 'ORDEN_PAGO_GENERADA', 'PAGO_GENERADO', 'FINALIZADO', 'RECHAZADO');
ALTER TABLE "public"."compras_requisiciones" ALTER COLUMN "estado" DROP DEFAULT;
ALTER TABLE "compras_requisiciones" ALTER COLUMN "estado" TYPE "EstadoCompra_new" USING ("estado"::text::"EstadoCompra_new");
ALTER TABLE "compras_historial" ALTER COLUMN "estado" TYPE "EstadoCompra_new" USING ("estado"::text::"EstadoCompra_new");
ALTER TYPE "EstadoCompra" RENAME TO "EstadoCompra_old";
ALTER TYPE "EstadoCompra_new" RENAME TO "EstadoCompra";
DROP TYPE "public"."EstadoCompra_old";
ALTER TABLE "compras_requisiciones" ALTER COLUMN "estado" SET DEFAULT 'REQUISICION_CREADA';
COMMIT;
