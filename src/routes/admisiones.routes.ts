import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../middlewares/auth';
import { AppError } from '../middlewares/errorHandler';
import {
  createPrimerContacto, updatePrimerContacto, getPrimerContactos,
  getPrimerContactoById, getPrimerContactoByPacienteId, getSustancias,
  desactivarPrimerContacto,
  agendarCitaProspecto, solicitarValoracionMedica, registrarLlegadaCita,
  createValoracionDiagnostica, getValoraciones, getValoracionById,
  createIngreso, updateIngreso, getIngresos, getIngresoById,
  getCamas, getSolicitudes, getSolicitudByFolio, createSolicitud,
  updateEstadoSolicitud, asignarCama,
} from '../controllers/admisiones.controller';
import {
  crearValoracionMedica,
  getValoracionMedicaByPaciente,
  preFillValoracionMedica,
  uploadFirmaValoracionMedica,
} from '../controllers/valoracionMedica.controller';
import { upsertEstudioSocioeconomico, getEstudioByPaciente } from '../controllers/estudioSocioeconomico.controller';
import { uploadValoracion } from '../utils/multerConfig';

const router = Router();

// ── Schemas de validación ────────────────────────────────────

const telefonoMx = z.string().regex(/^\d{10}$/, 'El teléfono debe tener exactamente 10 dígitos');

const createPrimerContactoSchema = z.object({
  nombrePaciente: z.string().min(2, 'El nombre del paciente es obligatorio'),
  celularLlamada: telefonoMx,
  telCasaLlamada: telefonoMx.optional().nullable(),
  telefonoPaciente: telefonoMx.optional().nullable(),
  conclusionMedica: z.string().min(5, 'La conclusión médica es obligatoria'),
  nombreLlamada: z.string().optional().nullable(),
  lugarLlamada: z.string().optional().nullable(),
  domicilioLlamada: z.string().optional().nullable(),
  ocupacionLlamada: z.string().optional().nullable(),
  edadPaciente: z.coerce.number().int().min(1).max(120).optional().nullable(),
  estadoCivilPaciente: z.string().optional().nullable(),
  hijosPaciente: z.coerce.number().int().min(0).max(30).optional().nullable(),
  direccionPaciente: z.string().optional().nullable(),
  escolaridadPaciente: z.string().optional().nullable(),
  origenPaciente: z.string().optional().nullable(),
  ocupacionPaciente: z.string().optional().nullable(),
  parentescoLlamada: z.string().optional().nullable(),
  parentescoOtro: z.string().optional().nullable(),
  hora: z.string().optional().nullable(),
  medioEnterado: z.string().optional().nullable(),
  sustancias: z.array(z.string()).default([]),
  sustanciasOtros: z.array(z.string()).default([]),
  dispuestoInternarse: z.coerce.boolean().optional().nullable(),
  realizoIntervencion: z.coerce.boolean().optional().nullable(),
  conclusionIntervencion: z.string().optional().nullable(),
  tratamientoPrevio: z.coerce.boolean().optional().nullable(),
  lugarTratamiento: z.string().optional().nullable(),
  posibilidadesEconomicas: z.string().optional().nullable(),
  acuerdoLlamarle: z.coerce.boolean().default(false),
  acuerdoOtro: z.string().optional().nullable(),
  acuerdoEsperarLlamada: z.coerce.boolean().default(false),
  acuerdoEsperarVisita: z.coerce.boolean().default(false),
  acuerdoPosibleIngreso: z.coerce.boolean().default(false),
  acuerdoSeguimiento: z.string().default('ESPERAR_LLAMADA'),
  fechaAcuerdo: z.string().optional().nullable(),
  medicoValoro: z.string().optional().nullable(),
  esApto: z.coerce.boolean().default(false),
  pacienteId: z.coerce.number().int().positive().optional().nullable(),
});

const agendarCitaSchema = z.object({
  fechaAcuerdo: z.string().refine(v => !isNaN(Date.parse(v)), { message: 'Fecha de cita inválida' }),
});

const curpRegex = /^[A-Z]{4}\d{6}[HM][A-Z]{5}[A-Z0-9]\d$/i;

