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

// ── Importe a letras (español, pesos mexicanos) ──────────────

const _UNIDADES = ['', 'UN', 'DOS', 'TRES', 'CUATRO', 'CINCO', 'SEIS', 'SIETE', 'OCHO', 'NUEVE',
  'DIEZ', 'ONCE', 'DOCE', 'TRECE', 'CATORCE', 'QUINCE', 'DIECISÉIS', 'DIECISIETE', 'DIECIOCHO', 'DIECINUEVE'];
const _DECENAS  = ['', 'DIEZ', 'VEINTE', 'TREINTA', 'CUARENTA', 'CINCUENTA', 'SESENTA', 'SETENTA', 'OCHENTA', 'NOVENTA'];
const _CENTENAS = ['', 'CIENTO', 'DOSCIENTOS', 'TRESCIENTOS', 'CUATROCIENTOS', 'QUINIENTOS',
  'SEISCIENTOS', 'SETECIENTOS', 'OCHOCIENTOS', 'NOVECIENTOS'];

function _enLetras(n: number): string {
  if (n === 0)   return 'CERO';
  if (n === 100) return 'CIEN';

  let r = '';

  if (n >= 1_000_000) {
    const m = Math.floor(n / 1_000_000);
    r += m === 1 ? 'UN MILLÓN ' : `${_enLetras(m)} MILLONES `;
    n %= 1_000_000;
  }
  if (n >= 1_000) {
    const k = Math.floor(n / 1_000);
    r += k === 1 ? 'MIL ' : `${_enLetras(k)} MIL `;
    n %= 1_000;
  }
  if (n >= 100) {
    r += _CENTENAS[Math.floor(n / 100)] + ' ';
    n %= 100;
  }
  if (n >= 20) {
    const d = Math.floor(n / 10);
    const u = n % 10;
    if (n === 20)      r += 'VEINTE ';
    else if (n < 30)   r += `VEINTI${_UNIDADES[u]} `;
    else               r += _DECENAS[d] + (u > 0 ? ` Y ${_UNIDADES[u]} ` : ' ');
    n = 0;
  } else if (n > 0) {
    r += _UNIDADES[n] + ' ';
  }

  return r.trim();
}

function importeALetras(cantidad: number): string {
  const abs       = Math.round(Math.abs(cantidad) * 100);
  const pesos     = Math.floor(abs / 100);
  const centavos  = abs % 100;
  const letras    = pesos === 0 ? 'CERO' : _enLetras(pesos);
  const centsStr  = centavos.toString().padStart(2, '0');
  return `${letras} PESOS ${centsStr}/100 M.N.`;
}

// ── Fecha larga en español ────────────────────────────────────

const _MESES = ['ENERO','FEBRERO','MARZO','ABRIL','MAYO','JUNIO',
                'JULIO','AGOSTO','SEPTIEMBRE','OCTUBRE','NOVIEMBRE','DICIEMBRE'];

function fechaLarga(d: Date): string {
  return `${d.getDate()} DE ${_MESES[d.getMonth()]} DE ${d.getFullYear()}`;
}

// ============================================================
// 1. CREAR CONTRA RECIBO
// ============================================================

