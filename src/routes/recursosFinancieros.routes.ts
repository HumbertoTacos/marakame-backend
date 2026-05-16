import { Router } from 'express';
import { Rol } from '@prisma/client';
import { authenticate, authorize } from '../middlewares/auth';
import {
  listarIngresos,
  listarIngresosObservados,
  validarIngreso,
  observarIngreso,
  depositarIngreso,
  reenviarIngreso,
  listarFacturasMensuales,
  obtenerFacturaMensual,
  generarFacturaMensual,
  emitirFacturaMensual,
  getDashboard,
} from '../controllers/recursosFinancieros.controller';

const router = Router();

router.use(authenticate);

// Roles que operan el módulo
const FINANCIERO = [Rol.RECURSOS_FINANCIEROS, Rol.RRHH_FINANZAS, Rol.ADMIN_GENERAL];
const FINANCIERO_Y_ADMISIONES = [...FINANCIERO, Rol.ADMISIONES];

// ── Bandeja de ingresos ─────────────────────────────────────────
router.get('/dashboard', authorize(...FINANCIERO), getDashboard);
router.get('/ingresos', authorize(...FINANCIERO), listarIngresos);
router.get('/ingresos/observados', authorize(...FINANCIERO_Y_ADMISIONES), listarIngresosObservados);

router.post('/ingresos/:pagoId/validar',   authorize(...FINANCIERO), validarIngreso);
router.post('/ingresos/:pagoId/observar',  authorize(...FINANCIERO), observarIngreso);
router.post('/ingresos/:pagoId/depositar', authorize(...FINANCIERO), depositarIngreso);
router.post('/ingresos/:pagoId/reenviar',  authorize(...FINANCIERO_Y_ADMISIONES), reenviarIngreso);

// ── Facturas mensuales ──────────────────────────────────────────
router.get('/facturas-mensuales', authorize(...FINANCIERO), listarFacturasMensuales);
router.get('/facturas-mensuales/:id', authorize(...FINANCIERO), obtenerFacturaMensual);
router.post('/facturas-mensuales', authorize(...FINANCIERO), generarFacturaMensual);
router.post('/facturas-mensuales/:id/emitir', authorize(...FINANCIERO), emitirFacturaMensual);

export default router;
