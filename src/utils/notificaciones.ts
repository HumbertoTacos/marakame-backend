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
    return await prisma.notificacion.create({
      data: {
        titulo: params.titulo,
        mensaje: params.mensaje,
        tipo: params.tipo || 'INFO',
        link: params.link,
        usuarioId: params.usuarioId,
        rol: params.rol,
      }
    });
  } catch (error) {
    console.error('Error al crear notificación:', error);
  }
};
