import { Router } from 'express';
import { authenticate, authorize } from '../middlewares/auth';
import * as controller from '../controllers/clinica.controller';

const router = Router();

router.use(authenticate);

// ── Tratamientos ────────────────────────────────────────────
router.get('/expediente/:expedienteId/tratamientos', controller.getTratamientos);
router.post('/expediente/:expedienteId/tratamientos', authorize('ADMIN_GENERAL', 'AREA_MEDICA'), controller.crearTratamiento);
router.patch('/tratamientos/:id/desactivar', authorize('ADMIN_GENERAL', 'AREA_MEDICA'), controller.desactivarTratamiento);

// ── Suministros ─────────────────────────────────────────────
router.get('/tratamientos/:id/suministros', controller.getSuministros);
router.post('/tratamientos/:id/suministros', authorize('ADMIN_GENERAL', 'AREA_MEDICA', 'ENFERMERIA'), controller.registrarSuministro);

// ── Agenda / Citas ──────────────────────────────────────────
router.get('/paciente/:pacienteId/citas', controller.getCitas);
router.post('/citas', controller.crearCita);
router.patch('/citas/:id', controller.actualizarCita);

// ── Sesiones Clínicas (Psicología, Consejería, Familia, Seguimiento) ──
router.get('/expediente/:expedienteId/sesiones/:tipo', controller.getNotasSesion);
router.post('/expediente/:expedienteId/sesiones/:tipo', controller.crearNotaSesion);

// ── Plan Nutricional ─────────────────────────────────────────
router.get('/expediente/:expedienteId/nutricion', controller.getPlanNutricional);
router.put('/expediente/:expedienteId/nutricion', authorize('ADMIN_GENERAL', 'NUTRICION', 'AREA_MEDICA'), controller.upsertPlanNutricional);

export default router;
