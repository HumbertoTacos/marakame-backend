import { Router } from 'express';
import { authenticate, authorize } from '../middlewares/auth';
import { 
  createProducto, getProductos, getProductoById, updateProducto,
  registerMovimiento, getMovimientos
} from '../controllers/almacen.controller';

const router = Router();

// Middleware de autenticación genérico
router.use(authenticate);

// ============================================================
// PRODUCTOS
// ============================================================
// Solo ALMACEN y ADMIN_GENERAL pueden crear o modificar productos (opcional, ajustado en el helper authorize)
router.post('/productos', authorize('ALMACEN', 'ADMIN_GENERAL'), createProducto);
router.get('/productos', getProductos);
router.get('/productos/:id', getProductoById);
router.put('/productos/:id', authorize('ALMACEN', 'ADMIN_GENERAL'), updateProducto);

// ============================================================
// MOVIMIENTOS (KARDEX)
// ============================================================
router.post('/movimientos', authorize('ALMACEN', 'ADMIN_GENERAL', 'AREA_MEDICA', 'ENFERMERIA' as any), registerMovimiento);
router.get('/movimientos', authorize('ALMACEN', 'ADMIN_GENERAL', 'RRHH_FINANZAS'), getMovimientos);

export default router;
