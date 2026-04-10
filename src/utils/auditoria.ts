import { prisma } from './prisma';

export async function registrarAuditoria(
  usuarioId: number,
  accion: string,
  modulo: string,
  detalle?: object,
  ip?: string
) {
  try {
    await prisma.auditoria.create({
      data: { usuarioId, accion, modulo, detalle, ip },
    });
  } catch {
    // No interrumpir el flujo por error de auditoría
  }
}
