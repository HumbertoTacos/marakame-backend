import { Router } from 'express';
import { z } from 'zod';
import { authenticate, authorize } from '../middlewares/auth';
import { AppError } from '../middlewares/errorHandler';
import {
  createEmpleado, getEmpleados,
  generarNomina, getNominas, autorizarNomina,
  updatePreNomina,
} from '../controllers/nominas.controller';

const router = Router();

// ── Schemas de validación ────────────────────────────────────

const createEmpleadoSchema = z.object({
  nombre: z.string().min(2, 'El nombre es obligatorio'),
  apellidos: z.string().min(2, 'Los apellidos son obligatorios'),
  puesto: z.string().min(2, 'El puesto es obligatorio'),
  departamento: z.string().min(2, 'El departamento es obligatorio'),
  salarioBase: z.coerce.number().min(0, 'El salario base debe ser mayor o igual a 0'),
});

const generarNominaSchema = z.object({
  periodo: z.string().min(3, 'El periodo es obligatorio (ej: Quincena 1 - Mayo 2026)'),
  fechaInicio: z.string().refine(v => !isNaN(Date.parse(v)), { message: 'Fecha de inicio inválida' }),
  fechaFin: z.string().refine(v => !isNaN(Date.parse(v)), { message: 'Fecha de fin inválida' }),
}).refine(d => new Date(d.fechaFin) >= new Date(d.fechaInicio), {
  message: 'La fecha de fin debe ser igual o posterior a la fecha de inicio',
  path: ['fechaFin'],
});

const updatePreNominaSchema = z.object({
  diasTrabajados: z.coerce.number().min(0).max(31).optional(),
  horasExtra: z.coerce.number().min(0).optional(),
  bonos: z.coerce.number().min(0).optional(),
  deducciones: z.coerce.number().min(0).optional(),
  incidencias: z.string().optional().nullable(),
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

function parseId(raw: string): number {
  const id = parseInt(raw, 10);
  if (isNaN(id) || id <= 0) throw new AppError(400, 'El ID debe ser un número entero positivo');
  return id;
}

// ── Rutas ────────────────────────────────────────────────────

router.use(authenticate);
router.use(authorize('ADMIN_GENERAL', 'RRHH_FINANZAS'));

router.post('/empleados', (req, _res, next) => {
  req.body = parseBody(createEmpleadoSchema, req.body);
  next();
}, createEmpleado);

router.get('/empleados', getEmpleados);

router.post('/ciclo', (req, _res, next) => {
  req.body = parseBody(generarNominaSchema, req.body);
  next();
}, generarNomina);

router.get('/ciclo', getNominas);

router.put('/ciclo/:id/autorizar', (req, _res, next) => {
  parseId(req.params.id as string);
  next();
}, autorizarNomina);

router.put('/prenomina/:id', (req, _res, next) => {
  parseId(req.params.id as string);
  req.body = parseBody(updatePreNominaSchema, req.body);
  next();
}, updatePreNomina);

export default router;
