import { Router } from 'express';
import { Rol } from '@prisma/client'; // <--- IMPORTAMOS EL ENUM OFICIAL DE PRISMA
import { authenticate, authorize } from '../middlewares/auth';
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
  guardarAsistencias
} from '../controllers/nominas.controller';

const router = Router();

// Todo el módulo requiere estar logueado
router.use(authenticate);

// ============================================================
// ARREGLOS DE ROLES ESTRICTOS (Usando el Enum de Prisma)
// ============================================================
const rolesLideres = [
  Rol.ADMIN_GENERAL, Rol.RRHH_FINANZAS, Rol.JEFE_MEDICO, Rol.AREA_MEDICA, 
  Rol.ADMISIONES, Rol.ALMACEN, Rol.PSICOLOGIA, Rol.NUTRICION, Rol.ENFERMERIA
];

const rolesNomina = [Rol.ADMIN_GENERAL, Rol.RRHH_FINANZAS];

// ============================================================
// RUTAS ABIERTAS PARA JEFES (Pasar lista y ver empleados)
// ============================================================
router.get('/empleados', authorize(...rolesLideres), getEmpleados);
router.post('/asistencias', authorize(...rolesLideres), guardarAsistencias);

// ============================================================
// RUTAS RESTRINGIDAS (Uso exclusivo de RRHH y Directora)
// ============================================================

// Solo RRHH puede dar de alta nuevos empleados o editar salarios
router.post('/empleados', authorize(...rolesNomina), createEmpleado);

// Ciclos de Nómina
router.post('/ciclo', authorize(...rolesNomina), generarNomina);
router.get('/ciclo', authorize(...rolesNomina), getNominas);
router.get('/ciclo/:id', authorize(...rolesNomina), getNominaById); 

// Flujos de validación de Nómina
router.put('/ciclo/:id/autorizar', authorize(...rolesNomina), autorizarNomina);
router.put('/ciclo/:id/firmar', authorize(...rolesNomina), firmarNomina); 
router.put('/ciclo/:id/archivar', authorize(...rolesNomina), archivarNomina); 

// Pre-Nóminas específicas (Edición individual)
router.put('/prenominas/:id', authorize(...rolesNomina), actualizarPreNomina); 

export default router;