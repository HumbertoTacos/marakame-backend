import { Router } from 'express';

import {
  authenticate,
  authorize
} from '../middlewares/auth';

import {

  // ==========================================================
  // PRODUCTOS
  // ==========================================================

  createProducto,
  getProductos,
  getProductoById,
  updateProducto,

  // ==========================================================
  // MOVIMIENTOS
  // ==========================================================

  registerMovimiento,
  getMovimientos,

  // ==========================================================
  // RECEPCIÓN
  // ==========================================================

  aceptarRecepcion,
  rechazarRecepcion,

  // ==========================================================
  // SALIDAS
  // ==========================================================

  autorizarSalida,
  entregarSalida

} from '../controllers/almacen.controller';

const router = Router();

// ============================================================
// AUTH
// ============================================================

router.use(authenticate);

// ============================================================
// PRODUCTOS
// ============================================================

router.post(
  '/productos',
  authorize('ALMACEN', 'ADMIN_GENERAL'),
  createProducto
);

router.get(
  '/productos',
  getProductos
);

router.get(
  '/productos/:id',
  getProductoById
);

router.put(
  '/productos/:id',
  authorize('ALMACEN', 'ADMIN_GENERAL'),
  updateProducto
);

// ============================================================
// MOVIMIENTOS
// ============================================================

// Registrar movimiento

router.post(
  '/movimientos',
  authorize(
    'ALMACEN',
    'ADMIN_GENERAL',
    'AREA_MEDICA',
    'ENFERMERIA' as any
  ),
  registerMovimiento
);

// Obtener movimientos

router.get(
  '/movimientos',
  authorize(
    'ALMACEN',
    'ADMIN_GENERAL',
    'RRHH_FINANZAS'
  ),
  getMovimientos
);

// ============================================================
// RECEPCIÓN DE MERCANCÍA
// ============================================================

// Aceptar recepción

router.put(
  '/movimientos/:id/aceptar',
  authorize(
    'ALMACEN',
    'ADMIN_GENERAL'
  ),
  aceptarRecepcion
);

// Rechazar recepción

router.put(
  '/movimientos/:id/rechazar',
  authorize(
    'ALMACEN',
    'ADMIN_GENERAL'
  ),
  rechazarRecepcion
);

// ============================================================
// SALIDAS
// ============================================================

// Autorizar salida

router.put(
  '/movimientos/:id/autorizar',
  authorize(
    'ALMACEN',
    'ADMIN_GENERAL'
  ),
  autorizarSalida
);

// Confirmar entrega

router.put(
  '/movimientos/:id/entregar',
  authorize(
    'ALMACEN',
    'ADMIN_GENERAL'
  ),
  entregarSalida
);

export default router;