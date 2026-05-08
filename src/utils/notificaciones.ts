import { prisma } from './prisma';
import { Rol, TipoNotificacion } from '@prisma/client';

interface NotifParams {
  titulo: string;
  mensaje: string;
  tipo?: TipoNotificacion;
  link?: string;
  usuarioId?: number;
  rol?: Rol;
}

/**
 * Crea una notificación en la base de datos para un usuario o rol específico.
 */
export const crearNotificacion = async (params: NotifParams) => {
  try {
    if (params.rol) {
      // Fan-out a todos los usuarios con este rol
      const usuarios = await prisma.usuario.findMany({ where: { rol: params.rol, activo: true } });
      const notifs = usuarios.map(u => ({
        titulo: params.titulo,
        mensaje: params.mensaje,
        tipo: params.tipo || 'INFO',
        link: params.link,
        usuarioId: u.id,
      }));
      if (notifs.length > 0) {
        return await prisma.notificacion.createMany({ data: notifs });
      }
    } else if (!params.usuarioId && !params.rol) {
      // Global: Fan-out a todos los usuarios activos
      const usuarios = await prisma.usuario.findMany({ where: { activo: true } });
      const notifs = usuarios.map(u => ({
        titulo: params.titulo,
        mensaje: params.mensaje,
        tipo: params.tipo || 'INFO',
        link: params.link,
        usuarioId: u.id,
      }));
      if (notifs.length > 0) {
        return await prisma.notificacion.createMany({ data: notifs });
      }
    } else {
      // Notificación directa a un usuario
      return await prisma.notificacion.create({
        data: {
          titulo: params.titulo,
          mensaje: params.mensaje,
          tipo: params.tipo || 'INFO',
          link: params.link,
          usuarioId: params.usuarioId,
        }
      });
    }
  } catch (error) {
    console.error('Error al crear notificación:', error);
  }
};
