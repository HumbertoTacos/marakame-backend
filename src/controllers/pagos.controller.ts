import { Request, Response } from 'express';
import { prisma } from '../utils/prisma';
import { MetodoPago, Rol, EstadoValidacionIngreso } from '@prisma/client';
import { z } from 'zod';
import { crearNotificacion } from '../utils/notificaciones';
import { AppError } from '../middlewares/errorHandler';

const registrarPagoSchema = z.object({
  monto:      z.number().positive('El monto debe ser mayor a 0'),
  metodoPago: z.nativeEnum(MetodoPago),
  concepto:   z.string().min(3, 'El concepto es requerido'),
  folioRecibo: z.string().trim().min(1).optional(),
});

const agregarCargoSchema = z.object({
  monto:   z.number().positive('El monto debe ser mayor a 0'),
  concepto: z.string().min(3, 'El concepto es requerido'),
});

// GET /pagos/resumen
// Lista todos los pacientes activos con su saldo pendiente
export const getResumenPagos = async (_req: Request, res: Response) => {
  const pacientes = await prisma.paciente.findMany({
    where: { estado: 'INTERNADO' },
    select: {
      id: true,
      claveUnica: true,
      nombre: true,
      apellidoPaterno: true,
      apellidoMaterno: true,
      fechaIngreso: true,
      cama: { select: { numero: true, habitacion: { select: { area: true } } } },
      pagos:  { select: { monto: true } },
      cargos: { select: { monto: true, pagado: true } },
    },
    orderBy: { fechaIngreso: 'asc' },
  });

  const resultado = pacientes.map(p => {
    const totalCargos  = p.cargos.reduce((s, c) => s + c.monto, 0);
    const totalPagado  = p.pagos.reduce((s, pg) => s + pg.monto, 0);
    const saldoPendiente = totalCargos - totalPagado;
    return {
      id: p.id,
      claveUnica: p.claveUnica,
      nombre: `${p.nombre} ${p.apellidoPaterno} ${p.apellidoMaterno ?? ''}`.trim(),
      fechaIngreso: p.fechaIngreso,
      cama: p.cama ? `${p.cama.numero} · ${p.cama.habitacion?.area}` : 'Sin cama',
      totalCargos,
      totalPagado,
      saldoPendiente,
      alDia: saldoPendiente <= 0,
    };
  });

  res.json({ success: true, data: resultado });
};

// GET /pagos/paciente/:id/estado-cuenta
// Detalle completo: cargos, pagos y balance de un paciente
export const getEstadoCuenta = async (req: Request, res: Response) => {
  const pacienteId = parseInt(req.params.id as string);

  const paciente = await prisma.paciente.findUniqueOrThrow({
    where: { id: pacienteId },
    select: {
      id: true, claveUnica: true, nombre: true,
      apellidoPaterno: true, apellidoMaterno: true,
      estado: true, fechaIngreso: true,
      cama: { select: { numero: true, habitacion: { select: { area: true } } } },
      pagos: {
        select: {
          id: true, monto: true, fechaPago: true,
          metodoPago: true, concepto: true, comprobanteUrl: true, facturado: true,
          folioRecibo: true, estadoValidacion: true, observaciones: true,
          usuarioRecibe: { select: { nombre: true, apellidos: true } },
        },
        orderBy: { fechaPago: 'desc' },
      },
      cargos: {
        select: {
          id: true, monto: true, concepto: true, fechaCargo: true, pagado: true,
          usuarioCarga: { select: { nombre: true, apellidos: true } },
        },
        orderBy: { fechaCargo: 'desc' },
      },
    },
  });

  const totalCargos   = paciente.cargos.reduce((s, c) => s + c.monto, 0);
  const totalPagado   = paciente.pagos.reduce((s, p) => s + p.monto, 0);
  const saldoPendiente = totalCargos - totalPagado;

  res.json({
    success: true,
    data: {
      paciente: {
        id: paciente.id, claveUnica: paciente.claveUnica,
        nombre: `${paciente.nombre} ${paciente.apellidoPaterno} ${paciente.apellidoMaterno ?? ''}`.trim(),
        estado: paciente.estado, fechaIngreso: paciente.fechaIngreso,
        cama: paciente.cama ? `${paciente.cama.numero} · ${paciente.cama.habitacion?.area}` : 'Sin cama',
      },
      resumen: { totalCargos, totalPagado, saldoPendiente },
      cargos: paciente.cargos,
      pagos:  paciente.pagos,
    },
  });
};

