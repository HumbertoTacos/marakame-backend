import { Router } from 'express';
import { authenticate, authorize } from '../middlewares/auth';

import {
  // PRODUCTOS
  createProducto,
  getProductos,
  getProductoById,
  updateProducto,
  deleteProducto,

  // MOVIMIENTOS
  registerMovimiento,
  getMovimientos,

  // RECEPCIÓN
  aceptarRecepcion,
  rechazarRecepcion,

  // SALIDAS
  autorizarSalida,
  entregarSalida,

  // LOTES
  getLotes,
  createLote,

  // REQUISICIONES
  createRequisicion,
  getRequisiciones,
  getRequisicionById,
  revisarRequisicion,

  // DASHBOARD
  dashboardAlmacen,
} from '../controllers/almacen.controller';

const router = Router();

router.use(authenticate);

// ============================================================
// DASHBOARD
// ============================================================

router.get('/dashboard', authorize('ALMACEN', 'ADMIN_GENERAL', 'RRHH_FINANZAS'), dashboardAlmacen);

// ============================================================
// PRODUCTOS
// ============================================================

router.get('/productos', getProductos);

router.get('/productos/:id', getProductoById);

router.post('/productos', authorize('ALMACEN', 'ADMIN_GENERAL'), createProducto);

router.put('/productos/:id', authorize('ALMACEN', 'ADMIN_GENERAL'), updateProducto);

router.delete('/productos/:id', authorize('ALMACEN', 'ADMIN_GENERAL'), deleteProducto);

// ============================================================
// MOVIMIENTOS
// ============================================================

router.get(
  '/movimientos',
  authorize('ALMACEN', 'ADMIN_GENERAL', 'RRHH_FINANZAS'),
  getMovimientos,
);

router.post(
  '/movimientos',
  authorize('ALMACEN', 'ADMIN_GENERAL', 'AREA_MEDICA', 'JEFE_MEDICO', 'ENFERMERIA'),
  registerMovimiento,
);

// ── Recepción ───────────────────────────────────────────────

router.put(
  '/movimientos/:id/aceptar',
  authorize('ALMACEN', 'ADMIN_GENERAL'),
  aceptarRecepcion,
);

router.put(
  '/movimientos/:id/rechazar',
  authorize('ALMACEN', 'ADMIN_GENERAL'),
  rechazarRecepcion,
);

// ── Salidas ─────────────────────────────────────────────────

router.put(
  '/movimientos/:id/autorizar',
  authorize('ALMACEN', 'ADMIN_GENERAL'),
  autorizarSalida,
);

router.put(
  '/movimientos/:id/entregar',
  authorize('ALMACEN', 'ADMIN_GENERAL'),
  entregarSalida,
);

// ============================================================
// LOTES
// ============================================================

router.get('/lotes', authorize('ALMACEN', 'ADMIN_GENERAL', 'RRHH_FINANZAS'), getLotes);

router.post('/lotes', authorize('ALMACEN', 'ADMIN_GENERAL'), createLote);

// ============================================================
// REQUISICIONES DE ALMACÉN
// ============================================================

router.get(
  '/requisiciones',
  authorize('ALMACEN', 'ADMIN_GENERAL', 'RRHH_FINANZAS', 'AREA_MEDICA', 'JEFE_MEDICO',
            'ENFERMERIA', 'NUTRICION', 'PSICOLOGIA', 'ADMISIONES'),
  getRequisiciones,
);

router.get(
  '/requisiciones/:id',
  authorize('ALMACEN', 'ADMIN_GENERAL', 'RRHH_FINANZAS'),
  getRequisicionById,
);

router.post(
  '/requisiciones',
  authorize('ALMACEN', 'ADMIN_GENERAL', 'AREA_MEDICA', 'JEFE_MEDICO',
            'ENFERMERIA', 'NUTRICION', 'PSICOLOGIA', 'ADMISIONES'),
  createRequisicion,
);

router.patch(
  '/requisiciones/:id/revisar',
  authorize('ALMACEN', 'ADMIN_GENERAL'),
  revisarRequisicion,
);

export default router;
