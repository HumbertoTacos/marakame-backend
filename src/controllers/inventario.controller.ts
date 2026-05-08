import { Request, Response } from 'express';
import { prisma } from '../utils/prisma';
import { AppError } from '../middlewares/errorHandler';

/**
 * Crea o actualiza el inventario de pertenencias de un paciente.
 * Al confirmar (validado = true) pasa el estado del paciente a INTERNADO.
 * POST/PUT /api/v1/inventario/paciente/:pacienteId
 */
export const upsertInventario = async (req: Request, res: Response) => {
  const pacienteId = parseInt(req.params.pacienteId as string, 10);
  const { articulos, validado, firmaRecibido } = req.body;

  const paciente = await prisma.paciente.findUnique({ where: { id: pacienteId } });
  if (!paciente) throw new AppError(404, 'Paciente no encontrado');

  const inventario = await prisma.inventarioPertenencias.upsert({
    where: { pacienteId },
    create: {
      pacienteId,
      articulos: articulos ?? [],
      validado: validado ?? false,
      firmaRecibido: firmaRecibido ?? false,
    },
    update: {
      articulos: articulos ?? [],
      validado: validado ?? false,
      firmaRecibido: firmaRecibido ?? false,
    },
  });

  if (validado === true) {
    await prisma.paciente.update({
      where: { id: pacienteId },
      data: {
        estado: 'INTERNADO',
        fechaIngreso: paciente.fechaIngreso ?? new Date(),
      },
    });
  }

  res.json({ success: true, data: inventario });
};

/**
 * Obtiene el inventario de pertenencias de un paciente.
 * GET /api/v1/inventario/paciente/:pacienteId
 */
export const getInventarioByPaciente = async (req: Request, res: Response) => {
  const pacienteId = parseInt(req.params.pacienteId as string, 10);

  const inventario = await prisma.inventarioPertenencias.findUnique({
    where: { pacienteId },
    include: {
      paciente: {
        select: {
          id: true, claveUnica: true, nombre: true,
          apellidoPaterno: true, apellidoMaterno: true,
          fechaIngreso: true,
          cama: { select: { numero: true, codigo: true, habitacion: { select: { nombre: true } } } },
        },
      },
    },
  });

  res.json({ success: true, data: inventario ?? null });
};
