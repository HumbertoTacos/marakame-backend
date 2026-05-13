import { Request, Response } from 'express';
import { prisma } from '../utils/prisma';
import { generateFolioRequisicion, generateFolioCompra } from '../utils/folioGenerators';
import { AppError } from '../middlewares/errorHandler';
import { EstadoCompra, EstadoRequisicion } from '@prisma/client';

interface DetalleInput {
  productoNombre?: string;
  unidadLibre?: string;
  cantidadSolicitada?: number | string;
  observaciones?: string;
}

export const createRequisicion = async (req: Request, res: Response) => {
  const usuario = req.usuario;
  if (!usuario) throw new AppError(401, 'No autenticado');

  const { areaSolicitante, justificacion, descripcion, detalles } = req.body as {
    areaSolicitante?: string;
    justificacion?: string;
    descripcion?: string;
    detalles?: DetalleInput[];
  };

  if (!areaSolicitante?.trim()) throw new AppError(400, 'El área solicitante es requerida');
  if (!justificacion?.trim()) throw new AppError(400, 'La justificación es requerida');
  if (!detalles || !Array.isArray(detalles) || detalles.length === 0) {
    throw new AppError(400, 'Debe incluir al menos un artículo');
  }

  const folio = await generateFolioRequisicion();

  const requisicion = await prisma.requisicion.create({
    data: {
      folio,
      areaSolicitante: areaSolicitante.trim(),
      justificacion: justificacion.trim(),
      descripcion: descripcion?.trim() ?? null,
      usuarioSolicitaId: usuario.id,
      detalles: {
        create: detalles.map((d, i) => ({
          productoNombre: d.productoNombre?.trim() ?? null,
          unidadLibre: d.unidadLibre?.trim() ?? null,
          cantidadSolicitada: Number(d.cantidadSolicitada) || 0,
          observaciones: d.observaciones?.trim() ?? null,
          numero: i + 1,
        })),
      },
    },
    include: {
      detalles: true,
      usuarioSolicita: { select: { id: true, nombre: true, apellidos: true } },
    },
  });

  return res.status(201).json({ success: true, data: requisicion });
};

export const getRequisiciones = async (req: Request, res: Response) => {
  const { estado, q, page = '1', limit = '50' } = req.query;

  const where: Record<string, unknown> = {};
  if (estado) where.estado = estado;
  if (q) {
    where.OR = [
      { folio: { contains: q as string, mode: 'insensitive' } },
      { areaSolicitante: { contains: q as string, mode: 'insensitive' } },
      { descripcion: { contains: q as string, mode: 'insensitive' } },
      { justificacion: { contains: q as string, mode: 'insensitive' } },
    ];
  }

  const pageNum = Math.max(1, parseInt(page as string, 10));
  const limitNum = Math.min(100, Math.max(1, parseInt(limit as string, 10)));

  const [total, items] = await Promise.all([
    prisma.requisicion.count({ where }),
    prisma.requisicion.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (pageNum - 1) * limitNum,
      take: limitNum,
      include: {
        usuarioSolicita: { select: { id: true, nombre: true, apellidos: true } },
        detalles: true,
      },
    }),
  ]);

  return res.json({
    success: true,
    data: items,
    meta: { total, page: pageNum, limit: limitNum, pages: Math.ceil(total / limitNum) },
  });
};

export const getRequisicionById = async (req: Request, res: Response) => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  if (isNaN(id)) throw new AppError(400, 'ID inválido');

  const requisicion = await prisma.requisicion.findUnique({
    where: { id },
    include: {
      usuarioSolicita: { select: { id: true, nombre: true, apellidos: true } },
      detalles: true,
      historial: {
        orderBy: { id: 'desc' },
        include: { usuario: { select: { nombre: true, apellidos: true } } },
      },
    },
  });

  if (!requisicion) throw new AppError(404, 'Requisición no encontrada');

  return res.json({ success: true, data: requisicion });
};

export const enviarACompras = async (req: Request, res: Response) => {
  const usuario = req.usuario;
  if (!usuario) throw new AppError(401, 'No autenticado');

  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  if (isNaN(id)) throw new AppError(400, 'ID inválido');

  const requisicion = await prisma.requisicion.findUnique({
    where: { id },
    include: { detalles: { include: { producto: true } } },
  });
  if (!requisicion) throw new AppError(404, 'Requisición no encontrada');

  const yaEnviada = await prisma.compraRequisicion.findUnique({
    where: { requisicionId: id },
  });
  if (yaEnviada) throw new AppError(400, 'Esta requisición ya fue enviada a compras');

  const folio = await generateFolioCompra();

  const compra = await prisma.$transaction(async (tx) => {
    const nueva = await tx.compraRequisicion.create({
      data: {
        folio,
        requisicionId: id,
        usuarioId: usuario.id,
        tipo: 'ORDINARIA',
        estado: EstadoCompra.EN_COMPRAS,
        detalles: {
          create: requisicion.detalles
            .filter(d => d.productoId !== null && d.producto !== null)
            .map((d, i) => ({
              numero:    i + 1,
              productoId: d.productoId!,
              unidad:    d.producto!.unidad,
              cantidad:  d.cantidadSolicitada,
            })),
        },
      },
    });

    await tx.requisicion.update({
      where: { id },
      data: { estado: EstadoRequisicion.ENVIADA_A_COMPRAS },
    });

    return nueva;
  });

  return res.json({ success: true, data: compra });
};
