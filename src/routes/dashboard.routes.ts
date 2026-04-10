import { Router } from 'express';
import { authenticate } from '../middlewares/auth';
import { getDashboardStats } from '../controllers/dashboard.controller';

const router = Router();

router.use(authenticate);
router.get('/', getDashboardStats);

export default router;
