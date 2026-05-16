import { Router } from 'express';
import { z } from 'zod';

import {
  authenticate,
  authorize
} from '../middlewares/auth';

import { AppError } from '../middlewares/errorHandler';

import {

  // PRODUCTOS
  createProducto,
  getProductos,
  getProductoById,
  updateProducto,

  // MOVIMIENTOS
  registerMovimiento,
  getMovimientos,

  // RECEPCIÓN
  aceptarRecepcion,
  rechazarRecepcion,

  // SALIDAS
  autorizarSalida,
  entregarSalida

} from '../controllers/almacen.controller';

const router = Router();

// ── Schemas de validación ────────────────────────────────────

const createProductoSchema = z.object({
  codigo: z.string().min(1, 'El código es obligatorio').max(50),
  nombre: z.string().min(2, 'El nombre es obligatorio').max(200),
  descripcion: z.string().optional().nullable(),
  categoria: z.enum([
    'MEDICAMENTO',
    'INSUMO_MEDICO',
    'MOBILIARIO',
    'PAPELERIA',
    'LIMPIEZA',
    'OTRO'
  ]).default('OTRO'),
  unidad: z.string().default('PIEZAS'),
  stockMinimo: z.coerce.number().int().min(0).default(5),
});

const updateProductoSchema = z.object({
  nombre: z.string().min(2).max(200).optional(),
  descripcion: z.string().optional().nullable(),
  categoria: z.enum([
    'MEDICAMENTO',
    'INSUMO_MEDICO',
    'MOBILIARIO',
    'PAPELERIA',
    'LIMPIEZA',
    'OTRO'
  ]).optional(),
  unidad: z.string().optional(),
  stockMinimo: z.coerce.number().int().min(0).optional(),
});

const registerMovimientoSchema = z.object({
  productoId: z.coerce.number().int().positive(),
  tipo: z.enum(['ENTRADA', 'SALIDA']),
  cantidad: z.coerce.number().int().min(1),
  proveedor: z.string().optional().nullable(),
  numeroFactura: z.string().optional().nullable(),
  areaSolicitante: z.string().optional().nullable(),
  motivo: z.string().optional().nullable(),
  observaciones: z.string().optional().nullable(),
});

// ── Helpers ──────────────────────────────────────────────────

function parseBody<T>(schema: z.ZodSchema<T>, body: unknown): T {
  const result = schema.safeParse(body);

  if (!result.success) {
    const msg = result.error.errors
      .map(e => `${e.path.join('.')}: ${e.message}`)
      .join(' | ');

    throw new AppError(400, `Datos inválidos: ${msg}`);
  }

  return result.data;
}

function parseId(raw: string | string[]): number {
  const idStr = Array.isArray(raw) ? raw[0] : raw;
  const id = parseInt(idStr, 10);

  if (isNaN(id) || id <= 0) {
    throw new AppError(
      400,
      'El ID debe ser un número entero positivo'
    );
  }

  return id;
}

// ── AUTH ─────────────────────────────────────────────────────

router.use(authenticate);

// ── PRODUCTOS ────────────────────────────────────────────────

router.post(
  '/productos',
  authorize('ALMACEN', 'ADMIN_GENERAL'),
  async (req, res, next) => {
    req.body = parseBody(createProductoSchema, req.body);
    next();
  },
  createProducto
);

router.get('/productos', getProductos);

router.get(
  '/productos/:id',
  (req, _res, next) => {
    parseId(req.params.id);
    next();
  },
  getProductoById
);

router.put(
  '/productos/:id',
  authorize('ALMACEN', 'ADMIN_GENERAL'),
  async (req, res, next) => {
    parseId(req.params.id);
    req.body = parseBody(updateProductoSchema, req.body);
    next();
  },
  updateProducto
);

// ── MOVIMIENTOS ──────────────────────────────────────────────

router.post(
  '/movimientos',
  authorize(
    'ALMACEN',
    'ADMIN_GENERAL',
    'AREA_MEDICA',
    'JEFE_MEDICO',
    'ENFERMERIA'
  ),
  async (req, res, next) => {
    req.body = parseBody(registerMovimientoSchema, req.body);
    next();
  },
  registerMovimiento
);

router.get(
  '/movimientos',
  authorize(
    'ALMACEN',
    'ADMIN_GENERAL',
    'RRHH_FINANZAS'
  ),
  getMovimientos
);

// ── RECEPCIÓN ────────────────────────────────────────────────

router.put(
  '/movimientos/:id/aceptar',
  authorize(
    'ALMACEN',
    'ADMIN_GENERAL'
  ),
  aceptarRecepcion
);

router.put(
  '/movimientos/:id/rechazar',
  authorize(
    'ALMACEN',
    'ADMIN_GENERAL'
  ),
  rechazarRecepcion
);

// ── SALIDAS ──────────────────────────────────────────────────

router.put(
  '/movimientos/:id/autorizar',
  authorize(
    'ALMACEN',
    'ADMIN_GENERAL'
  ),
  autorizarSalida
);

router.put(
  '/movimientos/:id/entregar',
  authorize(
    'ALMACEN',
    'ADMIN_GENERAL'
  ),
  entregarSalida
);

export default router;