import { Request, Response } from 'express';
import { prisma } from '../utils/prisma';
import { AppError } from '../middlewares/errorHandler';
import { EstadoContraRecibo } from '@prisma/client';
import { crearNotificacion } from '../utils/notificaciones';
import { generateFolioContraRecibo } from '../utils/folioGenerators';
import { validarTransicionContraRecibo } from '../utils/stateMachines';
import PDFDocument from 'pdfkit';

// ============================================================
// HELPERS
// ============================================================

const getUsuarioId = (req: Request): number => {
  if (!req.usuario) throw new AppError(401, 'No autenticado');
  return req.usuario.id;
};

const getParamId = (val: string | string[] | undefined, name = 'id'): number => {
  const str = Array.isArray(val) ? val[0] : val;
  const n   = parseInt(str as string, 10);
  if (!str || isNaN(n) || n <= 0) throw new AppError(400, `${name} inválido`);
  return n;
};

const INCLUDE_CR = {
  movimiento: {
    include: {
      producto: { select: { id: true, codigo: true, nombre: true, unidad: true } },
      usuario:  { select: { id: true, nombre: true, apellidos: true } },
    },
  },
  proveedor: {
    select: { id: true, nombre: true, rfc: true, telefono: true, correo: true },
  },
  recibidoPor: {
    select: { id: true, nombre: true, apellidos: true },
  },
} as const;

// ============================================================
// 1. CREAR CONTRA RECIBO
// ============================================================

export const createContraRecibo = async (req: Request, res: Response): Promise<void> => {
  const usuarioId = getUsuarioId(req);
  const { movimientoId, proveedorId, numeroFactura, importe, fechaPagoProgramado } = req.body;

  if (!movimientoId) throw new AppError(400, 'movimientoId es requerido');
  if (!proveedorId)  throw new AppError(400, 'proveedorId es requerido');
  if (!numeroFactura) throw new AppError(400, 'numeroFactura es requerido');

  const importeNum = parseFloat(importe ?? '0');
  if (isNaN(importeNum) || importeNum <= 0) {
    throw new AppError(400, 'importe debe ser mayor a 0');
  }

  const movIdNum  = parseInt(String(movimientoId), 10);
  const provIdNum = parseInt(String(proveedorId), 10);

  // Validar movimiento
  const movimiento = await prisma.almacenMovimiento.findUnique({
    where: { id: movIdNum },
    include: { producto: true },
  });
  if (!movimiento)                                throw new AppError(404, 'Movimiento no encontrado');
  if (movimiento.tipo !== 'ENTRADA')              throw new AppError(400, 'Solo entradas pueden generar contra-recibo');
  if (movimiento.estadoRecepcion !== 'ACEPTADO')  throw new AppError(400, 'La mercancía debe estar aceptada');

  // Validar proveedor
  const proveedor = await prisma.proveedor.findUnique({ where: { id: provIdNum } });
  if (!proveedor) throw new AppError(404, 'Proveedor no encontrado');

  // Evitar duplicado
  const existente = await prisma.contraRecibo.findUnique({ where: { movimientoId: movIdNum } });
  if (existente) throw new AppError(400, 'Este movimiento ya tiene contra-recibo');

  const folio = await generateFolioContraRecibo();

  const contraRecibo = await prisma.contraRecibo.create({
    data: {
      folio,
      movimientoId:  movIdNum,
      proveedorId:   provIdNum,
      numeroFactura,
      importe:       importeNum,
      recibidoPorId: usuarioId,
      estado:        EstadoContraRecibo.PENDIENTE,
      fechaPagoProgramado: fechaPagoProgramado ? new Date(fechaPagoProgramado) : null,
    },
    include: INCLUDE_CR,
  });

  res.status(201).json({ success: true, data: contraRecibo });
};

// ============================================================
// 2. LISTAR CONTRA RECIBOS
// ============================================================

export const getContraRecibos = async (req: Request, res: Response): Promise<void> => {
  const {
    estado,
    proveedorId,
    fechaDesde,
    fechaHasta,
    page  = '1',
    limit = '20',
  } = req.query;

  const where: any = {};
  if (estado)      where.estado      = estado as EstadoContraRecibo;
  if (proveedorId) where.proveedorId = parseInt(proveedorId as string, 10);
  if (fechaDesde || fechaHasta) {
    where.fechaRecepcion = {};
    if (fechaDesde) where.fechaRecepcion.gte = new Date(fechaDesde as string);
    if (fechaHasta) where.fechaRecepcion.lte = new Date(fechaHasta as string);
  }

  const pageNum  = Math.max(1, parseInt(page as string, 10));
  const limitNum = Math.min(100, Math.max(1, parseInt(limit as string, 10)));
  const skip     = (pageNum - 1) * limitNum;

  const [total, contraRecibos] = await Promise.all([
    prisma.contraRecibo.count({ where }),
    prisma.contraRecibo.findMany({
      where,
      include: INCLUDE_CR,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limitNum,
    }),
  ]);

  res.json({
    success: true,
    data: contraRecibos,
    meta: { total, page: pageNum, limit: limitNum, totalPages: Math.ceil(total / limitNum) },
  });
};

