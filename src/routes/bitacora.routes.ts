import { Router } from 'express';
import { authenticate, authorize } from '../middlewares/auth';
import { getAuditoria } from '../controllers/bitacora.controller';

const router = Router();

// Todo el módulo requiere autenticación
router.use(authenticate);

// Auditoría — accesible para super-admin y Dirección General
router.use(authorize('ADMIN_GENERAL', 'DIRECCION_GENERAL'));

router.get('/', getAuditoria);

export default router;
