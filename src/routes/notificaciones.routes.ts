import { Router } from 'express';
import { authenticate } from '../middlewares/auth';
import {
  getMisNotificaciones,
  marcarComoLeida,
  marcarTodasComoLeidas
} from '../controllers/notificaciones.controller';

const router = Router();

router.use(authenticate);

router.get('/', getMisNotificaciones);
router.patch('/:id/leida', marcarComoLeida);
router.patch('/marcar-todas-leidas', marcarTodasComoLeidas);

export default router;