// ============================================================
// 3. OBTENER CONTRA RECIBO POR ID
// ============================================================

export const getContraReciboById = async (req: Request, res: Response): Promise<void> => {
  const id = getParamId(req.params.id);

  const contraRecibo = await prisma.contraRecibo.findUnique({
    where: { id },
    include: INCLUDE_CR,
  });

  if (!contraRecibo) throw new AppError(404, 'Contra-recibo no encontrado');

  res.json({ success: true, data: contraRecibo });
};

// ============================================================
// 4. PROGRAMAR PAGO
// ============================================================

export const programarPago = async (req: Request, res: Response): Promise<void> => {
  const id = getParamId(req.params.id);
  const { fechaPagoProgramado } = req.body;

  if (!fechaPagoProgramado) throw new AppError(400, 'fechaPagoProgramado es requerida');

  const fecha = new Date(fechaPagoProgramado);
  if (isNaN(fecha.getTime())) throw new AppError(400, 'Fecha de pago inválida');
  if (fecha < new Date()) throw new AppError(400, 'La fecha de pago no puede ser en el pasado');

  const cr = await prisma.contraRecibo.findUnique({ where: { id } });
  if (!cr) throw new AppError(404, 'Contra-recibo no encontrado');
  if (cr.estado === EstadoContraRecibo.CANCELADO) {
    throw new AppError(400, 'No se puede programar pago en un contra-recibo cancelado');
  }

  const actualizado = await prisma.contraRecibo.update({
    where: { id },
    data:  { fechaPagoProgramado: fecha },
    include: INCLUDE_CR,
  });

  res.json({ success: true, data: actualizado });
};

// ============================================================
// 5. MARCAR PAGADO
// ============================================================

export const marcarPagado = async (req: Request, res: Response): Promise<void> => {
  const usuarioId = getUsuarioId(req);
  const id        = getParamId(req.params.id);

  const cr = await prisma.contraRecibo.findUnique({ where: { id } });
  if (!cr) throw new AppError(404, 'Contra-recibo no encontrado');

  validarTransicionContraRecibo(cr.estado, EstadoContraRecibo.PAGADO);

  const actualizado = await prisma.contraRecibo.update({
    where: { id },
    data:  { estado: EstadoContraRecibo.PAGADO },
    include: INCLUDE_CR,
  });

  await crearNotificacion({
    titulo: 'Pago Registrado',
    mensaje: `Contra-recibo ${cr.folio} marcado como pagado.`,
    tipo: 'EXITO',
    rol: 'ALMACEN',
    link: `/contra-recibos/${id}`,
  });

  res.json({ success: true, data: actualizado });
};

// ============================================================
// 6. CANCELAR CONTRA RECIBO
// ============================================================

export const cancelarContraRecibo = async (req: Request, res: Response): Promise<void> => {
  const id      = getParamId(req.params.id);
  const { motivo } = req.body;

  if (!motivo) throw new AppError(400, 'motivo es requerido para cancelar');

  const cr = await prisma.contraRecibo.findUnique({ where: { id } });
  if (!cr) throw new AppError(404, 'Contra-recibo no encontrado');

  validarTransicionContraRecibo(cr.estado, EstadoContraRecibo.CANCELADO);

  const actualizado = await prisma.contraRecibo.update({
    where: { id },
    data:  { estado: EstadoContraRecibo.CANCELADO },
    include: INCLUDE_CR,
  });

  res.json({ success: true, data: actualizado, message: `Cancelado. Motivo: ${motivo}` });
};

// ============================================================
// CAMBIAR ESTADO (genérico — backward compat)
// ============================================================

export const updateEstadoContraRecibo = async (req: Request, res: Response): Promise<void> => {
  const id     = getParamId(req.params.id);
  const { estado, motivo } = req.body;

  const estadoEnum = estado as EstadoContraRecibo;
  if (!Object.values(EstadoContraRecibo).includes(estadoEnum)) {
    throw new AppError(400, 'Estado inválido');
  }

  const cr = await prisma.contraRecibo.findUnique({ where: { id } });
  if (!cr) throw new AppError(404, 'Contra-recibo no encontrado');

  validarTransicionContraRecibo(cr.estado, estadoEnum);

  if (estadoEnum === EstadoContraRecibo.CANCELADO && !motivo) {
    throw new AppError(400, 'motivo es requerido para cancelar');
  }

  const actualizado = await prisma.contraRecibo.update({
    where: { id },
    data:  { estado: estadoEnum },
    include: INCLUDE_CR,
  });

  res.json({ success: true, data: actualizado });
};

// ============================================================
// 7. GENERAR PDF
// ============================================================

