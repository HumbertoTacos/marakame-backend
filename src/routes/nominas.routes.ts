import { Router } from 'express';
import { Rol } from '@prisma/client'; // <--- IMPORTAMOS EL ENUM OFICIAL DE PRISMA
import { authenticate, authorize } from '../middlewares/auth';
import { uploadJustificante, uploadNominaArchivo } from '../utils/multerConfig';
import {
  createEmpleado,
  getEmpleados,
  updateEmpleado,
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
  justificarQuincena,
  subirSubsidio,
  firmarAdministracion,
  cerrarNomina,
} from '../controllers/nominas.controller';

const router = Router();

// Todo el módulo requiere estar logueado
router.use(authenticate);

// ============================================================
// ARREGLOS DE ROLES ESTRICTOS (Usando el Enum de Prisma)
// ============================================================
const rolesLideres = [
  Rol.ADMIN_GENERAL, Rol.DIRECCION_GENERAL, Rol.RRHH_FINANZAS, Rol.RECURSOS_HUMANOS, Rol.RECURSOS_FINANCIEROS,
  Rol.JEFE_ADMINISTRATIVO, Rol.JEFE_MEDICO, Rol.JEFE_CLINICO, Rol.JEFE_ADMISIONES,
  Rol.AREA_MEDICA, Rol.ADMISIONES, Rol.ALMACEN, Rol.PSICOLOGIA, Rol.NUTRICION, Rol.ENFERMERIA
];

// Crear/listar/firmar nóminas: RH (sube), Finanzas, Administración, Dirección General y el rol legacy combinado.
const rolesNomina = [
  Rol.ADMIN_GENERAL, Rol.DIRECCION_GENERAL, Rol.RRHH_FINANZAS,
  Rol.RECURSOS_HUMANOS, Rol.RECURSOS_FINANCIEROS, Rol.JEFE_ADMINISTRATIVO
];

// ============================================================
// RUTAS ABIERTAS PARA JEFES (Pasar lista y ver empleados)
// ============================================================
router.get('/empleados', authorize(...rolesLideres), getEmpleados);
router.post('/asistencias', authorize(...rolesLideres), uploadJustificante.any(), guardarAsistencias);
router.get('/asistencias', authorize(...rolesLideres), obtenerAsistencias);

// Aprobar/rechazar justificación de una incidencia: jefes departamentales + RH + Dirección.
router.patch(
  '/asistencias/:id/justificacion',
  authorize(
    Rol.ADMIN_GENERAL,
    Rol.RRHH_FINANZAS,
    Rol.RECURSOS_HUMANOS,
    Rol.JEFE_ADMINISTRATIVO,
    Rol.JEFE_MEDICO,
    Rol.JEFE_CLINICO,
    Rol.JEFE_ADMISIONES
  ),
  decidirJustificacion
);

// Justificación QUINCENAL: un solo archivo + motivo cubre todas las incidencias del empleado
// en el rango (fechaInicio..fechaFin). Las deja en PENDIENTE para que la admin las revise.
router.post(
  '/asistencias/justificar-quincena',
  authorize(...rolesLideres),
  uploadJustificante.single('archivo'),
  justificarQuincena
);

// ============================================================
// RUTAS RESTRINGIDAS (Uso exclusivo de RRHH y Directora)
// ============================================================

// Solo RRHH/Admón puede dar de alta nuevos empleados, editar datos o dar de baja
router.post('/empleados', authorize(...rolesNomina), createEmpleado);
router.put('/empleados/:id', authorize(...rolesNomina), updateEmpleado);

// Ciclos de Nómina — RH crea la pre-nómina directo en el sistema (sin archivo externo).
router.post('/ciclo', authorize(...rolesNomina), generarNomina);
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

// Paso intermedio: Administración (administracion@marakame.com, rol RRHH_FINANZAS) firma con un
// botón después de Finanzas. No sube documento — sólo valida y aplica firma.
router.post(
  '/ciclo/:id/administracion-firma',
  authorize(Rol.RRHH_FINANZAS),
  firmarAdministracion
);

// RH cierra la nómina aplicando descuentos por faltas del periodo (auto-firma).
router.post(
  '/ciclo/:id/cerrar',
  authorize(Rol.RECURSOS_HUMANOS, Rol.RRHH_FINANZAS, Rol.ADMIN_GENERAL),
  cerrarNomina
);

export default router;