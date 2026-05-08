import { Router } from 'express';
import { authenticate, authorize } from '../middlewares/auth';

import {
    createContraRecibo,
    getContraRecibos,
    getContraReciboById,
    updateEstadoContraRecibo,
    generateContraReciboPDF
} from '../controllers/contraRecibo.controller';

const router = Router();

// ============================================================
// AUTH
// ============================================================

router.use(authenticate);

// ============================================================
// CONTRA RECIBOS
// ============================================================

// Crear contra-recibo
router.post(
    '/',
    authorize('ALMACEN', 'ADMIN_GENERAL'),
    createContraRecibo
);

// Obtener todos
router.get(
    '/',
    authorize('ALMACEN', 'ADMIN_GENERAL', 'RRHH_FINANZAS'),
    getContraRecibos
);

// Obtener uno
router.get(
    '/:id',
    authorize('ALMACEN', 'ADMIN_GENERAL', 'RRHH_FINANZAS'),
    getContraReciboById
);

// Cambiar estado
router.put(
    '/:id/estado',
    authorize('ADMIN_GENERAL', 'RRHH_FINANZAS'),
    updateEstadoContraRecibo
);

// Generar / visualizar PDF
router.get(
    '/:id/pdf',
    authorize('ALMACEN', 'ADMIN_GENERAL', 'RRHH_FINANZAS'),
    generateContraReciboPDF
);

export default router;