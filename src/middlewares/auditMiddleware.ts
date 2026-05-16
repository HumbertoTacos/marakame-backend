import { Request, Response, NextFunction } from 'express';
import { prisma } from '../utils/prisma';

/**
 * Middleware de Auditoría Automática
 * Registra en la bitácora todo CREATE, UPDATE y DELETE
 * de cualquier módulo, sin modificar cada controlador individualmente.
 */

// Mapa de rutas a nombres de módulo legibles
const MODULO_MAP: Record<string, string> = {
  'admisiones':       'Admisiones',
  'pacientes':        'Pacientes',
  'expedientes':      'Expediente Clínico',
  'clinica':          'Clínica',
  'egreso':           'Egreso',
  'almacen':          'Almacén',
  'compras':          'Compras',
  'nominas':          'Nóminas',
  'documentos':       'Documentos',
  'usuarios':         'Usuarios',
  'reportes':         'Reportes',
  'notificaciones':   'Notificaciones',
};

// Mapa de método HTTP → acción legible
const ACCION_MAP: Record<string, string> = {
  POST:   'CREAR',
  PUT:    'ACTUALIZAR',
  PATCH:  'ACTUALIZAR',
  DELETE: 'ELIMINAR',
};

function getModulo(url: string): string {
  const segmento = url.split('/')[3]; // /api/v1/<modulo>/...
  return MODULO_MAP[segmento] || segmento || 'Sistema';
}

function getAccion(method: string, url: string): string {
  // Casos especiales por URL
  if (url.includes('/login'))        return 'INICIO_SESION';
  if (url.includes('/logout'))       return 'CIERRE_SESION';
  if (url.includes('/leida'))        return 'MARCAR_NOTIFICACION';
  if (url.includes('/autorizar'))    return 'AUTORIZAR';
  if (url.includes('/desactivar'))   return 'DESACTIVAR';
  if (url.includes('/reset-password')) return 'RESET_CONTRASENA';
  if (url.includes('/estado'))       return 'CAMBIO_ESTADO';
  if (url.includes('/asignar'))      return 'ASIGNAR';
  if (url.includes('/movimientos'))  return method === 'POST' ? 'MOVIMIENTO_INVENTARIO' : ACCION_MAP[method];
  if (url.includes('/egreso'))       return 'EGRESO_PACIENTE';
  if (url.includes('/signos'))       return 'REGISTRAR_SIGNOS_VITALES';
  if (url.includes('/notas'))        return 'AGREGAR_NOTA';
  if (url.includes('/upload'))       return 'SUBIR_DOCUMENTO';

  return ACCION_MAP[method] || method;
}

export function auditMiddleware(req: Request, res: Response, next: NextFunction) {
  // Solo auditar métodos de escritura
  const metodosAuditar = ['POST', 'PUT', 'PATCH', 'DELETE'];
  if (!metodosAuditar.includes(req.method)) return next();

  // IGNORAR NOTIFICACIONES: No auditar ruidos de la campana
  if (req.originalUrl.includes('notificaciones')) return next();

  // Capturar el IP real
  const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim()
    || req.socket.remoteAddress
    || 'desconocida';

  // Interceptar el fin de la respuesta para registrar solo si fue exitoso
  const originalJson = res.json.bind(res);

  res.json = function (body: any) {
    // Registrar auditoría solo en respuestas exitosas (2xx)
    if (res.statusCode >= 200 && res.statusCode < 300) {
      const usuarioId = req.usuario?.id;
      if (usuarioId) {
        const modulo = getModulo(req.originalUrl);
        const accion = getAccion(req.method, req.originalUrl);

        // Construir detalle limpio (evitar datos sensibles)
        const detalle: Record<string, any> = {
          url:    req.originalUrl,
          metodo: req.method,
        };

        // Incluir params relevantes (IDs)
        if (Object.keys(req.params).length > 0) {
          detalle.params = req.params;
        }

        // Incluir body resumido (sin passwords ni datos sensibles)
        const sourceBody = res.locals.auditBodyOverride || req.body;
        if (sourceBody && Object.keys(sourceBody).length > 0) {
          const bodySafe = { ...sourceBody };
          delete bodySafe.password;
          delete bodySafe.passwordHash;
          delete bodySafe.token;
          // Solo primeros campos para no saturar la bitácora
          const keys = Object.keys(bodySafe).slice(0, 8);
          const bodyResumido: Record<string, any> = {};
          keys.forEach(k => bodyResumido[k] = bodySafe[k]);
          detalle.body = bodyResumido;
        }

        // Registrar de forma asíncrona sin bloquear la respuesta
        prisma.auditoria.create({
          data: { usuarioId, accion, modulo, detalle, ip }
        }).catch(() => { /* Silencioso: no interrumpir flujo */ });
      }
    }

    return originalJson(body);
  };

  next();
}
