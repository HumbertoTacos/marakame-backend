import { Request, Response } from 'express';
import { prisma } from '../utils/prisma';
import { AppError } from '../middlewares/errorHandler';
import fs from 'fs';
import path from 'path';

/**
 * Obtiene datos del Paciente y su Primer Contacto para pre-llenar la valoración médica.
 * GET /api/v1/admisiones/valoracion-medica/:pacienteId/pre-fill
 */
export const preFillValoracionMedica = async (req: Request, res: Response) => {
  const { pacienteId } = req.params;
  const id = parseInt(pacienteId as string, 10);

  const paciente = await prisma.paciente.findUnique({
    where: { id },
    include: {
      primerContacto: {
        orderBy: { createdAt: 'desc' },
        take: 1
      }
    }
  });

  if (!paciente) {
    throw new AppError(404, 'Paciente no encontrado');
  }

  const pc = paciente.primerContacto?.[0];

  // Estructura de respuesta para la UI (Ficha de Identificación + CRM Data)
  const preFillData = {
    // Ficha de Identificación
    identificacion: {
      nombreCompleto: `${paciente.nombre} ${paciente.apellidoPaterno} ${paciente.apellidoMaterno}`,
      edad: pc?.edadPaciente || 0,
      estadoCivil: pc?.estadoCivilPaciente || paciente.estadoCivil || 'No especificado',
      ocupacion: pc?.ocupacionPaciente || paciente.ocupacion || 'No especificado',
      direccion: pc?.direccionPaciente || paciente.direccion || 'No especificada',
      escolaridad: pc?.escolaridadPaciente || paciente.escolaridad || 'No especificada',
    },
    // Datos heredados del CRM (Panel de información)
    crm: {
      sustancias: pc?.sustancias || [],
      edadInicioConsumo: pc?.edadInicioConsumo || null,
      ultimoConsumo: paciente.ultimoConsumo || null,
      sintomasReportados: pc?.sintomasReportados || 'Ninguno reportado'
    }
  };

  res.json({ success: true, data: preFillData });
};

/**
 * Crea o actualiza el registro de valoración médica (Estado: COMPLETADA).
 * POST /api/v1/admisiones/valoracion-medica
 */
