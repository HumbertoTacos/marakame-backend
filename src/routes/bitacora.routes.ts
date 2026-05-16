import { Router } from 'express';
import { authenticate, authorize } from '../middlewares/auth';
import { getBitacoraLogs } from '../controllers/bitacora.controller';

const router = Router();

// Todo el módulo requiere autenticación
router.use(authenticate);

// Auditoría — accesible para super-admin y Dirección General
router.use(authorize('ADMIN_GENERAL', 'DIRECCION_GENERAL'));

router.get('/', getBitacoraLogs);

export default router;
