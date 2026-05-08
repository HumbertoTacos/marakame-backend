import { Request, Response } from 'express';
import { prisma } from '../utils/prisma';
import { TipoActividadMedica } from '@prisma/client';
import { AppError } from '../middlewares/errorHandler';

export const getActividades = async (_req: Request, res: Response) => {
  const actividades = await prisma.actividadMedica.findMany({
    orderBy: [{ fecha: 'asc' }, { hora: 'asc' }],
  });
  res.json({ success: true, data: actividades });
};

export const createActividad = async (req: Request, res: Response) => {
  const { titulo, descripcion, fecha, hora, tipo, responsable, icono } = req.body;

  if (!titulo || !fecha || !hora || !tipo || !responsable) {
    throw new AppError(400, 'Campos requeridos: titulo, fecha, hora, tipo, responsable');
  }

  const tiposValidos = Object.values(TipoActividadMedica);
  if (!tiposValidos.includes(tipo as TipoActividadMedica)) {
    throw new AppError(400, `Tipo inválido. Valores permitidos: ${tiposValidos.join(', ')}`);
  }

  const actividad = await prisma.actividadMedica.create({
    data: {
      titulo: titulo.trim(),
      descripcion: descripcion?.trim() ?? null,
      fecha: new Date(fecha),
      hora: hora.trim(),
      tipo: tipo as TipoActividadMedica,
      responsable: responsable.trim(),
      icono: icono ?? 'activity',
    },
  });

  res.status(201).json({ success: true, data: actividad });
};

export const deleteActividad = async (req: Request, res: Response) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) throw new AppError(400, 'ID de actividad inválido');

  const existe = await prisma.actividadMedica.findUnique({ where: { id } });
  if (!existe) throw new AppError(404, 'Actividad no encontrada');

  await prisma.actividadMedica.delete({ where: { id } });
  res.json({ success: true, message: 'Actividad eliminada correctamente' });
};
