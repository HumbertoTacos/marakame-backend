import { Request, Response } from 'express';
import { prisma } from '../utils/prisma';
import { AppError } from '../middlewares/errorHandler';

const emisorSelect = {
  id: true,
  nombre: true,
  apellidos: true,
  rol: true,
} as const;

export const crearSolicitud = async (req: Request, res: Response) => {
  const { contenido, tipo } = req.body;
  const emisorId = req.usuario!.id;

  if (!contenido?.trim() || !tipo?.trim()) {
    throw new AppError(400, 'Los campos contenido y tipo son requeridos.');
  }

  const solicitud = await prisma.solicitudMedica.create({
    data: { emisorId, contenido: contenido.trim(), tipo: tipo.trim() },
    include: { emisor: { select: emisorSelect } },
  });

  res.status(201).json({ success: true, data: solicitud });
};

export const getSolicitudes = async (_req: Request, res: Response) => {
  const solicitudes = await prisma.solicitudMedica.findMany({
    include: { emisor: { select: emisorSelect } },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ success: true, data: solicitudes });
};

export const atenderSolicitud = async (req: Request, res: Response) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) throw new AppError(400, 'ID inválido.');

  const existe = await prisma.solicitudMedica.findUnique({ where: { id } });
  if (!existe) throw new AppError(404, 'Solicitud no encontrada.');

  const solicitud = await prisma.solicitudMedica.update({
    where: { id },
    data: { estado: 'ATENDIDA' },
    include: { emisor: { select: emisorSelect } },
  });
  res.json({ success: true, data: solicitud });
};
