import { Router } from 'express';
import { authenticate } from '../middlewares/auth';
import {
  createRequisicion,
  getRequisiciones,
  updateRequisicionEstado,
  addCotizacion,
  generarOrden,
  upload,     
  subirFactura
} from '../controllers/compras.controller';

// (Opcional futuro) middleware de roles
// import { authorize } from '../middlewares/authorize';

const router = Router();

router.use(authenticate);

// REQUISICIONES

// Crear requisición
router.post('/requisiciones', createRequisicion);

// Obtener todas
router.get('/requisiciones', getRequisiciones);

// Cambiar estado
router.patch('/requisiciones/:id/estado', updateRequisicionEstado);

// ============================================================

// COTIZACIONES

// Agregar cotización
router.post('/requisiciones/:requisicionId/cotizaciones', addCotizacion);

// ============================================================

// ÓRDENES DE COMPRA

// Generar orden
router.post('/requisiciones/:requisicionId/orden', generarOrden);

// ============================================================

// FACTURAS

router.post('/requisiciones/:requisicionId/factura', upload.single('factura'), subirFactura);

export default router;