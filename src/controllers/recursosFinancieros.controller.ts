import { Request, Response } from 'express';
import { z } from 'zod';
import { EstadoValidacionIngreso, EstadoFacturaMensual, Rol } from '@prisma/client';
import { prisma } from '../utils/prisma';
import { AppError } from '../middlewares/errorHandler';
import { crearNotificacion } from '../utils/notificaciones';

// ════════════════════════════════════════════════════════════════
// Schemas
// ════════════════════════════════════════════════════════════════

const validarSchema = z.object({
  observaciones: z.string().trim().optional(),
});

const observarSchema = z.object({
  observaciones: z.string().trim().min(3, 'Las observaciones son obligatorias'),
});

const depositarSchema = z.object({
  numeroDeposito: z.string().trim().min(1, 'El número de depósito es obligatorio'),
  fechaDeposito: z.coerce.date(),
  fichaDepositoUrl: z.string().trim().optional(),
});

const generarFacturaSchema = z.object({
  mes: z.coerce.number().int().min(1).max(12),
  anio: z.coerce.number().int().min(2020).max(2100),
  observaciones: z.string().trim().optional(),
});

const emitirFacturaSchema = z.object({
  archivoUrl: z.string().trim().min(1, 'La URL del archivo es obligatoria'),
});

// ════════════════════════════════════════════════════════════════
// Helpers
// ════════════════════════════════════════════════════════════════

/** Convierte un número a su representación en letra (pesos MXN). */
function numeroALetras(n: number): string {
  const enteros = Math.floor(n);
  const centavos = Math.round((n - enteros) * 100);
  const letra = enterosALetras(enteros);
  const centavosStr = centavos.toString().padStart(2, '0');
  return `${letra} PESOS ${centavosStr}/100 M.N.`;
}

function enterosALetras(n: number): string {
  if (n === 0) return 'CERO';
  if (n < 0) return `MENOS ${enterosALetras(-n)}`;

  const unidades = ['', 'UN', 'DOS', 'TRES', 'CUATRO', 'CINCO', 'SEIS', 'SIETE', 'OCHO', 'NUEVE'];
  const especiales: Record<number, string> = {
    10: 'DIEZ', 11: 'ONCE', 12: 'DOCE', 13: 'TRECE', 14: 'CATORCE', 15: 'QUINCE',
    20: 'VEINTE', 30: 'TREINTA', 40: 'CUARENTA', 50: 'CINCUENTA',
    60: 'SESENTA', 70: 'SETENTA', 80: 'OCHENTA', 90: 'NOVENTA',
    100: 'CIEN',
  };

  if (n < 10) return unidades[n];
  if (n in especiales) return especiales[n];
  if (n < 20) return `DIECI${unidades[n - 10]}`;
  if (n < 30) return `VEINTI${unidades[n - 20]}`;
  if (n < 100) {
    const d = Math.floor(n / 10) * 10;
    const u = n % 10;
    return u === 0 ? especiales[d] : `${especiales[d]} Y ${unidades[u]}`;
  }
  if (n < 1000) {
    const c = Math.floor(n / 100);
    const resto = n % 100;
    const centenas = ['', 'CIENTO', 'DOSCIENTOS', 'TRESCIENTOS', 'CUATROCIENTOS',
      'QUINIENTOS', 'SEISCIENTOS', 'SETECIENTOS', 'OCHOCIENTOS', 'NOVECIENTOS'];
    const txt = c === 1 && resto === 0 ? 'CIEN' : centenas[c];
    return resto === 0 ? txt : `${txt} ${enterosALetras(resto)}`;
  }
  if (n < 1_000_000) {
    const miles = Math.floor(n / 1000);
    const resto = n % 1000;
    const txt = miles === 1 ? 'MIL' : `${enterosALetras(miles)} MIL`;
    return resto === 0 ? txt : `${txt} ${enterosALetras(resto)}`;
  }
  const millones = Math.floor(n / 1_000_000);
  const resto = n % 1_000_000;
  const txt = millones === 1 ? 'UN MILLON' : `${enterosALetras(millones)} MILLONES`;
  return resto === 0 ? txt : `${txt} ${enterosALetras(resto)}`;
}

const PAGO_SELECT = {
  id: true,
  monto: true,
  fechaPago: true,
  metodoPago: true,
  concepto: true,
  folioRecibo: true,
  estadoValidacion: true,
  observaciones: true,
  numeroDeposito: true,
  fechaDeposito: true,
  fichaDepositoUrl: true,
  fechaValidacion: true,
  facturaMensualId: true,
  paciente: {
    select: {
      id: true,
      claveUnica: true,
      nombre: true,
      apellidoPaterno: true,
      apellidoMaterno: true,
    },
  },
  usuarioRecibe: { select: { id: true, nombre: true, apellidos: true } },
  validadoPor: { select: { id: true, nombre: true, apellidos: true } },
} as const;

