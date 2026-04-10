import { Router } from 'express';
import { authenticate } from '../middlewares/auth';
import * as pacientesController from '../controllers/pacientes.controller';

const router = Router();

// Todas las rutas de pacientes requieren autenticación
router.use(authenticate);

/**
 * @route GET /api/v1/pacientes
 * @desc Obtener lista de pacientes (filtros vía query params: estado)
 */
router.get('/', pacientesController.getPacientes);

/**
 * @route GET /api/v1/pacientes/aprobados-para-ingreso
 * @desc Obtener pacientes listos para internamiento formal
 */
router.get('/aprobados-para-ingreso', pacientesController.getAprobadosParaIngreso);

/**
 * @route GET /api/v1/pacientes/:id
 * @desc Obtener detalle completo de un paciente
 */
router.get('/:id', pacientesController.getPacienteById);

export default router;
