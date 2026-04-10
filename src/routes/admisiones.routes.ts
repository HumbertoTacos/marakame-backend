import { Router } from 'express';
import { authenticate } from '../middlewares/auth';
import { 
  createPrimerContacto, getPrimerContactos, getPrimerContactoById,
  createValoracionDiagnostica, getValoraciones, getValoracionById,
  createIngreso, updateIngreso, getIngresos, getIngresoById,
  // Gestión de Camas y Solicitudes
  getCamas, getSolicitudes, getSolicitudByFolio, createSolicitud, updateEstadoSolicitud, asignarCama
} from '../controllers/admisiones.controller';

const router = Router();

// Solo autenticados pueden acceder
router.use(authenticate);

// Gestión de Camas
router.get('/camas', getCamas);

// Gestión de Solicitudes (Nuevo Flujo)
router.get('/solicitudes', getSolicitudes);
router.get('/solicitudes/:folio', getSolicitudByFolio);
router.post('/solicitudes', createSolicitud);
router.patch('/solicitudes/:id/estado', updateEstadoSolicitud);
router.post('/solicitudes/:id/asignar-cama', asignarCama);

// Primer Contacto
router.post('/primer-contacto', createPrimerContacto);
router.get('/primer-contacto', getPrimerContactos);
router.get('/primer-contacto/:id', getPrimerContactoById);

// Valoracion Diagnostica
router.post('/valoracion', createValoracionDiagnostica);
router.get('/valoracion', getValoraciones);
router.get('/valoracion/:id', getValoracionById);

// Ingreso Wizard
router.post('/ingreso', createIngreso);
router.get('/ingreso', getIngresos);
router.get('/ingreso/:id', getIngresoById);
router.put('/ingreso/:id', updateIngreso);

export default router;
