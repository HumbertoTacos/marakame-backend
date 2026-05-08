import { Router } from 'express';
import { authenticate, authorize } from '../middlewares/auth';
import { Rol } from '@prisma/client';
import { getDashboardStats, getDashboardDirectora } from '../controllers/dashboard.controller';

const router = Router();

router.use(authenticate);
router.get('/',          getDashboardStats);
router.get('/directora', authorize(Rol.ADMIN_GENERAL), getDashboardDirectora);

export default router;
