import { Router } from 'express';
import { authenticate, authorize } from '../middlewares/auth';
import {
  getProveedores,
  getProveedorById,
  createProveedor,
  updateProveedor,
  cambiarEstadoProveedor,
  subirDocumentoProveedor,
  upload,
} from '../controllers/proveedores.controller';

const router = Router();

router.use(authenticate);

const ROLES_FINANZAS = ['RRHH_FINANZAS', 'RECURSOS_FINANCIEROS', 'ADMIN_GENERAL'] as const;
const ROLES_CONSULTA = ['RRHH_FINANZAS', 'RECURSOS_FINANCIEROS', 'ADMIN_GENERAL', 'ALMACEN', 'JEFE_ADMINISTRATIVO'] as const;

router.get('/',    authorize(...ROLES_CONSULTA), getProveedores);
router.get('/:id', authorize(...ROLES_CONSULTA), getProveedorById);

router.post('/',                                authorize(...ROLES_FINANZAS), createProveedor);
router.put('/:id',                              authorize(...ROLES_FINANZAS), updateProveedor);
router.patch('/:id/estado',                     authorize(...ROLES_FINANZAS), cambiarEstadoProveedor);
router.post('/:id/documentos/:tipo', upload.single('archivo'), authorize(...ROLES_FINANZAS), subirDocumentoProveedor);

export default router;
