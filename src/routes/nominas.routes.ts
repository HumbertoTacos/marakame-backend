import { Router } from 'express';
import { authenticate, authorize } from '../middlewares/auth';
import { 
  createEmpleado, getEmpleados,
  generarNomina, getNominas, getNominaById, autorizarNomina, archivarNomina, // <--- Agregamos archivarNomina
  actualizarPreNomina // <--- Solo dejamos la nueva
} from '../controllers/nominas.controller';

const router = Router();

// Todo el módulo de nóminas requiere autenticación
router.use(authenticate);
router.use(authorize('ADMIN_GENERAL', 'RRHH_FINANZAS'));

// Empleados
router.post('/empleados', createEmpleado);
router.get('/empleados', getEmpleados);

// Ciclos de Nómina
router.post('/ciclo', generarNomina);
router.get('/ciclo', getNominas);
router.get('/ciclo/:id', getNominaById); // <--- NUEVA: Para ver los detalles de una sola nómina
router.put('/ciclo/:id/autorizar', autorizarNomina);

// Pre-Nóminas específicas (Edición individual)
router.put('/prenominas/:id', actualizarPreNomina); 

router.put('/ciclo/:id/archivar', archivarNomina); // (Ojo con tu middleware de auth)

export default router;