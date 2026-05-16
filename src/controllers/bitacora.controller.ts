import { Request, Response } from 'express';
import { prisma } from '../utils/prisma';

export const getBitacoraLogs = async (req: Request, res: Response) => {
  const { modulo, usuarioId, fechaInicio, fechaFin, accion, busqueda } = req.query;

  const whereArgs: any = {};

  if (modulo) whereArgs.modulo = modulo as string;
  if (usuarioId) whereArgs.usuarioId = parseInt(usuarioId as string, 10);
  
  if (accion) {
    whereArgs.accion = {
      contains: accion as string
    };
  }

  if (busqueda) {
    whereArgs.usuario = {
      OR: [
        { nombre: { contains: busqueda as string } },
        { apellidos: { contains: busqueda as string } }
      ]
    };
  }

  if (fechaInicio || fechaFin) {
    whereArgs.createdAt = {};
    if (fechaInicio) whereArgs.createdAt.gte = new Date(fechaInicio as string);
    if (fechaFin) {
      const d = new Date(fechaFin as string);
      d.setHours(23, 59, 59, 999); // Asegurar que incluya todo el día final
      whereArgs.createdAt.lte = d;
    }
  }

  const isGlobalAdmin = req.usuario!.rol === 'ADMIN_GENERAL' || req.usuario!.rol === 'DIRECCION';

  if (!isGlobalAdmin) {
    if (!req.usuario!.esJefe) {
      return res.status(403).json({ success: false, message: 'Acceso denegado. Se requiere nivel de jefatura.' });
    }
    // Si es jefe pero no global, solo ve lo de su propio departamento/rol
    whereArgs.usuario = {
      rol: req.usuario!.rol
    };
  }

  const logs = await prisma.auditoria.findMany({
    where: whereArgs,
    include: {
      usuario: { select: { nombre: true, apellidos: true, rol: true } }
    },
    orderBy: { createdAt: 'desc' },
    take: 200 // Limitar los resultados para evitar sobrecargar la memoria
  });

  res.json({ success: true, data: logs });
};

// Utilidad interna para inyectar logs en controladores sin lidiar con req/res
export const registrarAccion = async (usuarioId: number, accion: string, modulo: string, detalle?: any, ip?: string) => {
  try {
    await prisma.auditoria.create({
      data: {
        usuarioId,
        accion,
        modulo,
        detalle: detalle || {},
        ip: ip || 'unknown'
      }
    });
  } catch (error) {
    console.error('Error al registrar bitácora transversal:', error);
  }
};
