import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../middlewares/auth';
import { AppError } from '../middlewares/errorHandler';
import {
  createRequisicion, getRequisiciones, updateRequisicionEstado,
  addCotizacion, generarOrden,
} from '../controllers/compras.controller';

const router = Router();

// ── Schemas de validación ────────────────────────────────────

const createRequisicionSchema = z.object({
  areaSolicitante: z.string().min(2, 'El área solicitante es obligatoria'),
  descripcion: z.string().min(5, 'La descripción es obligatoria'),
  justificacion: z.string().min(5, 'La justificación es obligatoria'),
  presupuestoEstimado: z.coerce.number().min(0).default(0),
});

const updateEstadoSchema = z.object({
  estado: z.enum([
    'BORRADOR', 'PENDIENTE_COTIZACION', 'EN_COMPARATIVO',
    'PENDIENTE_AUTORIZACION', 'AUTORIZADO', 'RECHAZADO', 'ORDEN_GENERADA',
  ], { message: 'Estado inválido' }),
  observacionesVoBo: z.string().optional().nullable(),
});

const addCotizacionSchema = z.object({
  proveedor: z.string().min(2, 'El nombre del proveedor es obligatorio'),
  precio: z.coerce.number().min(0, 'El precio debe ser mayor o igual a 0'),
  tiempoEntrega: z.string().optional().nullable(),
  esMejorOpcion: z.coerce.boolean().default(false),
});

const generarOrdenSchema = z.object({
  proveedor: z.string().min(2, 'El nombre del proveedor es obligatorio'),
  total: z.coerce.number().min(0, 'El total debe ser mayor o igual a 0'),
});

// ── Helper de validación inline ──────────────────────────────

function parseBody<T>(schema: z.ZodSchema<T>, body: unknown): T {
  const result = schema.safeParse(body);
  if (!result.success) {
    const msg = result.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(' | ');
    throw new AppError(400, `Datos inválidos: ${msg}`);
  }
  return result.data;
}

function parseId(raw: string | string[]): number {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (!value) throw new AppError(400, 'El ID debe ser un número entero positivo');
  const id = parseInt(value, 10);
  if (isNaN(id) || id <= 0) throw new AppError(400, 'El ID debe ser un número entero positivo');
  return id;
}

// ── Rutas ────────────────────────────────────────────────────

router.use(authenticate);

router.post('/requisicion', (req, _res, next) => {
  req.body = parseBody(createRequisicionSchema, req.body);
  next();
}, createRequisicion);

router.get('/requisicion', getRequisiciones);

router.put('/requisicion/:id/estado', (req, _res, next) => {
  parseId(req.params.id);
  req.body = parseBody(updateEstadoSchema, req.body);
  next();
}, updateRequisicionEstado);

router.post('/requisicion/:requisicionId/cotizacion', (req, _res, next) => {
  parseId(req.params.requisicionId);
  req.body = parseBody(addCotizacionSchema, req.body);
  next();
}, addCotizacion);

router.post('/requisicion/:requisicionId/orden', (req, _res, next) => {
  parseId(req.params.requisicionId);
  req.body = parseBody(generarOrdenSchema, req.body);
  next();
}, generarOrden);

export default router;
