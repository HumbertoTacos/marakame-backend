import { Router } from 'express';
import { authenticate, authorize } from '../middlewares/auth';

import {
  getCompras,
  getCompraById,
  createCompra,
  registrarCotizacion,
  registrarCotizacionesBulk,
  eliminarCotizacion,
  agregarCotizacionProducto,
  seleccionarCotizacionProducto,
  seleccionarProveedor,
  enviarAAdministracion,
  aprobarAdministracion,
  devolverACompras,
  autorizarDireccion,
  rechazarDireccion,
  generarOrden,
  registrarFactura,
  subirFactura,
  generarExpediente,
  enviarAFinanzas,
  generarOrdenPago,
  finalizarCompra,
  dashboardCompras,
  upload,
} from '../controllers/compras.controller';

const router = Router();

router.use(authenticate);

// ============================================================
// ROLES
// ============================================================

const ROLES_COMPRAS        = ['ALMACEN', 'ADMIN_GENERAL'] as const;
const ROLES_ADMINISTRACION = ['RRHH_FINANZAS', 'ADMIN_GENERAL', 'JEFE_ADMINISTRATIVO'] as const;
const ROLES_DIRECCION      = ['ADMIN_GENERAL'] as const;
const ROLES_TODOS          = ['ADMIN_GENERAL', 'ALMACEN', 'RRHH_FINANZAS', 'JEFE_ADMINISTRATIVO'] as const;

// ============================================================
// DASHBOARD
// ============================================================

router.get('/dashboard', authorize(...ROLES_TODOS), dashboardCompras);

// ============================================================
// LISTADO Y DETALLE
// ============================================================

router.get('/', authorize(...ROLES_TODOS), getCompras);
router.get('/:id', authorize(...ROLES_TODOS), getCompraById);

// ============================================================
// CREAR COMPRA DESDE REQUISICIÓN
// ============================================================

router.post('/', authorize(...ROLES_COMPRAS), createCompra);

// ============================================================
// COTIZACIONES
// ============================================================

router.post('/:id/cotizaciones', authorize(...ROLES_COMPRAS), registrarCotizacion);
router.post('/:id/cotizaciones-bulk', authorize(...ROLES_COMPRAS), registrarCotizacionesBulk);
router.post('/:id/cotizacion-producto', authorize(...ROLES_COMPRAS), agregarCotizacionProducto);
router.patch('/:id/cotizaciones/:cotizacionId/seleccionar', authorize(...ROLES_COMPRAS, ...ROLES_ADMINISTRACION), seleccionarCotizacionProducto);
router.delete('/:id/cotizaciones/:cotizacionId', authorize(...ROLES_COMPRAS), eliminarCotizacion);

// ============================================================
// SELECCIONAR PROVEEDOR
// ============================================================

router.patch('/:id/seleccionar-proveedor', authorize(...ROLES_COMPRAS), seleccionarProveedor);

// ============================================================
// FLUJO DE ESTADOS
// ============================================================

router.patch('/:id/enviar-administracion', authorize(...ROLES_COMPRAS), enviarAAdministracion);

router.patch('/:id/aprobar-administracion', authorize(...ROLES_ADMINISTRACION), aprobarAdministracion);

router.patch('/:id/devolver-compras', authorize(...ROLES_ADMINISTRACION), devolverACompras);

router.patch('/:id/autorizar-direccion', authorize(...ROLES_DIRECCION), autorizarDireccion);

router.patch('/:id/rechazar-direccion', authorize(...ROLES_DIRECCION), rechazarDireccion);

// ============================================================
// ORDEN DE COMPRA
// ============================================================

router.post('/:id/orden', authorize(...ROLES_TODOS), generarOrden);

// ============================================================
// FACTURAS
// ============================================================

router.post('/:id/facturas', authorize(...ROLES_ADMINISTRACION), registrarFactura);

router.post(
  '/:id/factura-upload',
  authorize(...ROLES_ADMINISTRACION),
  upload.single('factura'),
  subirFactura,
);

// ============================================================
// EXPEDIENTE Y FINANZAS
// ============================================================

router.patch('/:id/generar-expediente', authorize(...ROLES_ADMINISTRACION), generarExpediente);

router.patch('/:id/enviar-finanzas', authorize(...ROLES_ADMINISTRACION), enviarAFinanzas);

// ============================================================
// ORDEN DE PAGO Y FINALIZAR
// ============================================================

router.post('/:id/orden-pago', authorize(...ROLES_ADMINISTRACION), generarOrdenPago);

router.patch('/:id/finalizar', authorize(...ROLES_ADMINISTRACION), finalizarCompra);

export default router;