export const generateContraReciboPDF = async (req: Request, res: Response): Promise<void> => {
  const id = getParamId(req.params.id);

  const cr = await prisma.contraRecibo.findUnique({
    where: { id },
    include: {
      movimiento: { include: { producto: true } },
      proveedor:  true,
      recibidoPor: true,
    },
  });

  if (!cr) throw new AppError(404, 'Contra-recibo no encontrado');

  const doc      = new PDFDocument({ size: 'LETTER', margin: 50 });
  const fileName = `contra-recibo-${cr.folio}.pdf`;

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="${fileName}"`);
  doc.pipe(res);

  // ── Encabezado ────────────────────────────────────────────
  doc.fontSize(18).text('INSTITUTO MARAKAME', { align: 'center' });
  doc.fontSize(10).text('RFC: MAR000123ABC', { align: 'center' });
  doc.moveDown(2);

  // ── Título ────────────────────────────────────────────────
  doc.fontSize(20).text('CONTRA RECIBO', { align: 'left' });
  doc.moveDown();

  // ── Folio ─────────────────────────────────────────────────
  doc.fontSize(14).text(`Folio: ${cr.folio}`, { align: 'right' });
  doc.moveDown(2);

  // ── Datos ─────────────────────────────────────────────────
  doc.fontSize(12);
  doc.text(`Proveedor:    ${cr.proveedor.nombre}`);
  doc.moveDown(0.5);
  doc.text(`RFC:          ${cr.proveedor.rfc ?? 'N/A'}`);
  doc.moveDown(0.5);
  doc.text(`Factura:      ${cr.numeroFactura}`);
  doc.moveDown(0.5);
  doc.text(`Producto:     ${cr.movimiento.producto.nombre}`);
  doc.moveDown(0.5);
  doc.text(`Cantidad:     ${cr.movimiento.cantidad} ${cr.movimiento.producto.unidad}`);
  doc.moveDown(0.5);
  doc.text(`Importe:      $${Number(cr.importe).toFixed(2)}`);
  doc.moveDown(0.5);
  doc.text(`Fecha recepción: ${cr.fechaRecepcion.toLocaleDateString('es-MX')}`);

  if (cr.fechaPagoProgramado) {
    doc.moveDown(0.5);
    doc.text(`Pago programado: ${cr.fechaPagoProgramado.toLocaleDateString('es-MX')}`);
  }

  doc.moveDown(0.5);
  doc.text(`Estado: ${cr.estado}`);
  doc.moveDown(4);

  // ── Texto legal ───────────────────────────────────────────
  doc.fontSize(9).text(
    'Este contra-recibo se emite exclusivamente para efectos de control interno.',
    { align: 'justify' },
  );
  doc.moveDown(5);

  // ── Firma ─────────────────────────────────────────────────
  doc.text('__________________________________', { align: 'right' });
  doc.text(
    `${cr.recibidoPor.nombre} ${cr.recibidoPor.apellidos}`,
    { align: 'right' },
  );
  doc.text('Nombre y firma de quien recibe', { align: 'right' });

  doc.end();
};

// ============================================================
// 8. DASHBOARD FINANCIERO
// ============================================================

export const dashboardContraRecibos = async (_req: Request, res: Response): Promise<void> => {
  const hoy   = new Date();
  hoy.setHours(0, 0, 0, 0);
  const en7d  = new Date(hoy);
  en7d.setDate(en7d.getDate() + 7);

  const [
    pendientes,
    pagados,
    cancelados,
    vencidos,
    proximosPagar,
    totalAdeudoData,
  ] = await Promise.all([
    prisma.contraRecibo.count({ where: { estado: EstadoContraRecibo.PENDIENTE } }),
    prisma.contraRecibo.count({ where: { estado: EstadoContraRecibo.PAGADO } }),
    prisma.contraRecibo.count({ where: { estado: EstadoContraRecibo.CANCELADO } }),
    prisma.contraRecibo.count({
      where: {
        estado: EstadoContraRecibo.PENDIENTE,
        fechaPagoProgramado: { lt: hoy },
      },
    }),
    prisma.contraRecibo.count({
      where: {
        estado: EstadoContraRecibo.PENDIENTE,
        fechaPagoProgramado: { gte: hoy, lte: en7d },
      },
    }),
    prisma.contraRecibo.aggregate({
      where:  { estado: EstadoContraRecibo.PENDIENTE },
      _sum:   { importe: true },
    }),
  ]);

  const listaVencidos = await prisma.contraRecibo.findMany({
    where: {
      estado: EstadoContraRecibo.PENDIENTE,
      fechaPagoProgramado: { lt: hoy },
    },
    include: {
      proveedor:  { select: { id: true, nombre: true } },
      recibidoPor: { select: { nombre: true, apellidos: true } },
    },
    orderBy: { fechaPagoProgramado: 'asc' },
    take: 10,
  });

  const listaProximos = await prisma.contraRecibo.findMany({
    where: {
      estado: EstadoContraRecibo.PENDIENTE,
      fechaPagoProgramado: { gte: hoy, lte: en7d },
    },
    include: {
      proveedor: { select: { id: true, nombre: true } },
    },
    orderBy: { fechaPagoProgramado: 'asc' },
    take: 10,
  });

  res.json({
    success: true,
    data: {
      resumen: {
        pendientes,
        pagados,
        cancelados,
        vencidos,
        proximosPagar,
        totalAdeudo: totalAdeudoData._sum.importe ?? 0,
      },
      listaVencidos,
      listaProximos,
    },
  });
};
