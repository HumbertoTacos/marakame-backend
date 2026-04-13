import { Router } from 'express';
import { authenticate } from '../middlewares/auth';
import { 
  createPrimerContacto, updatePrimerContacto, getPrimerContactos, getPrimerContactoById, getSustancias,
  agendarCitaProspecto, solicitarValoracionMedica,
  createValoracionDiagnostica, getValoraciones, getValoracionById,
  createIngreso, updateIngreso, getIngresos, getIngresoById,
  // Gestión de Camas y Solicitudes
  getCamas, getSolicitudes, getSolicitudByFolio, createSolicitud, updateEstadoSolicitud, asignarCama
} from '../controllers/admisiones.controller';
import { crearValoracionMedica, getValoracionMedicaByPaciente } from '../controllers/valoracionMedica.controller';
import { upsertEstudioSocioeconomico, getEstudioByPaciente } from '../controllers/estudioSocioeconomico.controller';
import { uploadValoracion } from '../utils/multerConfig';

const router = Router();

// ── Catálogos Públicos (No sensibles) ───────────────────────
router.get('/sustancias', getSustancias);

// ── Rutas Protegidas (Solo autenticados) ─────────────────────
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
router.put('/primer-contacto/:id', updatePrimerContacto);
router.patch('/primer-contacto/:id/agendar', agendarCitaProspecto);
router.patch('/paciente/:id/solicitar-valoracion', solicitarValoracionMedica);

// Valoracion Diagnostica
router.post('/valoracion', createValoracionDiagnostica);
router.get('/valoracion', getValoraciones);
router.get('/valoracion/:id', getValoracionById);

// Valoración Médica (Historia Clínica)
router.post('/valoracion-medica', uploadValoracion.single('archivo'), crearValoracionMedica);
router.get('/valoracion-medica/paciente/:pacienteId', getValoracionMedicaByPaciente);

// Ingreso Wizard
router.post('/ingreso', createIngreso);
router.get('/ingreso', getIngresos);
router.get('/ingreso/:id', getIngresoById);
router.put('/ingreso/:id', updateIngreso);

// Estudio Socioeconómico (Trabajo Social)
router.post('/estudio', upsertEstudioSocioeconomico);
router.get('/estudio/paciente/:pacienteId', getEstudioByPaciente);

export default router;
