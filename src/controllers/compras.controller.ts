import { Request, Response } from 'express';
import { prisma } from '../utils/prisma';
import { AppError } from '../middlewares/errorHandler';

// ============================================================
// COMPRAS Y REQUISICIONES
// ============================================================

export const createRequisicion = async (req: Request, res: Response) => {
  const { areaSolicitante, descripcion, justificacion, presupuestoEstimado } = req.body;
  const usuarioId = req.usuario!.id;

  // Generar un folio simple
  const count = await prisma.compraRequisicion.count();
  const folio = `REQ-${new Date().getFullYear()}-${(count + 1).toString().padStart(4, '0')}`;

  const requisicion = await prisma.compraRequisicion.create({
    data: {
      folio,
      usuarioId,
      areaSolicitante,
      descripcion,
      justificacion,
      presupuestoEstimado: parseFloat(presupuestoEstimado) || 0,
      estado: 'BORRADOR'
    }
  });

  res.status(201).json({ success: true, data: requisicion });
};

export const getRequisiciones = async (req: Request, res: Response) => {
  const requisiciones = await prisma.compraRequisicion.findMany({
    include: {
      usuario: { select: { nombre: true, apellidos: true } },
      cotizaciones: true,
      ordenCompra: true
    },
    orderBy: { createdAt: 'desc' }
  });
  
  res.json({ success: true, data: requisiciones });
};

export const updateRequisicionEstado = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { estado, observacionesVoBo } = req.body;
  const usuarioId = req.usuario!.id; // El usuario que autoriza o cambia estado

  const reqExistente = await prisma.compraRequisicion.findUnique({ where: { id: parseInt(id as string, 10) } });
  if (!reqExistente) throw new AppError(404, 'Requisición no encontrada');

  const updateData: any = { estado };

  if (estado === 'AUTORIZADO' || estado === 'RECHAZADO') {
    updateData.usuarioAutorizaId = usuarioId;
    updateData.observacionesVoBo = observacionesVoBo;
    updateData.fechaAutorizacion = new Date();
  }

  const requisicion = await prisma.compraRequisicion.update({
    where: { id: parseInt(id as string, 10) },
    data: updateData,
    include: { cotizaciones: true, ordenCompra: true }
  });

  res.json({ success: true, data: requisicion });
};

// ============================================================
// COTIZACIONES Y ORDENES
// ============================================================

export const addCotizacion = async (req: Request, res: Response) => {
  const { requisicionId } = req.params;
  const { proveedor, precio, tiempoEntrega, esMejorOpcion } = req.body;

  const cotizacion = await prisma.compraCotizacion.create({
    data: {
      requisicionId: parseInt(requisicionId as string, 10),
      proveedor,
      precio: parseFloat(precio),
      tiempoEntrega,
      esMejorOpcion: esMejorOpcion || false
    }
  });

  // Si se detecta primer cotización o similar, podemos cambiar estado de requisa automáticamente
  await prisma.compraRequisicion.update({
    where: { id: parseInt(requisicionId as string, 10) },
    data: { estado: 'EN_COMPARATIVO' }
  });

  res.status(201).json({ success: true, data: cotizacion });
};

export const generarOrden = async (req: Request, res: Response) => {
  const { requisicionId } = req.params;
  const { proveedor, total } = req.body;

  const requisicion = await prisma.compraRequisicion.findUnique({ where: { id: parseInt(requisicionId as string, 10) } });
  if (!requisicion) throw new AppError(404, 'Requisición no encontrada');
  if (requisicion.estado !== 'AUTORIZADO') throw new AppError(400, 'Solo se generan ordenes de requisiciones autorizadas.');

  const orden = await prisma.compraOrden.create({
    data: {
      requisicionId: parseInt(requisicionId as string, 10),
      proveedor,
      total: parseFloat(total)
    }
  });

  await prisma.compraRequisicion.update({
    where: { id: parseInt(requisicionId as string, 10) },
    data: { estado: 'ORDEN_GENERADA' }
  });

  res.status(201).json({ success: true, data: orden });
};
