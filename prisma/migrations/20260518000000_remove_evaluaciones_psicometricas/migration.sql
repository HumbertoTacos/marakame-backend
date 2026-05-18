-- Remove Evaluaciones Psicométricas — feature no solicitada por el cliente.
-- DropForeignKey
ALTER TABLE "evaluaciones_resultados" DROP CONSTRAINT IF EXISTS "evaluaciones_resultados_pacienteId_fkey";
ALTER TABLE "evaluaciones_resultados" DROP CONSTRAINT IF EXISTS "evaluaciones_resultados_usuarioId_fkey";

-- DropTable
DROP TABLE IF EXISTS "evaluaciones_resultados";