export const createContraRecibo = async (req: Request, res: Response): Promise<void> => {
  const usuarioId = getUsuarioId(req);
  const { movimientoId, fechaPagoProgramado } = req.body;

  if (!movimientoId) throw new AppError(400, 'movimientoId es requerido');

  const movIdNum = parseInt(String(movimientoId), 10);

  const movimiento = await prisma.almacenMovimiento.findUnique({
    where: { id: movIdNum },
    include: { producto: true },
  });
  if (!movimiento)                                throw new AppError(404, 'Movimiento no encontrado');
  if (movimiento.tipo !== 'ENTRADA')              throw new AppError(400, 'Solo entradas pueden generar contra-recibo');
  if (movimiento.estadoRecepcion !== 'ACEPTADO')  throw new AppError(400, 'La mercancía debe estar aceptada');

  const existente = await prisma.contraRecibo.findUnique({ where: { movimientoId: movIdNum } });
  if (existente) throw new AppError(400, 'Este movimiento ya tiene contra-recibo');

  if (!movimiento.proveedor)     throw new AppError(400, 'El movimiento no tiene proveedor registrado. Regístralo primero.');
  if (!movimiento.numeroFactura) throw new AppError(400, 'El movimiento no tiene número de factura registrado.');
  if (!movimiento.importeFactura || Number(movimiento.importeFactura) <= 0)
    throw new AppError(400, 'El movimiento no tiene importe de factura válido.');

  const folio = await generateFolioContraRecibo();

  // Intentar encontrar el proveedor en catálogo por nombre (opcional, no bloqueante)
  const proveedorNombre = movimiento.proveedor.split(',')[0].trim();
  const proveedorCatalogo = await prisma.proveedor.findFirst({
    where: { nombre: { contains: proveedorNombre, mode: 'insensitive' } },
  });

  const data: any = {
    folio,
    movimientoId:  movIdNum,
    proveedorNombre: movimiento.proveedor,
    numeroFactura:   movimiento.numeroFactura,
    importe:         Number(movimiento.importeFactura),
    recibidoPorId:   usuarioId,
    estado:          EstadoContraRecibo.PENDIENTE,
    fechaPagoProgramado: fechaPagoProgramado ? new Date(fechaPagoProgramado) : null,
  };

  if (proveedorCatalogo) data.proveedorId = proveedorCatalogo.id;

  const contraRecibo = await prisma.contraRecibo.create({ data, include: INCLUDE_CR });

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

  const cr = await prisma.contraRecibo.findUnique({ where: { id } });
  if (!cr) throw new AppError(404, 'Contra-recibo no encontrado');
  if (cr.estado === EstadoContraRecibo.CANCELADO)
    throw new AppError(400, 'No se puede programar pago en un contra-recibo cancelado');

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
// CAMBIAR ESTADO (genérico)
// ============================================================

export const updateEstadoContraRecibo = async (req: Request, res: Response): Promise<void> => {
  const id     = getParamId(req.params.id);
  const { estado, motivo } = req.body;

  const estadoEnum = estado as EstadoContraRecibo;
  if (!Object.values(EstadoContraRecibo).includes(estadoEnum))
    throw new AppError(400, 'Estado inválido');

  const cr = await prisma.contraRecibo.findUnique({ where: { id } });
  if (!cr) throw new AppError(404, 'Contra-recibo no encontrado');

  validarTransicionContraRecibo(cr.estado, estadoEnum);

  if (estadoEnum === EstadoContraRecibo.CANCELADO && !motivo)
    throw new AppError(400, 'motivo es requerido para cancelar');

  const actualizado = await prisma.contraRecibo.update({
    where: { id },
    data:  { estado: estadoEnum },
    include: INCLUDE_CR,
  });

  res.json({ success: true, data: actualizado });
};

// ============================================================
// 7. GENERAR PDF — formato oficial
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
  }) as any;

  if (!cr) throw new AppError(404, 'Contra-recibo no encontrado');

  const provNombre: string = cr.proveedorNombre ?? cr.proveedor?.nombre ?? 'N/D';
  const numFactura: string = cr.numeroFactura   ?? 'N/D';
  const importe: number   = Number(cr.importe)  ?? 0;
  const importeStr  = `$${importe.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const importeLetr = importeALetras(importe);
  const fechaRec    = cr.fechaRecepcion   ? fechaLarga(new Date(cr.fechaRecepcion))   : '___';
  const fechaPago   = cr.fechaPagoProgramado ? fechaLarga(new Date(cr.fechaPagoProgramado)) : '___';
  const receptor    = `${cr.recibidoPor.nombre} ${cr.recibidoPor.apellidos}`;

  const doc      = new PDFDocument({ size: 'LETTER', margin: 56 });
  const fileName = `contra-recibo-${cr.folio}.pdf`;

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="${fileName}"`);
  doc.pipe(res);

  const L = 56;   // left margin
  const R = 556;  // right edge (612 - 56)
  const W = R - L; // content width = 500

  // ── Título + Folio ────────────────────────────────────────
  doc.fontSize(22).font('Helvetica-Bold')
     .text('CONTRA RECIBO', L, 56, { align: 'center', width: W });

  doc.fontSize(10).font('Helvetica')
     .text(`Folio: ${cr.folio}`, L, 56, { align: 'right', width: W });

  doc.moveDown(0.8);

  // ── Línea separadora ──────────────────────────────────────
  const y1 = doc.y;
  doc.moveTo(L, y1).lineTo(R, y1).lineWidth(1.5).stroke();
  doc.moveDown(0.8);

  // ── "Recibimos de" ────────────────────────────────────────
  const yRec = doc.y;
  doc.fontSize(11).font('Helvetica-Bold').text('Recibimos de:', L, yRec);
  doc.font('Helvetica').text(provNombre, L + 95, yRec);

  // línea punteada bajo el nombre
  const yUnder = yRec + 14;
  doc.moveTo(L + 95, yUnder).lineTo(R, yUnder).lineWidth(0.5).dash(2, { space: 2 }).stroke().undash();

  doc.moveDown(1.4);

  // ── Texto introductorio ───────────────────────────────────
  doc.fontSize(10).font('Helvetica')
     .text('Para su revisión y pago las Facturas y otros documentos que a continuación se indican:', { align: 'left' });

  doc.moveDown(0.8);

  // ── Tabla No. / Importe ───────────────────────────────────
  const colNo  = L;
  const colImp = L + 310;
  const rowH   = 22;
  const tblW   = W;

  // Encabezado tabla
  const yTh = doc.y;
  doc.rect(colNo, yTh, tblW, rowH).fillAndStroke('#1E3A8A', '#1E3A8A');
  doc.fillColor('white').fontSize(10).font('Helvetica-Bold')
     .text('No.', colNo + 6, yTh + 6, { width: 290 })
     .text('Importe $', colImp + 6, yTh + 6, { width: 170, align: 'right' });

  doc.fillColor('black');

  // Fila de datos
  const yRow = yTh + rowH;
  doc.rect(colNo, yRow, tblW, rowH).stroke('#CCCCCC');
  doc.moveTo(colImp, yRow).lineTo(colImp, yRow + rowH).stroke('#CCCCCC');
  doc.fontSize(10).font('Helvetica')
     .text(numFactura, colNo + 6, yRow + 6, { width: 290 })
     .text(importeStr, colImp + 6, yRow + 6, { width: 170, align: 'right' });

  // Total (misma fila de suma, separador)
  const yTot = yRow + rowH;
  doc.rect(colNo, yTot, tblW, rowH).fillAndStroke('#F1F5F9', '#CCCCCC');
  doc.moveTo(colImp, yTot).lineTo(colImp, yTot + rowH).stroke('#CCCCCC');
  doc.fillColor('#111827').fontSize(10).font('Helvetica-Bold')
     .text('TOTAL', colNo + 6, yTot + 6, { width: 290 })
     .text(importeStr, colImp + 6, yTot + 6, { width: 170, align: 'right' });

  doc.fillColor('black');
  doc.y = yTot + rowH + 10;

  // ── Importe con letra ────────────────────────────────────
  doc.moveDown(0.4);
  doc.fontSize(10).font('Helvetica-Bold').text('Importe con letra: ', { continued: true })
     .font('Helvetica').text(importeLetr);

  doc.moveDown(1.2);

  // ── Texto legal ───────────────────────────────────────────
  const yLegal = doc.y;
  const legalText =
    '"El presente contra-recibo se emite exclusivamente para efectos de control interno de Marakame ' +
    'y no constituye un título de crédito, por lo que no será transferible ni negociable y carece de ' +
    'valor en sí mismo, de conformidad con lo dispuesto por el artículo 6° de la Ley General de ' +
    'Títulos y Operaciones de Crédito y 44 del Reglamento de la ley de Presupuesto, Contabilidad ' +
    'y Gasto Público Federal.\n\n' +
    'Tampoco prejuzga sobre la validez o procedencia de obligación de pago alguna, la cual en todo ' +
    'caso quedará sujeta a los términos y condiciones pactados o que deriven del acto que le dio ' +
    'origen o de la regulación específica aplicable al caso concreto."';

  // Medir altura del texto legal
  const legalOpts = { width: W - 20, align: 'justify' as const };
  const legalH = doc.heightOfString(legalText, legalOpts) + 20;

  doc.rect(L, yLegal, W, legalH).fillAndStroke('#F8FAFC', '#D1D5DB');
  doc.fillColor('#374151').fontSize(9).font('Helvetica')
     .text(legalText, L + 10, yLegal + 10, legalOpts);
  doc.fillColor('black');
  doc.y = yLegal + legalH + 10;

  // ── NO NEGOCIABLE ─────────────────────────────────────────
  doc.moveDown(0.6);
  const yNN = doc.y;
  doc.rect(L, yNN, W, 24).fillAndStroke('#1E3A8A', '#1E3A8A');
  doc.fillColor('white').fontSize(12).font('Helvetica-Bold')
     .text('NO NEGOCIABLE', L, yNN + 5, { align: 'center', width: W });
  doc.fillColor('black');
  doc.y = yNN + 24 + 14;

  // ── Fechas ────────────────────────────────────────────────
  doc.fontSize(10).font('Helvetica-Bold').text('Fecha de Recepción: ', { continued: true })
     .font('Helvetica').text(`DIA ${fechaRec}`);

  doc.moveDown(0.5);

  doc.font('Helvetica-Bold').text('Pago Programado: ', { continued: true })
     .font('Helvetica').text(`DIA ${fechaPago}`);

  doc.moveDown(2.5);

  // ── Firma ──────────────────────────────────────────────────
  const firmX = R - 200;
  doc.moveTo(firmX, doc.y).lineTo(R, doc.y).lineWidth(1).stroke();
  doc.moveDown(0.4);
  doc.fontSize(10).font('Helvetica-Bold')
     .text(receptor, firmX, doc.y, { width: 200, align: 'center' });
  doc.moveDown(0.3);
  doc.font('Helvetica').text('Nombre y firma de quien recibe', firmX, doc.y, { width: 200, align: 'center' });

  doc.end();
};

// ============================================================
// 8. DASHBOARD FINANCIERO
// ============================================================

export const dashboardContraRecibos = async (_req: Request, res: Response): Promise<void> => {
  const hoy  = new Date();
  hoy.setHours(0, 0, 0, 0);
  const en7d = new Date(hoy);
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
      where: { estado: EstadoContraRecibo.PENDIENTE, fechaPagoProgramado: { lt: hoy } },
    }),
    prisma.contraRecibo.count({
      where: { estado: EstadoContraRecibo.PENDIENTE, fechaPagoProgramado: { gte: hoy, lte: en7d } },
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
      proveedor:   { select: { id: true, nombre: true } },
      recibidoPor: { select: { nombre: true, apellidos: true } },
    },
    orderBy: { fechaPagoProgramado: 'asc' },
    take: 10,
  }) as any[];

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
  }) as any[];

  // Enrich lists with proveedorNombre fallback
  const enrichCR = (list: any[]) => list.map(cr => ({
    ...cr,
    proveedorDisplay: cr.proveedor?.nombre ?? cr.proveedorNombre ?? 'N/D',
  }));

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
      listaVencidos:  enrichCR(listaVencidos),
      listaProximos:  enrichCR(listaProximos),
    },
  });
};
