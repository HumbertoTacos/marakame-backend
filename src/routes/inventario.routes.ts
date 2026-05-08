import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../middlewares/auth';
import { AppError } from '../middlewares/errorHandler';
import { upsertInventario, getInventarioByPaciente } from '../controllers/inventario.controller';

const router = Router();

function parseId(raw: string, label = 'ID'): number {
  const id = parseInt(raw, 10);
  if (isNaN(id) || id <= 0) throw new AppError(400, `${label} debe ser un número entero positivo`);
  return id;
}

const articuloSchema = z.object({
  categoria: z.string(),
  nombre: z.string(),
  cantidad: z.coerce.number().int().min(0).default(0),
  observaciones: z.string().optional().default(''),
});

const upsertInventarioSchema = z.object({
  articulos: z.array(articuloSchema).default([]),
  validado: z.coerce.boolean().default(false),
  firmaRecibido: z.coerce.boolean().default(false),
});

router.use(authenticate);

router.get('/paciente/:pacienteId', (req, _res, next) => {
  parseId(req.params.pacienteId, 'pacienteId');
  next();
}, getInventarioByPaciente);

router.post('/paciente/:pacienteId', (req, res, next) => {
  parseId(req.params.pacienteId, 'pacienteId');
  const result = upsertInventarioSchema.safeParse(req.body);
  if (!result.success) {
    const msg = result.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(' | ');
    throw new AppError(400, `Datos inválidos: ${msg}`);
  }
  req.body = result.data;
  next();
}, upsertInventario);

export default router;
