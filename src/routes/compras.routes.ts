import { Router } from 'express';

import {
  authenticate,
  authorize
} from '../middlewares/auth';

import {
  createRequisicion,
  getRequisiciones,
  updateRequisicionEstado,
  addCotizacion,
  generarOrden,
  generarOrdenPago,
  upload,
  subirFactura
} from '../controllers/compras.controller';

const router = Router();

router.use(authenticate);

// ============================================================
// ROLES
// ============================================================

const ROLES_SOLICITANTES = [
  'ADMIN_GENERAL',
  'ALMACEN',
  'AREA_MEDICA',
  'ENFERMERIA',
  'NUTRICION',
  'PSICOLOGIA',
  'ADMISIONES'
] as const;

const ROLES_COMPRAS = [
  'ALMACEN',
  'ADMIN_GENERAL'
] as const;

const ROLES_ADMINISTRACION = [
  'ADMIN_GENERAL',
  'RRHH_FINANZAS'
] as const;

const ROLES_DIRECCION = [
  'ADMIN_GENERAL'
] as const;

// ============================================================
// REQUISICIONES
// ============================================================

// Crear requisición
router.post(
  '/requisiciones',

  authorize(...ROLES_SOLICITANTES),

  createRequisicion
);

// Obtener todas
router.get(
  '/requisiciones',

  authenticate,

  getRequisiciones
);

// Cambiar estado
router.patch(
  '/requisiciones/:id/estado',

  authorize(
    'ADMIN_GENERAL',
    'RRHH_FINANZAS',
    'ALMACEN'
  ),

  updateRequisicionEstado
);

// ============================================================
// COTIZACIONES
// ============================================================

// Agregar cotización
router.post(
  '/requisiciones/:requisicionId/cotizaciones',

  authorize(...ROLES_COMPRAS),

  addCotizacion
);

// ============================================================
// ÓRDENES DE COMPRA
// ============================================================

// Generar orden de compra
router.post(
  '/requisiciones/:requisicionId/orden',

  authorize(...ROLES_DIRECCION),

  generarOrden
);

// ============================================================
// ÓRDENES DE PAGO
// ============================================================

// Generar orden de pago
router.post(
  '/requisiciones/:requisicionId/orden-pago',

  authorize(
    'RRHH_FINANZAS',
    'ADMIN_GENERAL'
  ),

  generarOrdenPago
);

// ============================================================
// FACTURAS
// ============================================================

// Subir factura
router.post(
  '/requisiciones/:requisicionId/factura',

  authorize(
    'RRHH_FINANZAS',
    'ADMIN_GENERAL'
  ),

  upload.single('factura'),

  subirFactura
);

export default router;