// ════════════════════════════════════════════════════════════════
// Bandeja de ingresos
// ════════════════════════════════════════════════════════════════

// GET /recursos-financieros/ingresos
// Lista pagos en efectivo con filtros por estado para la bandeja de R. Financieros.
export const listarIngresos = async (req: Request, res: Response) => {
  const estado = (req.query.estado as string | undefined)?.toUpperCase();
  const where: any = { metodoPago: 'EFECTIVO' };
  if (estado && estado in EstadoValidacionIngreso) {
    where.estadoValidacion = estado;
  }

  const pagos = await prisma.pagoPaciente.findMany({
    where,
    select: PAGO_SELECT,
    orderBy: { fechaPago: 'desc' },
  });

  res.json({ success: true, data: pagos });
};

// GET /recursos-financieros/ingresos/observados
// Para Admisiones: pagos devueltos para corrección, sólo los suyos.
export const listarIngresosObservados = async (req: Request, res: Response) => {
  const usuarioId = req.usuario!.id;
  const esAdmisiones = req.usuario!.rol === 'ADMISIONES';

  const pagos = await prisma.pagoPaciente.findMany({
    where: {
      estadoValidacion: 'OBSERVADO',
      ...(esAdmisiones ? { usuarioRecibeId: usuarioId } : {}),
    },
    select: PAGO_SELECT,
    orderBy: { fechaPago: 'desc' },
  });

  res.json({ success: true, data: pagos });
};

// POST /recursos-financieros/ingresos/:pagoId/validar
// El monto y el folio cuadraron: marca el ingreso como VALIDADO.
export const validarIngreso = async (req: Request, res: Response) => {
  const pagoId = parseInt(req.params.pagoId as string);
  const body = validarSchema.parse(req.body);
  const validadoPorId = req.usuario!.id;

  const pago = await prisma.pagoPaciente.findUniqueOrThrow({
    where: { id: pagoId },
    select: { id: true, estadoValidacion: true, usuarioRecibeId: true, monto: true, folioRecibo: true },
  });

  if (pago.estadoValidacion !== 'PENDIENTE_VALIDACION' && pago.estadoValidacion !== 'OBSERVADO') {
    throw new AppError(400, `El ingreso ya fue procesado (estado: ${pago.estadoValidacion}).`);
  }

  const actualizado = await prisma.pagoPaciente.update({
    where: { id: pagoId },
    data: {
      estadoValidacion: EstadoValidacionIngreso.VALIDADO,
      validadoPorId,
      fechaValidacion: new Date(),
      observaciones: body.observaciones ?? null,
    },
    select: PAGO_SELECT,
  });

  await crearNotificacion({
    titulo: 'Ingreso validado',
    mensaje: `El pago folio ${pago.folioRecibo} fue validado por Recursos Financieros.`,
    tipo: 'EXITO',
    usuarioId: pago.usuarioRecibeId,
    link: '/admisiones/pagos',
  });

  res.json({ success: true, data: actualizado });
};

// POST /recursos-financieros/ingresos/:pagoId/observar
// El monto NO cuadra con el recibo: regresa a Admisiones con observaciones.
export const observarIngreso = async (req: Request, res: Response) => {
  const pagoId = parseInt(req.params.pagoId as string);
  const body = observarSchema.parse(req.body);
  const validadoPorId = req.usuario!.id;

  const pago = await prisma.pagoPaciente.findUniqueOrThrow({
    where: { id: pagoId },
    select: { id: true, estadoValidacion: true, usuarioRecibeId: true, folioRecibo: true },
  });

  if (pago.estadoValidacion !== 'PENDIENTE_VALIDACION') {
    throw new AppError(400, `Sólo se pueden observar ingresos pendientes (estado actual: ${pago.estadoValidacion}).`);
  }

  const actualizado = await prisma.pagoPaciente.update({
    where: { id: pagoId },
    data: {
      estadoValidacion: EstadoValidacionIngreso.OBSERVADO,
      validadoPorId,
      fechaValidacion: new Date(),
      observaciones: body.observaciones,
    },
    select: PAGO_SELECT,
  });

  await crearNotificacion({
    titulo: 'Ingreso devuelto para corrección',
    mensaje: `El pago folio ${pago.folioRecibo} fue devuelto: ${body.observaciones}`,
    tipo: 'ALERTA',
    usuarioId: pago.usuarioRecibeId,
    link: '/admisiones/pagos-observados',
  });

  res.json({ success: true, data: actualizado });
};

