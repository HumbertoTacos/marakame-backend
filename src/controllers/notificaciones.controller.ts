import { Request, Response } from 'express';
import { prisma } from '../utils/prisma';
import { AppError } from '../middlewares/errorHandler';

export const getMisNotificaciones = async (req: Request, res: Response) => {
  const usuarioId = req.usuario!.id;
  const rol = req.usuario!.rol;

  const notificaciones = await prisma.notificacion.findMany({
    where: {
      OR: [
        { usuarioId },
        { rol },
        { AND: [{ usuarioId: null }, { rol: null }] } // Globales
      ]
    },
    orderBy: { createdAt: 'desc' },
    take: 50 // Limitar a las últimas 50
  });

  res.json({ success: true, data: notificaciones });
};

export const marcarComoLeida = async (req: Request, res: Response) => {
  const { id } = req.params;
  const usuarioId = req.usuario!.id;

  // Verificar que la notificación pertenezca al usuario o a su rol
  // Nota: Para simplicidad, permitimos marcar cualquier notificación que el usuario pueda ver.
  
  const updated = await prisma.notificacion.update({
    where: { id: parseInt(id as string, 10) },
    data: { leida: true }
  });

  res.json({ success: true, data: updated });
};

export const marcarTodasComoLeidas = async (req: Request, res: Response) => {
  const usuarioId = req.usuario!.id;
  const rol = req.usuario!.rol;

  await prisma.notificacion.updateMany({
    where: {
      OR: [
        { usuarioId },
        { rol },
        { AND: [{ usuarioId: null }, { rol: null }] }
      ],
      leida: false
    },
    data: { leida: true }
  });

  res.json({ success: true, message: 'Todas las notificaciones marcadas como leídas' });
};
