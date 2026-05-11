import { Router } from 'express';
import { Rol } from '@prisma/client'; // <--- IMPORTAMOS EL ENUM OFICIAL DE PRISMA
import { authenticate, authorize } from '../middlewares/auth';
import { uploadJustificante, uploadNominaArchivo } from '../utils/multerConfig';
import {
  createEmpleado,
  getEmpleados,
  generarNomina,
  getNominas,
  getNominaById,
  autorizarNomina,
  firmarNomina,
  archivarNomina,
  actualizarPreNomina,
  guardarAsistencias,
  obtenerAsistencias,
  decidirJustificacion,
  subirSubsidio,
  subirNominaFinal
} from '../controllers/nominas.controller';

const router = Router();

// Todo el módulo requiere estar logueado
router.use(authenticate);

// ============================================================
// ARREGLOS DE ROLES ESTRICTOS (Usando el Enum de Prisma)
// ============================================================
const rolesLideres = [
  Rol.ADMIN_GENERAL, Rol.RRHH_FINANZAS, Rol.RECURSOS_HUMANOS, Rol.RECURSOS_FINANCIEROS,
  Rol.JEFE_ADMINISTRATIVO, Rol.JEFE_MEDICO, Rol.AREA_MEDICA,
  Rol.ADMISIONES, Rol.ALMACEN, Rol.PSICOLOGIA, Rol.NUTRICION, Rol.ENFERMERIA
];

// Crear/listar/firmar nóminas: RH (sube), Finanzas, Jefatura, Dirección y el rol legacy combinado.
const rolesNomina = [
  Rol.ADMIN_GENERAL, Rol.RRHH_FINANZAS,
  Rol.RECURSOS_HUMANOS, Rol.RECURSOS_FINANCIEROS, Rol.JEFE_ADMINISTRATIVO
];

// ============================================================
// RUTAS ABIERTAS PARA JEFES (Pasar lista y ver empleados)
// ============================================================
router.get('/empleados', authorize(...rolesLideres), getEmpleados);
router.post('/asistencias', authorize(...rolesLideres), uploadJustificante.any(), guardarAsistencias);
router.get('/asistencias', authorize(...rolesLideres), obtenerAsistencias);

// Aprobar/rechazar justificación de una incidencia: roles de supervisión/nómina.
router.patch(
  '/asistencias/:id/justificacion',
  authorize(
    Rol.ADMIN_GENERAL,
    Rol.RRHH_FINANZAS,
    Rol.RECURSOS_HUMANOS,
    Rol.JEFE_ADMINISTRATIVO,
    Rol.JEFE_MEDICO
  ),
  decidirJustificacion
);

// ============================================================
// RUTAS RESTRINGIDAS (Uso exclusivo de RRHH y Directora)
// ============================================================

// Solo RRHH puede dar de alta nuevos empleados o editar salarios
router.post('/empleados', authorize(...rolesNomina), createEmpleado);

// Ciclos de Nómina (RH sube el archivo de CONTPAQi)
router.post('/ciclo', authorize(...rolesNomina), uploadNominaArchivo.single('archivo'), generarNomina);
router.get('/ciclo', authorize(...rolesNomina), getNominas);
router.get('/ciclo/:id', authorize(...rolesNomina), getNominaById); 

// Flujos de validación de Nómina
router.put('/ciclo/:id/autorizar', authorize(...rolesNomina), autorizarNomina);
router.put('/ciclo/:id/firmar', authorize(...rolesNomina), firmarNomina); 
router.put('/ciclo/:id/archivar', authorize(...rolesNomina), archivarNomina); 

// Pre-Nóminas específicas (Edición individual)
router.put('/prenominas/:id', authorize(...rolesNomina), actualizarPreNomina);

// Recursos Financieros sube el documento de subsidio (auto-firma).
router.post(
  '/ciclo/:id/subsidio',
  authorize(Rol.RECURSOS_FINANCIEROS, Rol.RRHH_FINANZAS, Rol.ADMIN_GENERAL),
  uploadNominaArchivo.single('archivo'),
  subirSubsidio
);

// RH sube la nómina final escaneada con la firma del trabajador (auto-firma).
router.post(
  '/ciclo/:id/nomina-final',
  authorize(Rol.RECURSOS_HUMANOS, Rol.RRHH_FINANZAS, Rol.ADMIN_GENERAL),
  uploadNominaArchivo.single('archivo'),
  subirNominaFinal
);

export default router;