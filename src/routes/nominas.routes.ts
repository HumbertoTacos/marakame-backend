import { Router } from 'express';
import { authenticate, authorize } from '../middlewares/auth';
import { 
  createEmpleado, getEmpleados,
  generarNomina, getNominas, autorizarNomina,
  updatePreNomina
} from '../controllers/nominas.controller';

const router = Router();

// Todo el módulo de nóminas requiere autenticación
router.use(authenticate);
// Restricción por rol (solo recursos humanos y admin)
router.use(authorize('ADMIN_GENERAL', 'RRHH_FINANZAS'));

// Empleados
router.post('/empleados', createEmpleado);
router.get('/empleados', getEmpleados);

// Ciclos de Nómina
router.post('/ciclo', generarNomina);
router.get('/ciclo', getNominas);
router.put('/ciclo/:id/autorizar', autorizarNomina);

// Pre-Nóminas específicas
router.put('/prenomina/:id', updatePreNomina);

export default router;
