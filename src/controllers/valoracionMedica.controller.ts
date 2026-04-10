import { Request, Response } from 'express';
import { prisma } from '../utils/prisma';
import { AppError } from '../middlewares/errorHandler';

/**
 * Crea o actualiza la valoración médica de un prospecto.
 * Si el médico marca al paciente como APTO, su estado cambia a PENDIENTE_INGRESO automaticamente.
 */
export const crearValoracionMedica = async (req: Request, res: Response) => {
  const { pacienteId, ...data } = req.body;

  if (!pacienteId) {
    throw new AppError(400, 'El ID del paciente es obligatorio');
  }

  const result = await prisma.$transaction(async (tx) => {
    // 1. Verificamos que el paciente existe
    const id = typeof pacienteId === 'string' ? parseInt(pacienteId, 10) : pacienteId;

    const paciente = await tx.paciente.findUnique({
      where: { id: id }
    });

    if (!paciente) {
      throw new AppError(404, 'Paciente no encontrado');
    }

    // 2. Creamos o actualizamos la valoración médica (upsert para robustez)
    const valoracion = await tx.valoracionMedica.upsert({
      where: { pacienteId: id },
      create: {
        pacienteId: id,
        padecimientoActual: data.padecimientoActual,
        antecedentes: data.antecedentes,
        signosVitales: data.signosVitales,
        exploracionFisica: data.exploracionFisica,
        examenMental: data.examenMental,
        diagnosticoCIE10: data.diagnosticoCIE10,
        pronostico: data.pronostico,
        tratamientoSugerido: data.tratamientoSugerido,
        esAptoParaIngreso: data.esAptoParaIngreso === true || data.esAptoParaIngreso === 'true'
      },
      update: {
        padecimientoActual: data.padecimientoActual,
        antecedentes: data.antecedentes,
        signosVitales: data.signosVitales,
        exploracionFisica: data.exploracionFisica,
        examenMental: data.examenMental,
        diagnosticoCIE10: data.diagnosticoCIE10,
        pronostico: data.pronostico,
        tratamientoSugerido: data.tratamientoSugerido,
        esAptoParaIngreso: data.esAptoParaIngreso === true || data.esAptoParaIngreso === 'true'
      }
    });

    // 3. Si el médico marcó APTO, actualizamos el estado del Paciente a PENDIENTE_INGRESO
    if (valoracion.esAptoParaIngreso) {
      await tx.paciente.update({
        where: { id: id },
        data: { estado: 'PENDIENTE_INGRESO' }
      });
    }

    return valoracion;
  });

  res.status(201).json({ success: true, data: result });
};

/**
 * Obtiene la valoración médica vinculada a un paciente.
 */
export const getValoracionMedicaByPaciente = async (req: Request, res: Response) => {
  const { pacienteId } = req.params;

  const id = parseInt(pacienteId as string, 10);

  const valoracion = await prisma.valoracionMedica.findUnique({
    where: { pacienteId: id }
  });

  res.json({ success: true, data: valoracion });
};
