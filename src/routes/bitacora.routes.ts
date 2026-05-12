import { Router } from 'express';
import { authenticate, authorize } from '../middlewares/auth';
import { getBitacoraLogs } from '../controllers/bitacora.controller';

const router = Router();

// Todo el módulo requiere autenticación
router.use(authenticate);

// Eliminamos la restricción estricta de ADMIN_GENERAL para que cada rol vea sus propios logs
// router.use(authorize('ADMIN_GENERAL'));

router.get('/', getBitacoraLogs);

export default router;