// POST /recursos-financieros/ingresos/:pagoId/depositar
// Registra el depósito bancario del ingreso ya validado.
export const depositarIngreso = async (req: Request, res: Response) => {
  const pagoId = parseInt(req.params.pagoId as string);
  const body = depositarSchema.parse(req.body);

  const pago = await prisma.pagoPaciente.findUniqueOrThrow({
    where: { id: pagoId },
    select: { id: true, estadoValidacion: true },
  });

  if (pago.estadoValidacion !== 'VALIDADO') {
    throw new AppError(400, `Sólo se pueden depositar ingresos validados (estado actual: ${pago.estadoValidacion}).`);
  }

  const actualizado = await prisma.pagoPaciente.update({
    where: { id: pagoId },
    data: {
      estadoValidacion: EstadoValidacionIngreso.DEPOSITADO,
      numeroDeposito: body.numeroDeposito,
      fechaDeposito: body.fechaDeposito,
      fichaDepositoUrl: body.fichaDepositoUrl ?? null,
    },
    select: PAGO_SELECT,
  });

  res.json({ success: true, data: actualizado });
};

// POST /recursos-financieros/ingresos/:pagoId/reenviar
// Admisiones reenvía un pago OBSERVADO ya corregido para nueva validación.
export const reenviarIngreso = async (req: Request, res: Response) => {
  const pagoId = parseInt(req.params.pagoId as string);
  const usuarioId = req.usuario!.id;

  const pago = await prisma.pagoPaciente.findUniqueOrThrow({
    where: { id: pagoId },
    select: { id: true, estadoValidacion: true, usuarioRecibeId: true, folioRecibo: true, monto: true,
              paciente: { select: { nombre: true, apellidoPaterno: true } } },
  });

  if (pago.estadoValidacion !== 'OBSERVADO') {
    throw new AppError(400, 'Sólo los ingresos en observación pueden reenviarse.');
  }
  if (pago.usuarioRecibeId !== usuarioId && req.usuario!.rol !== 'ADMIN_GENERAL') {
    throw new AppError(403, 'Sólo quien recibió el pago puede reenviarlo.');
  }

  const actualizado = await prisma.pagoPaciente.update({
    where: { id: pagoId },
    data: {
      estadoValidacion: EstadoValidacionIngreso.PENDIENTE_VALIDACION,
      observaciones: null,
    },
    select: PAGO_SELECT,
  });

  await crearNotificacion({
    titulo: 'Ingreso re-enviado para validación',
    mensaje: `Pago folio ${pago.folioRecibo} de ${pago.paciente.nombre} ${pago.paciente.apellidoPaterno} fue corregido y reenviado.`,
    tipo: 'INFO',
    rol: Rol.RECURSOS_FINANCIEROS,
    link: '/financieros/ingresos',
  });

  res.json({ success: true, data: actualizado });
};

// ════════════════════════════════════════════════════════════════
// Facturas Mensuales
// ════════════════════════════════════════════════════════════════

// GET /recursos-financieros/facturas-mensuales
export const listarFacturasMensuales = async (_req: Request, res: Response) => {
  const facturas = await prisma.facturaElectronicaMensual.findMany({
    include: {
      creadoPor: { select: { nombre: true, apellidos: true } },
      _count: { select: { pagos: true } },
    },
    orderBy: [{ anio: 'desc' }, { mes: 'desc' }],
  });
  res.json({ success: true, data: facturas });
};

// GET /recursos-financieros/facturas-mensuales/:id
export const obtenerFacturaMensual = async (req: Request, res: Response) => {
  const id = parseInt(req.params.id as string);
  const factura = await prisma.facturaElectronicaMensual.findUniqueOrThrow({
    where: { id },
    include: {
      creadoPor: { select: { nombre: true, apellidos: true } },
      pagos: {
        select: PAGO_SELECT,
        orderBy: { folioRecibo: 'asc' },
      },
    },
  });
  res.json({ success: true, data: factura });
};

