import { Request, Response } from 'express';
import { prisma } from '../utils/prisma';

export const getAuditoria = async (req: Request, res: Response) => {
  const { modulo, usuarioId, fechaInicio, fechaFin } = req.query;

  const whereArgs: any = {};

  if (modulo) whereArgs.modulo = modulo as string;
  if (usuarioId) whereArgs.usuarioId = parseInt(usuarioId as string, 10);
  
  if (fechaInicio || fechaFin) {
    whereArgs.createdAt = {};
    if (fechaInicio) whereArgs.createdAt.gte = new Date(fechaInicio as string);
    if (fechaFin) whereArgs.createdAt.lte = new Date(fechaFin as string);
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
    console.error('Error al registrar auditoría transversal:', error);
  }
};
