import { Router, Request, Response } from 'express';
import { authenticate } from '../middlewares/auth';
import { prisma } from '../utils/prisma';
import { AppError } from '../middlewares/errorHandler';

const router = Router();

router.use(authenticate);

// Crear expediente vacio (al ingresar paciente)
router.post('/', async (req: Request, res: Response) => {
  const { pacienteId } = req.body;
  const expediente = await prisma.expediente.create({
    data: {
      pacienteId: parseInt(pacienteId as string, 10)
    }
  });
  res.status(201).json({ success: true, data: expediente });
});

// Obtener expediente por ID paciente con carga profunda de datos clínicos
router.get('/paciente/:pacienteId', async (req: Request, res: Response) => {
  const { pacienteId } = req.params;
  const expediente = await prisma.expediente.findUnique({
    where: { pacienteId: parseInt(pacienteId as string, 10) },
    include: { 
      paciente: true,
      notasEvolucion: {
        include: { usuario: true },
        orderBy: { fecha: 'desc' }
      },
      signosVitales: {
        include: { usuario: true },
        orderBy: { fecha: 'desc' }
      },
      tratamientos: {
        include: { medico: true },
        where: { activo: true }
      }
    }
  });

  if (!expediente) {
    throw new AppError(404, 'Expediente no encontrado');
  }

  res.json({ success: true, data: expediente });
});

// Update expediente (metadatos básicos y nutrición)
router.put('/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  const data = req.body;

  const expediente = await prisma.expediente.update({
    where: { id: parseInt(id as string, 10) },
    data: {
      diagnosticoPrincipal: data.diagnosticoPrincipal,
      diagnosticoSecundario: data.diagnosticoSecundario,
      cuotaAsignada: data.cuotaAsignada,
      saldoPendiente: data.saldoPendiente,
      indiceBMI: data.indiceBMI,
    }
  });

  res.json({ success: true, data: expediente });
});

// NUEVOS ENDPOINTS CLÍNICOS DEDICADOS

// 1. Agregar Signos Vitales
router.post('/:id/signos', async (req: Request, res: Response) => {
  const { id } = req.params;
  const { usuarioId, ...signos } = req.body;

  const nuevoSigno = await prisma.signoVital.create({
    data: {
      expedienteId: parseInt(id as string, 10),
      usuarioId,
      ...signos,
    }
  });

  res.status(201).json({ success: true, data: nuevoSigno });
});

// 2. Agregar Nota de Evolución
router.post('/:id/notas', async (req: Request, res: Response) => {
  const { id } = req.params;
  const { usuarioId, tipo, nota } = req.body;

  const nuevaNota = await prisma.notaEvolucion.create({
    data: {
      expedienteId: parseInt(id as string, 10),
      usuarioId,
      tipo,
      nota,
    }
  });

  res.status(201).json({ success: true, data: nuevaNota });
});

export default router;
