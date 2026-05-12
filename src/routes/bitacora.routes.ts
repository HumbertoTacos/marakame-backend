import { Router } from 'express';
import { authenticate, authorize } from '../middlewares/auth';
import { getBitacoraLogs } from '../controllers/bitacora.controller';

const router = Router();

// Todo el módulo requiere autenticación
router.use(authenticate);

// Solo el ADMIN puede ver los logs porsupuesto
router.use(authorize('ADMIN_GENERAL'));

router.get('/', getBitacoraLogs);

export default router;