export const crearValoracionMedica = async (req: Request, res: Response) => {
  const medicalData = req.body; // En este paso el médico guarda el texto, no necesariamente sube el archivo aún
  const { pacienteId } = medicalData;

  if (!pacienteId) {
    throw new AppError(400, 'El ID del paciente es obligatorio');
  }

  const result = await prisma.$transaction(async (tx) => {
    const id = typeof pacienteId === 'string' ? parseInt(pacienteId, 10) : pacienteId;

    const examenMentalTexto =
      typeof req.body.examenMental === 'object'
        ? JSON.stringify(req.body.examenMental)
        : req.body.examenMental || '';

    const valoracion = await tx.valoracionMedica.upsert({
      where: { pacienteId: id },
      create: {
        pacienteId: id,
        estado: 'COMPLETADA',
        motivoConsulta: medicalData.motivoConsulta,
        padecimientoActual: medicalData.padecimientoActual,
        sintomasGenerales: medicalData.sintomasGenerales,
        tratamientosPrevios: medicalData.tratamientosPrevios,
        antecedentesHeredofamiliares: medicalData.antecedentesHeredofamiliares,
        antecedentesPatologicos: medicalData.antecedentesPatologicos,
        antecedentesNoPatologicos: medicalData.antecedentesNoPatologicos,
        historialConsumo: medicalData.historialConsumo,
        tensionArterial: medicalData.tensionArterial,
        frecuenciaCardiaca: medicalData.frecuenciaCardiaca,
        frecuenciaRespiratoria: medicalData.frecuenciaRespiratoria,
        temperatura: medicalData.temperatura,
        peso: medicalData.peso,
        talla: medicalData.talla,
        exploracionFisicaDesc: medicalData.exploracionFisicaDesc,
        examenMental: examenMentalTexto,
        impresionDiagnostica: medicalData.impresionDiagnostica,
        pronostico: medicalData.pronostico,
        planTratamiento: medicalData.planTratamiento,
        esAptoParaIngreso: medicalData.esAptoParaIngreso === true || medicalData.esAptoParaIngreso === 'true',
        // Nuevos campos institucionales
        residente: medicalData.residente,
        tipoValoracion: medicalData.tipoValoracion,
        fechaValoracion: medicalData.fechaValoracion ? new Date(medicalData.fechaValoracion) : null,
        horaValoracion: medicalData.horaValoracion
      },
      update: {
        estado: 'COMPLETADA',
        motivoConsulta: medicalData.motivoConsulta,
        padecimientoActual: medicalData.padecimientoActual,
        sintomasGenerales: medicalData.sintomasGenerales,
        tratamientosPrevios: medicalData.tratamientosPrevios,
        antecedentesHeredofamiliares: medicalData.antecedentesHeredofamiliares,
        antecedentesPatologicos: medicalData.antecedentesPatologicos,
        antecedentesNoPatologicos: medicalData.antecedentesNoPatologicos,
        historialConsumo: medicalData.historialConsumo,
        tensionArterial: medicalData.tensionArterial,
        frecuenciaCardiaca: medicalData.frecuenciaCardiaca,
        frecuenciaRespiratoria: medicalData.frecuenciaRespiratoria,
        temperatura: medicalData.temperatura,
        peso: medicalData.peso,
        talla: medicalData.talla,
        exploracionFisicaDesc: medicalData.exploracionFisicaDesc,
        examenMental: examenMentalTexto,
        impresionDiagnostica: medicalData.impresionDiagnostica,
        pronostico: medicalData.pronostico,
        planTratamiento: medicalData.planTratamiento,
        esAptoParaIngreso: medicalData.esAptoParaIngreso === true || medicalData.esAptoParaIngreso === 'true',
        // Nuevos campos institucionales
        residente: medicalData.residente,
        tipoValoracion: medicalData.tipoValoracion,
        fechaValoracion: medicalData.fechaValoracion ? new Date(medicalData.fechaValoracion) : null,
        horaValoracion: medicalData.horaValoracion
      }
    });

    // Si es APTO, actualizamos estado del paciente
    if (valoracion.esAptoParaIngreso === true) {
      await tx.paciente.update({
        where: { id: id },
        data: { estado: 'PENDIENTE_INGRESO' } // o como quieras llamarlo
      });
    } else {
      await tx.paciente.update({
        where: { id: id },
        data: { estado: 'CANALIZADO' }
      });
    }

    return valoracion;
  });

  res.status(201).json({ success: true, data: result });
};

/**
 * Sube el archivo digitalizado firmado y marca como FIRMADA.
 * POST /api/v1/admisiones/valoracion-medica/:id/upload-firma
 */
export const uploadFirmaValoracionMedica = async (req: Request, res: Response) => {
  const { id } = req.params;
  const valoracionId = parseInt(id as string, 10);

  if (!req.file) {
    throw new AppError(400, 'El archivo de la valoración firmada es obligatorio');
  }

  // 1. Obtener datos de la valoración para el renombramiento institucional
  const valoracionActual = await prisma.valoracionMedica.findUnique({
    where: { id: valoracionId },
    include: { paciente: true }
  });

  if (!valoracionActual) {
    throw new AppError(404, 'Valoración no encontrada');
  }

  // 2. Renombrar archivo
  const idPaciente = valoracionActual.pacienteId;
  const dateStr = new Date().toLocaleDateString('es-MX', { 
    day: '2-digit', month: '2-digit', year: 'numeric' 
  }).replace(/\//g, '');
  
  const originalExt = path.extname(req.file.filename);
  const newFileName = `VALORACION_FIRMADA_P${idPaciente}_${dateStr}${originalExt}`;
  const oldPath = req.file.path;
  const newPath = path.join(path.dirname(oldPath), newFileName);

  fs.renameSync(oldPath, newPath);
  const documentoUrl = `/uploads/valoraciones/${newFileName}`;

  // 3. Actualizar registro
  const updated = await prisma.valoracionMedica.update({
    where: { id: valoracionId },
    data: {
      documentoFirmadoUrl: documentoUrl,
      estado: 'FIRMADA'
    }
  });

  res.json({ success: true, data: updated });
};

export const getValoracionMedicaByPaciente = async (req: Request, res: Response) => {
  const { pacienteId } = req.params;
  const id = parseInt(pacienteId as string, 10);

  const valoracion = await prisma.valoracionMedica.findUnique({
    where: { pacienteId: id }
  });

  res.json({ success: true, data: valoracion });
};
