import { Router } from 'express';
import { z } from 'zod';
import { authenticate, authorize } from '../middlewares/auth';
import { AppError } from '../middlewares/errorHandler';
import {
  createProducto, getProductos, getProductoById, updateProducto,
  registerMovimiento, getMovimientos,
} from '../controllers/almacen.controller';

const router = Router();

// ── Schemas de validación ────────────────────────────────────

const createProductoSchema = z.object({
  codigo: z.string().min(1, 'El código es obligatorio').max(50),
  nombre: z.string().min(2, 'El nombre es obligatorio').max(200),
  descripcion: z.string().optional().nullable(),
  categoria: z.enum(['MEDICAMENTO', 'INSUMO_MEDICO', 'MOBILIARIO', 'PAPELERIA', 'LIMPIEZA', 'OTRO']).default('OTRO'),
  unidad: z.string().default('PIEZAS'),
  stockMinimo: z.coerce.number().int().min(0).default(5),
});

const updateProductoSchema = z.object({
  nombre: z.string().min(2).max(200).optional(),
  descripcion: z.string().optional().nullable(),
  categoria: z.enum(['MEDICAMENTO', 'INSUMO_MEDICO', 'MOBILIARIO', 'PAPELERIA', 'LIMPIEZA', 'OTRO']).optional(),
  unidad: z.string().optional(),
  stockMinimo: z.coerce.number().int().min(0).optional(),
});

const registerMovimientoSchema = z.object({
  productoId: z.coerce.number().int().positive('El ID del producto es obligatorio'),
  tipo: z.enum(['ENTRADA', 'SALIDA'], { message: 'El tipo debe ser ENTRADA o SALIDA' }),
  cantidad: z.coerce.number().int().min(1, 'La cantidad mínima es 1'),
  proveedor: z.string().optional().nullable(),
  numeroFactura: z.string().optional().nullable(),
  areaSolicitante: z.string().optional().nullable(),
  motivo: z.string().optional().nullable(),
  observaciones: z.string().optional().nullable(),
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
  const idStr = Array.isArray(raw) ? raw[0] : raw;
  const id = parseInt(idStr, 10);
  if (isNaN(id) || id <= 0) throw new AppError(400, 'El ID debe ser un número entero positivo');
  return id;
}

// ── Rutas ────────────────────────────────────────────────────

router.use(authenticate);

router.post('/productos', authorize('ALMACEN', 'ADMIN_GENERAL'), async (req, res, next) => {
  parseBody(createProductoSchema, req.body);
  next();
}, createProducto);

router.get('/productos', getProductos);

router.get('/productos/:id', (req, _res, next) => {
  parseId(req.params.id);
  next();
}, getProductoById);

router.put('/productos/:id', authorize('ALMACEN', 'ADMIN_GENERAL'), async (req, res, next) => {
  parseId(req.params.id);
  req.body = parseBody(updateProductoSchema, req.body);
  next();
}, updateProducto);

router.post('/movimientos', authorize('ALMACEN', 'ADMIN_GENERAL', 'AREA_MEDICA', 'ENFERMERIA' as any), async (req, res, next) => {
  req.body = parseBody(registerMovimientoSchema, req.body);
  next();
}, registerMovimiento);

router.get('/movimientos', authorize('ALMACEN', 'ADMIN_GENERAL', 'RRHH_FINANZAS'), getMovimientos);

export default router;
