import { Router } from 'express';
import { authenticate } from '../middlewares/auth';
import {
  getActividades,
  createActividad,
  deleteActividad,
} from '../controllers/actividades.controller';

const router = Router();

router.use(authenticate);

router.get('/',     getActividades);
router.post('/',    createActividad);
router.delete('/:id', deleteActividad);

export default router;
