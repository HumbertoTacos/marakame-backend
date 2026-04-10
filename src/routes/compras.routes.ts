import { Router } from 'express';
import { authenticate } from '../middlewares/auth';
import { 
  createRequisicion, getRequisiciones, updateRequisicionEstado,
  addCotizacion, generarOrden
} from '../controllers/compras.controller';

const router = Router();

// Todo el módulo de compras requiere autenticación
router.use(authenticate);

// Requisiciones
router.post('/requisicion', createRequisicion);
router.get('/requisicion', getRequisiciones);
router.put('/requisicion/:id/estado', updateRequisicionEstado);

// Cotizaciones y órdenes
router.post('/requisicion/:requisicionId/cotizacion', addCotizacion);
router.post('/requisicion/:requisicionId/orden', generarOrden);

export default router;