const createSolicitudSchema = z.object({
  // Paciente nuevo (opcionales si viene pacienteId)
  nombre: z.string().min(2).optional(),
  apellidoPaterno: z.string().min(2).optional(),
  apellidoMaterno: z.string().optional().nullable(),
  fechaNacimiento: z.string().optional(),
  sexo: z.enum(['M', 'F', 'OTRO']).optional(),
  curp: z.string().regex(curpRegex, 'CURP inválida').optional().nullable(),
  // Paciente existente
  pacienteId: z.coerce.number().int().positive().optional().nullable(),
  // Clínico
  tipoAdiccion: z.string().optional().nullable(),
  motivoIngreso: z.string().min(5, 'El motivo de ingreso es obligatorio'),
  areaDeseada: z.string().optional().nullable(),
  urgencia: z.enum(['BAJA', 'MEDIA', 'ALTA', 'CRITICA']).default('BAJA'),
  observaciones: z.string().optional().nullable(),
  camaId: z.coerce.number().int().positive().optional().nullable(),
  // Familiar responsable
  solicitanteNombre: z.string().min(2, 'El nombre del solicitante es obligatorio'),
  solicitanteParentesco: z.string().min(2, 'El parentesco es obligatorio'),
  solicitanteTelefono: telefonoMx,
  solicitanteCorreo: z.string().email('Correo inválido').optional().nullable(),
  solicitanteMunicipio: z.string().optional().nullable(),
  solicitanteEstado: z.string().optional().nullable(),
}).refine(d => d.pacienteId || (d.nombre && d.apellidoPaterno && d.fechaNacimiento && d.sexo), {
  message: 'Proporciona pacienteId existente o los datos completos del nuevo paciente (nombre, apellido paterno, fecha de nacimiento, sexo)',
});

const updateEstadoSolicitudSchema = z.object({
  estado: z.enum(['PENDIENTE', 'EN_PROCESO', 'APROBADA', 'RECHAZADA', 'EN_ESPERA'], { message: 'Estado inválido' }),
  motivoRechazo: z.string().optional().nullable(),
});

const asignarCamaSchema = z.object({
  camaId: z.coerce.number().int().positive('El ID de cama es obligatorio'),
  fechaIngresoEstimada: z.string().refine(v => !isNaN(Date.parse(v)), { message: 'Fecha de ingreso inválida' }),
  observaciones: z.string().optional().nullable(),
  medicoId: z.coerce.number().int().positive('El ID del médico es obligatorio'),
  medicoNombre: z.string().min(2, 'El nombre del médico es obligatorio'),
});

const createIngresoSchema = z.object({
  pacienteId: z.coerce.number().int().positive('El ID del paciente es obligatorio'),
  motivoIngreso: z.string().min(5, 'El motivo de ingreso es obligatorio'),
});

const updateIngresoSchema = z.object({
  pasoActual: z.coerce.number().int().min(1).max(8).optional(),
  estado: z.enum(['EN_PROCESO', 'COMPLETADO', 'CANCELADO']).optional(),
  motivoIngreso: z.string().min(5).optional(),
  fechaCita: z.string().optional().nullable(),
  horaCita: z.string().optional().nullable(),
  medicoAsignado: z.string().optional().nullable(),
  resultadoValoracion: z.string().optional().nullable(),
  observacionesValoracion: z.string().optional().nullable(),
  esApto: z.coerce.boolean().optional(),
  motivoNoApto: z.string().optional().nullable(),
  habitacionAsignada: z.string().optional().nullable(),
  areaAsignada: z.string().optional().nullable(),
});

const crearValoracionMedicaSchema = z.object({
  pacienteId: z.coerce.number().int().positive('El ID del paciente es obligatorio'),
  motivoConsulta: z.string().min(5, 'El motivo de consulta es obligatorio'),
  impresionDiagnostica: z.string().min(3, 'La impresión diagnóstica es obligatoria'),
  padecimientoActual: z.string().optional().nullable(),
  sintomasGenerales: z.string().optional().nullable(),
  tratamientosPrevios: z.string().optional().nullable(),
  antecedentesHeredofamiliares: z.string().optional().nullable(),
  antecedentesPatologicos: z.string().optional().nullable(),
  antecedentesNoPatologicos: z.string().optional().nullable(),
  historialConsumo: z.string().optional().nullable(),
  tensionArterial: z.string().optional().nullable(),
  frecuenciaCardiaca: z.coerce.number().int().min(30).max(300).optional().nullable(),
  frecuenciaRespiratoria: z.coerce.number().int().min(5).max(60).optional().nullable(),
  temperatura: z.coerce.number().min(30).max(45).optional().nullable(),
  peso: z.coerce.number().min(1).max(500).optional().nullable(),
  talla: z.coerce.number().min(0.3).max(2.5).optional().nullable(),
  exploracionFisicaDesc: z.string().optional().nullable(),
  examenMental: z.string().optional().nullable(),
  pronostico: z.string().optional().nullable(),
  planTratamiento: z.string().optional().nullable(),
  esAptoParaIngreso: z.coerce.boolean().default(false),
  residente: z.string().optional().nullable(),
  tipoValoracion: z.string().optional().nullable(),
  fechaValoracion: z.string().optional().nullable(),
  horaValoracion: z.string().optional().nullable(),
});

const upsertEstudioSchema = z.object({
  pacienteId: z.coerce.number().int().positive('El ID del paciente es obligatorio'),
  seccionActual: z.coerce.number().int().min(1).max(10).default(1),
  completado: z.coerce.boolean().default(false),
  datos: z.record(z.unknown()).default({}),
});

// ── Helper de validación inline ──────────────────────────────

