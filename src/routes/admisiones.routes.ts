import { Router } from 'express';
import { authenticate } from '../middlewares/auth';
import { 
  createPrimerContacto, getPrimerContactos, getPrimerContactoById,
  createValoracionDiagnostica, getValoraciones, getValoracionById,
  createIngreso, updateIngreso, getIngresos, getIngresoById,
  createEstudioSocioeconomico, updateEstudioSocioeconomico, getEstudiosSocioeconomicos, getEstudioByPacienteId
} from '../controllers/admisiones.controller';

const router = Router();

// Solo autenticados pueden acceder
router.use(authenticate);

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

// Estudio Socioeconomico
router.post('/estudio', createEstudioSocioeconomico);
router.get('/estudio', getEstudiosSocioeconomicos);
router.get('/estudio/paciente/:pacienteId', getEstudioByPacienteId);
router.put('/estudio/:id', updateEstudioSocioeconomico);

export default router;