// POST /pagos/paciente/:id
// Registra un pago recibido. Cuando es EFECTIVO entra al flujo de validación
// de Recursos Financieros con su folio de recibo foliado.
export const registrarPago = async (req: Request, res: Response) => {
  const pacienteId = parseInt(req.params.id as string);
  const body = registrarPagoSchema.parse(req.body);
  const usuarioRecibeId = req.usuario!.id;

  const paciente = await prisma.paciente.findUniqueOrThrow({
    where: { id: pacienteId },
    select: { id: true, nombre: true, apellidoPaterno: true },
  });

  // Reglas del flujo de ingresos:
  // - EFECTIVO → requiere folioRecibo y queda PENDIENTE_VALIDACION
  // - Otros métodos → entran como VALIDADO (no requieren cuadre físico)
  const esEfectivo = body.metodoPago === MetodoPago.EFECTIVO;
  if (esEfectivo && !body.folioRecibo) {
    throw new AppError(400, 'El folio de recibo es obligatorio al cobrar en efectivo.');
  }

  if (body.folioRecibo) {
    const folioExistente = await prisma.pagoPaciente.findUnique({
      where: { folioRecibo: body.folioRecibo },
      select: { id: true },
    });
    if (folioExistente) {
      throw new AppError(409, `El folio "${body.folioRecibo}" ya fue registrado en otro pago.`);
    }
  }

  const estadoValidacion: EstadoValidacionIngreso = esEfectivo
    ? EstadoValidacionIngreso.PENDIENTE_VALIDACION
    : EstadoValidacionIngreso.VALIDADO;

  const pago = await prisma.pagoPaciente.create({
    data: {
      pacienteId,
      usuarioRecibeId,
      monto:           body.monto,
      metodoPago:      body.metodoPago,
      concepto:        body.concepto,
      folioRecibo:     body.folioRecibo,
      estadoValidacion,
    },
    include: {
      usuarioRecibe: { select: { nombre: true, apellidos: true } },
    },
  });

  if (esEfectivo) {
    await crearNotificacion({
      titulo: 'Nuevo ingreso por validar',
      mensaje: `Pago en efectivo de $${body.monto.toFixed(2)} (folio ${body.folioRecibo}) de ${paciente.nombre} ${paciente.apellidoPaterno} requiere validación.`,
      tipo: 'INFO',
      rol: Rol.RECURSOS_FINANCIEROS,
      link: `/financieros/ingresos`,
    });
  }

  res.status(201).json({ success: true, data: pago });
};

// POST /pagos/paciente/:id/cargos
// Agrega un cargo al paciente
export const agregarCargo = async (req: Request, res: Response) => {
  const pacienteId = parseInt(req.params.id as string);
  const body = agregarCargoSchema.parse(req.body);
  const usuarioCargaId = req.usuario!.id;

  await prisma.paciente.findUniqueOrThrow({ where: { id: pacienteId } });

  const cargo = await prisma.cargoPaciente.create({
    data: {
      pacienteId,
      usuarioCargaId,
      monto:   body.monto,
      concepto: body.concepto,
    },
    include: {
      usuarioCarga: { select: { nombre: true, apellidos: true } },
    },
  });

  res.status(201).json({ success: true, data: cargo });
};

// PATCH /pagos/cargos/:cargoId/marcar-pagado
// Marca un cargo individual como pagado
export const marcarCargoPagado = async (req: Request, res: Response) => {
  const cargoId = parseInt(req.params.cargoId as string);

  const cargo = await prisma.cargoPaciente.update({
    where: { id: cargoId },
    data:  { pagado: true },
  });

  res.json({ success: true, data: cargo });
};

// GET /pagos/metodos
// Devuelve los métodos de pago disponibles (para los selects del front)
export const getMetodosPago = async (_req: Request, res: Response) => {
  const metodos = Object.values(MetodoPago).map(m => ({
    value: m,
    label: m === 'EFECTIVO' ? 'Efectivo'
         : m === 'TRANSFERENCIA' ? 'Transferencia Bancaria'
         : m === 'TARJETA' ? 'Tarjeta'
         : 'Otro',
  }));
  res.json({ success: true, data: metodos });
};
