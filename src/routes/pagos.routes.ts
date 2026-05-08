import { Router } from 'express';
import { authenticate, authorize } from '../middlewares/auth';
import { Rol } from '@prisma/client';
import {
  getResumenPagos,
  getEstadoCuenta,
  registrarPago,
  agregarCargo,
  marcarCargoPagado,
  getMetodosPago,
} from '../controllers/pagos.controller';

const router = Router();

router.use(authenticate);

// Consulta abierta a roles financieros + médico + admin
const VIEWER = [Rol.RRHH_FINANZAS, Rol.ADMIN_GENERAL, Rol.ADMISIONES];
const EDITOR = [Rol.RRHH_FINANZAS, Rol.ADMIN_GENERAL];

router.get('/metodos',                    authorize(...VIEWER), getMetodosPago);
router.get('/resumen',                    authorize(...VIEWER), getResumenPagos);
router.get('/paciente/:id/estado-cuenta', authorize(...VIEWER), getEstadoCuenta);
router.post('/paciente/:id',              authorize(...EDITOR), registrarPago);
router.post('/paciente/:id/cargos',       authorize(...EDITOR), agregarCargo);
router.patch('/cargos/:cargoId/marcar-pagado', authorize(...EDITOR), marcarCargoPagado);

export default router;