// POST /recursos-financieros/facturas-mensuales
// Genera factura mensual a partir de los ingresos DEPOSITADO del mes.
// Regla: no se puede generar si hay PENDIENTE_VALIDACION u OBSERVADO en ese mes.
export const generarFacturaMensual = async (req: Request, res: Response) => {
  const body = generarFacturaSchema.parse(req.body);
  const creadoPorId = req.usuario!.id;

  const yaExiste = await prisma.facturaElectronicaMensual.findUnique({
    where: { mes_anio: { mes: body.mes, anio: body.anio } },
    select: { id: true },
  });
  if (yaExiste) {
    throw new AppError(409, `Ya existe una factura mensual para ${body.mes}/${body.anio}.`);
  }

  const inicio = new Date(body.anio, body.mes - 1, 1);
  const fin = new Date(body.anio, body.mes, 1);

  const pagosDelMes = await prisma.pagoPaciente.findMany({
    where: {
      metodoPago: 'EFECTIVO',
      fechaPago: { gte: inicio, lt: fin },
    },
    select: { id: true, monto: true, folioRecibo: true, estadoValidacion: true },
    orderBy: { folioRecibo: 'asc' },
  });

  const noFinalizados = pagosDelMes.filter(p =>
    p.estadoValidacion === 'PENDIENTE_VALIDACION' || p.estadoValidacion === 'OBSERVADO'
  );
  if (noFinalizados.length > 0) {
    throw new AppError(
      409,
      `No se puede generar la factura: hay ${noFinalizados.length} ingreso(s) sin validar/depositar este mes.`
    );
  }

  const aFacturar = pagosDelMes.filter(p => p.estadoValidacion === 'DEPOSITADO');
  if (aFacturar.length === 0) {
    throw new AppError(400, 'No hay ingresos depositados en este mes para facturar.');
  }

  const importeTotal = aFacturar.reduce((s, p) => s + p.monto, 0);
  const foliosOrdenados = aFacturar.map(p => p.folioRecibo).filter(Boolean) as string[];
  const folioReciboInicial = foliosOrdenados[0];
  const folioReciboFinal = foliosOrdenados[foliosOrdenados.length - 1];

  const consecutivo = await prisma.facturaElectronicaMensual.count() + 1;
  const folio = `FAC-${body.anio}${body.mes.toString().padStart(2, '0')}-${consecutivo.toString().padStart(4, '0')}`;

  const factura = await prisma.$transaction(async (tx) => {
    const nueva = await tx.facturaElectronicaMensual.create({
      data: {
        folio,
        mes: body.mes,
        anio: body.anio,
        importeTotal,
        cantidadEnLetra: numeroALetras(importeTotal),
        recibosCount: aFacturar.length,
        folioReciboInicial,
        folioReciboFinal,
        observaciones: body.observaciones ?? null,
        creadoPorId,
        estado: EstadoFacturaMensual.BORRADOR,
      },
    });

    await tx.pagoPaciente.updateMany({
      where: { id: { in: aFacturar.map(p => p.id) } },
      data: { facturado: true, facturaMensualId: nueva.id },
    });

    return nueva;
  });

  res.status(201).json({ success: true, data: factura });
};

// POST /recursos-financieros/facturas-mensuales/:id/emitir
// Marca la factura como EMITIDA y guarda la URL del PDF/XML oficial.
export const emitirFacturaMensual = async (req: Request, res: Response) => {
  const id = parseInt(req.params.id as string);
  const body = emitirFacturaSchema.parse(req.body);

  const factura = await prisma.facturaElectronicaMensual.findUniqueOrThrow({
    where: { id },
    select: { id: true, estado: true },
  });
  if (factura.estado !== 'BORRADOR') {
    throw new AppError(400, `Sólo facturas en borrador pueden emitirse (estado actual: ${factura.estado}).`);
  }

  const actualizada = await prisma.facturaElectronicaMensual.update({
    where: { id },
    data: {
      estado: EstadoFacturaMensual.EMITIDA,
      archivoUrl: body.archivoUrl,
      fechaEmision: new Date(),
    },
  });

  await prisma.pagoPaciente.updateMany({
    where: { facturaMensualId: id },
    data: { estadoValidacion: EstadoValidacionIngreso.FACTURADO },
  });

  res.json({ success: true, data: actualizada });
};

// ════════════════════════════════════════════════════════════════
// Dashboard / Métricas
// ════════════════════════════════════════════════════════════════

// GET /recursos-financieros/dashboard
export const getDashboard = async (_req: Request, res: Response) => {
  const ahora = new Date();
  const inicioMes = new Date(ahora.getFullYear(), ahora.getMonth(), 1);
  const finMes = new Date(ahora.getFullYear(), ahora.getMonth() + 1, 1);

  const [pendientes, observados, validados, depositados, facturadosMes, ingresosMes] = await Promise.all([
    prisma.pagoPaciente.count({ where: { estadoValidacion: 'PENDIENTE_VALIDACION' } }),
    prisma.pagoPaciente.count({ where: { estadoValidacion: 'OBSERVADO' } }),
    prisma.pagoPaciente.count({ where: { estadoValidacion: 'VALIDADO' } }),
    prisma.pagoPaciente.count({ where: { estadoValidacion: 'DEPOSITADO' } }),
    prisma.facturaElectronicaMensual.count({
      where: { mes: ahora.getMonth() + 1, anio: ahora.getFullYear() },
    }),
    prisma.pagoPaciente.aggregate({
      where: { fechaPago: { gte: inicioMes, lt: finMes }, metodoPago: 'EFECTIVO' },
      _sum: { monto: true },
      _count: { _all: true },
    }),
  ]);

  res.json({
    success: true,
    data: {
      pendientes,
      observados,
      validados,
      depositados,
      facturadosMes,
      ingresosMes: {
        total: ingresosMes._sum.monto ?? 0,
        cantidad: ingresosMes._count._all,
      },
    },
  });
};
