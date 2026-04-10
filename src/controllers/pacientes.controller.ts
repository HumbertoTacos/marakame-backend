import { Request, Response } from 'express';
import { prisma } from '../utils/prisma';
import { AppError } from '../middlewares/errorHandler';
import { EstadoPaciente } from '@prisma/client';

/**
 * Obtener lista de pacientes filtrada por estado
 * GET /api/v1/pacientes?estado=PROSPECTO
 */
export const getPacientes = async (req: Request, res: Response) => {
  const { estado } = req.query;

  const where: any = {
    deletedAt: null
  };

  // Validar y aplicar filtro de estado si existe
  if (estado) {
    if (!Object.values(EstadoPaciente).includes(estado as any)) {
      throw new AppError(400, 'Estado de paciente no válido');
    }
    where.estado = estado;
  }

  const pacientes = await prisma.paciente.findMany({
    where,
    include: {
      primerContacto: {
        orderBy: { createdAt: 'desc' },
        take: 1
      },
      cama: {
        include: {
          habitacion: true
        }
      },
      expediente: true
    },
    orderBy: { createdAt: 'desc' }
  });

  res.json({
    success: true,
    data: pacientes
  });
};

/**
 * Obtener un paciente por ID con todo su contexto clínico
 */
export const getPacienteById = async (req: Request, res: Response) => {
  const { id } = req.params;

  const paciente = await prisma.paciente.findUnique({
    where: { id: parseInt(id as string, 10) },
    include: {
      primerContacto: true,
      valoracionMedica: true,
      expediente: {
        include: {
          notasEvolucion: {
            orderBy: { fecha: 'desc' },
            include: { usuario: true }
          },
          signosVitales: {
            orderBy: { fecha: 'desc' },
            include: { usuario: true }
          }
        }
      },
      familiar: true,
      cama: {
        include: { habitacion: true }
      }
    }
  });

  if (!paciente) {
    throw new AppError(404, 'Paciente no encontrado');
  }

  res.json({
    success: true,
    data: paciente
  });
};
