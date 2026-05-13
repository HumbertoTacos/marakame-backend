import { Router } from 'express';
import { authenticate } from '../middlewares/auth';
import {
  createRequisicion,
  getRequisiciones,
  getRequisicionById,
  enviarACompras,
} from '../controllers/requisiciones.controller';

const router = Router();

router.use(authenticate);

router.get('/', getRequisiciones);
router.get('/:id', getRequisicionById);
router.post('/', createRequisicion);
router.patch('/:id/enviar-compras', enviarACompras);

export default router;
