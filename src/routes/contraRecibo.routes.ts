import { Router } from 'express';
import { authenticate, authorize } from '../middlewares/auth';

import {
  createContraRecibo,
  getContraRecibos,
  getContraReciboById,
  programarPago,
  marcarPagado,
  cancelarContraRecibo,
  updateEstadoContraRecibo,
  generateContraReciboPDF,
  dashboardContraRecibos,
} from '../controllers/contraRecibo.controller';

const router = Router();

router.use(authenticate);

const ROLES_ALMACEN   = ['ALMACEN', 'ADMIN_GENERAL'] as const;
const ROLES_FINANZAS  = ['RRHH_FINANZAS', 'ADMIN_GENERAL'] as const;
const ROLES_CONSULTA  = ['ALMACEN', 'ADMIN_GENERAL', 'RRHH_FINANZAS'] as const;

// ============================================================
// DASHBOARD
// ============================================================

router.get('/dashboard', authorize(...ROLES_FINANZAS), dashboardContraRecibos);

// ============================================================
// CRUD
// ============================================================

router.get('/', authorize(...ROLES_CONSULTA), getContraRecibos);

router.get('/:id', authorize(...ROLES_CONSULTA), getContraReciboById);

router.post('/', authorize(...ROLES_ALMACEN), createContraRecibo);

// ============================================================
// GESTIÓN DE PAGO
// ============================================================

router.patch('/:id/programar-pago', authorize(...ROLES_FINANZAS), programarPago);

router.patch('/:id/marcar-pagado', authorize(...ROLES_FINANZAS), marcarPagado);

router.patch('/:id/cancelar', authorize(...ROLES_FINANZAS), cancelarContraRecibo);

// ── Genérico (backward compat) ───────────────────────────────

router.put('/:id/estado', authorize(...ROLES_FINANZAS), updateEstadoContraRecibo);

// ============================================================
// PDF
// ============================================================

router.get('/:id/pdf', authorize(...ROLES_CONSULTA), generateContraReciboPDF);

export default router;