function parseBody<T>(schema: z.ZodSchema<T>, body: unknown): T {
  const result = schema.safeParse(body);
  if (!result.success) {
    const msg = result.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(' | ');
    throw new AppError(400, `Datos inválidos: ${msg}`);
  }
  return result.data;
}

function parseId(raw: string | string[], label = 'ID'): number {
  const idRaw = Array.isArray(raw) ? raw[0] : raw;
  const id = parseInt(idRaw, 10);
  if (isNaN(id) || id <= 0) throw new AppError(400, `${label} debe ser un número entero positivo`);
  return id;
}

// ── Rutas ────────────────────────────────────────────────────

// Catálogos públicos
router.get('/sustancias', getSustancias);

router.use(authenticate);

// Camas
router.get('/camas', getCamas);

// Solicitudes de ingreso
router.get('/solicitudes', getSolicitudes);
router.get('/solicitudes/:folio', getSolicitudByFolio);

router.post('/solicitudes', (req, _res, next) => {
  req.body = parseBody(createSolicitudSchema, req.body);
  next();
}, createSolicitud);

router.patch('/solicitudes/:id/estado', (req, _res, next) => {
  parseId(req.params.id);
  req.body = parseBody(updateEstadoSolicitudSchema, req.body);
  next();
}, updateEstadoSolicitud);

router.post('/solicitudes/:id/asignar-cama', (req, _res, next) => {
  parseId(req.params.id);
  req.body = parseBody(asignarCamaSchema, req.body);
  next();
}, asignarCama);

// Primer Contacto
router.post('/primer-contacto', (req, _res, next) => {
  req.body = parseBody(createPrimerContactoSchema, req.body);
  next();
}, createPrimerContacto);

router.get('/primer-contacto', getPrimerContactos);

router.get('/primer-contacto/:id', (req, _res, next) => {
  parseId(req.params.id);
  next();
}, getPrimerContactoById);

router.put('/primer-contacto/:id', (req, _res, next) => {
  parseId(req.params.id);
  next();
}, updatePrimerContacto);

router.patch('/primer-contacto/:id/desactivar', (req, _res, next) => {
  parseId(req.params.id);
  next();
}, desactivarPrimerContacto);

router.patch('/primer-contacto/:id/agendar', (req, _res, next) => {
  parseId(req.params.id);
  req.body = parseBody(agendarCitaSchema, req.body);
  next();
}, agendarCitaProspecto);

router.patch('/paciente/:id/solicitar-valoracion', (req, _res, next) => {
  parseId(req.params.id);
  next();
}, solicitarValoracionMedica);

router.patch('/paciente/:id/confirmar-llegada', (req, _res, next) => {
  parseId(req.params.id);
  next();
}, registrarLlegadaCita);

router.get('/paciente/:pacienteId/primer-contacto', (req, _res, next) => {
  parseId(req.params.pacienteId as string, 'pacienteId');
  next();
}, getPrimerContactoByPacienteId);

// Valoración Diagnóstica
router.post('/valoracion', createValoracionDiagnostica);
router.get('/valoracion', getValoraciones);

router.get('/valoracion/:id', (req, _res, next) => {
  parseId(req.params.id);
  next();
}, getValoracionById);

// Valoración Médica
router.get('/valoracion-medica/:pacienteId/pre-fill', (req, _res, next) => {
  parseId(req.params.pacienteId as string, 'pacienteId');
  next();
}, preFillValoracionMedica);

router.post('/valoracion-medica', (req, _res, next) => {
  req.body = parseBody(crearValoracionMedicaSchema, req.body);
  next();
}, crearValoracionMedica);

router.post('/valoracion-medica/:id/upload-firma', (req, _res, next) => {
  parseId(req.params.id);
  next();
}, uploadValoracion.single('archivo'), uploadFirmaValoracionMedica);

router.get('/valoracion-medica/paciente/:pacienteId', (req, _res, next) => {
  parseId(req.params.pacienteId, 'pacienteId');
  next();
}, getValoracionMedicaByPaciente);

// Ingreso Wizard
router.post('/ingreso', (req, _res, next) => {
  req.body = parseBody(createIngresoSchema, req.body);
  next();
}, createIngreso);

router.get('/ingreso', getIngresos);

router.get('/ingreso/:id', (req, _res, next) => {
  parseId(req.params.id);
  next();
}, getIngresoById);

router.put('/ingreso/:id', (req, _res, next) => {
  parseId(req.params.id);
  req.body = parseBody(updateIngresoSchema, req.body);
  next();
}, updateIngreso);

// Estudio Socioeconómico
router.post('/estudio', (req, _res, next) => {
  req.body = parseBody(upsertEstudioSchema, req.body);
  next();
}, upsertEstudioSocioeconomico);

router.get('/estudio/paciente/:pacienteId', (req, _res, next) => {
  parseId(req.params.pacienteId, 'pacienteId');
  next();
}, getEstudioByPaciente);

export default router;
