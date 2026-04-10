import { Request, Response } from 'express';
import { prisma } from '../utils/prisma';
import { AppError } from '../middlewares/errorHandler';
import fs from 'fs';
import path from 'path';

/**
 * Crea o actualiza la valoración médica de un prospecto.
 * Si el médico marca al paciente como APTO, su estado cambia a PENDIENTE_INGRESO automaticamente.
 */
export const crearValoracionMedica = async (req: Request, res: Response) => {
  // Multer pone los campos de texto en req.body y el archivo en req.file
  // El frontend enviará los datos clínicos en un campo llamado 'data' como JSON string
  const clinicalData = req.body.data ? JSON.parse(req.body.data) : req.body;
  const { pacienteId } = clinicalData;

  if (!pacienteId) {
    throw new AppError(400, 'El ID del paciente es obligatorio');
  }

  if (!req.file) {
    throw new AppError(400, 'El documento de valoración firmado es obligatorio');
  }

  const result = await prisma.$transaction(async (tx) => {
    const id = typeof pacienteId === 'string' ? parseInt(pacienteId, 10) : pacienteId;

    const paciente = await tx.paciente.findUnique({
      where: { id: id }
    });

    if (!paciente) {
      throw new AppError(404, 'Paciente no encontrado');
    }

    // 1. Renombrar el archivo a formato institucional: VALORACION_PACIENTE_[ID]_[DDMMYYYY].pdf
    const dateStr = new Date().toLocaleDateString('es-MX', { 
      day: '2-digit', month: '2-digit', year: 'numeric' 
    }).replace(/\//g, '');
    
    const originalExt = path.extname(req.file!.filename);
    const newFileName = `VALORACION_PACIENTE_${id}_${dateStr}${originalExt}`;
    const oldPath = req.file!.path;
    const newPath = path.join(path.dirname(oldPath), newFileName);

    fs.renameSync(oldPath, newPath);
    const documentoUrl = `/uploads/valoraciones/${newFileName}`;

    // 2. Creamos o actualizamos la valoración médica (upsert)
    const valoracion = await tx.valoracionMedica.upsert({
      where: { pacienteId: id },
      create: {
        pacienteId: id,
        padecimientoActual: clinicalData.padecimientoActual,
        antecedentes: clinicalData.antecedentes,
        signosVitales: clinicalData.signosVitales,
        exploracionFisica: clinicalData.exploracionFisica,
        examenMental: clinicalData.examenMental,
        diagnosticoCIE10: clinicalData.diagnosticoCIE10,
        pronostico: clinicalData.pronostico,
        tratamientoSugerido: clinicalData.tratamientoSugerido,
        esAptoParaIngreso: clinicalData.esAptoParaIngreso === true || clinicalData.esAptoParaIngreso === 'true',
        documentoFirmadoUrl: documentoUrl
      },
      update: {
        padecimientoActual: clinicalData.padecimientoActual,
        antecedentes: clinicalData.antecedentes,
        signosVitales: clinicalData.signosVitales,
        exploracionFisica: clinicalData.exploracionFisica,
        examenMental: clinicalData.examenMental,
        diagnosticoCIE10: clinicalData.diagnosticoCIE10,
        pronostico: clinicalData.pronostico,
        tratamientoSugerido: clinicalData.tratamientoSugerido,
        esAptoParaIngreso: clinicalData.esAptoParaIngreso === true || clinicalData.esAptoParaIngreso === 'true',
        documentoFirmadoUrl: documentoUrl
      }
    });

    // 3. Actualizar estado del Paciente
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
