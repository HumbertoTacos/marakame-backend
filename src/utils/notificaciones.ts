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

/**
 * Marca como leídas TODAS las notificaciones no leídas que apuntan a un `link` específico,
 * tanto las del usuario actual como las dirigidas a cualquier usuario del mismo rol.
 *
 * Lo usamos al cierre de cada paso de un flujo (p. ej. nómina): cuando alguien con un rol
 * realiza la acción solicitada, ningún otro miembro del mismo rol necesita ya esa alerta.
 */
export const apagarNotificacionesPorLink = async (
  usuarioId: number,
  rol: Rol | null | undefined,
  link: string
) => {
  try {
    // 1) Notificaciones dirigidas directamente al usuario actual.
    await prisma.notificacion.updateMany({
      where: { leida: false, link, usuarioId },
      data: { leida: true }
    });

    // 2) Notificaciones dirigidas a cualquier otro usuario del mismo rol: si una persona del
    //    rol ya hizo la acción, el resto del rol ya no tiene nada pendiente para esa nómina.
    if (rol) {
      const usuariosDelRol = await prisma.usuario.findMany({
        where: { rol, activo: true },
        select: { id: true }
      });
      const ids = usuariosDelRol.map(u => u.id);
      if (ids.length > 0) {
        await prisma.notificacion.updateMany({
          where: { leida: false, link, usuarioId: { in: ids } },
          data: { leida: true }
        });
      }
    }
  } catch (error) {
    console.error('Error apagando notificaciones por link:', error);
  }
};
