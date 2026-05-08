import { Request, Response } from 'express';
import { prisma } from '../utils/prisma';
import { EstadoPaciente, EstadoCama, TipoEgreso } from '@prisma/client';
import { z } from 'zod';

const egresoSchema = z.object({
  tipoEgreso:             z.nativeEnum(TipoEgreso),
  notaMedica:             z.string().min(10, 'La nota médica debe tener al menos 10 caracteres'),
  pertenenciasEntregadas: z.boolean(),
  inscribirReforzamiento: z.boolean(),
  fechaInicioReforzamiento: z.string().optional(),
  fechaFinReforzamiento:    z.string().optional(),
  observacionesReforzamiento: z.string().optional(),
});

// GET /egreso/paciente/:pacienteId/datos
// Recopila toda la información necesaria para el wizard de egreso
export const getDatosEgreso = async (req: Request, res: Response) => {
  const pacienteId = parseInt(req.params.pacienteId);

  const paciente = await prisma.paciente.findUniqueOrThrow({
    where: { id: pacienteId },
    select: {
      id: true, claveUnica: true, nombre: true,
      apellidoPaterno: true, apellidoMaterno: true,
      estado: true, fechaIngreso: true,
      cama: { select: { id: true, codigo: true, numero: true } },
      inventarioPertenencias: { select: { articulos: true, firmaRecibido: true } },
      programaReforzamiento: { select: { id: true, estado: true } },
      pagos:   { select: { monto: true } },
      cargos:  { select: { monto: true, pagado: true } },
    },
  });

  if (paciente.estado !== EstadoPaciente.INTERNADO) {
    res.status(400).json({
      success: false,
      message: 'Solo se puede egresar a un paciente con estado INTERNADO.',
    });
    return;
  }

  const totalPagado   = paciente.pagos.reduce((s, p) => s + p.monto, 0);
  const totalCargos   = paciente.cargos.reduce((s, c) => s + c.monto, 0);
  const saldoPendiente = Math.max(0, totalCargos - totalPagado);

  const diasInternado = paciente.fechaIngreso
    ? Math.floor((Date.now() - new Date(paciente.fechaIngreso).getTime()) / 86_400_000)
    : null;

  res.json({
    success: true,
    data: {
      paciente: {
        id: paciente.id,
        claveUnica: paciente.claveUnica,
        nombre: paciente.nombre,
        apellidoPaterno: paciente.apellidoPaterno,
        apellidoMaterno: paciente.apellidoMaterno,
        fechaIngreso: paciente.fechaIngreso,
        diasInternado,
        cama: paciente.cama,
      },
      finanzas: { totalPagado, totalCargos, saldoPendiente },
      pertenencias: paciente.inventarioPertenencias,
      yaInscritoReforzamiento: !!paciente.programaReforzamiento,
    },
  });
};

// POST /egreso/paciente/:pacienteId
// Ejecuta el egreso completo en una transacción atómica
export const registrarEgreso = async (req: Request, res: Response) => {
  const pacienteId  = parseInt(req.params.pacienteId);
  const usuarioId   = req.usuario!.id;
  const body        = egresoSchema.parse(req.body);

  // Verificar que el paciente esté internado
  const paciente = await prisma.paciente.findUniqueOrThrow({
    where:  { id: pacienteId },
    select: { estado: true, cama: { select: { id: true } }, pagos: { select: { monto: true } }, cargos: { select: { monto: true } } },
  });

  if (paciente.estado !== EstadoPaciente.INTERNADO) {
    res.status(400).json({ success: false, message: 'El paciente no está internado actualmente.' });
    return;
  }

  const totalPagado    = paciente.pagos.reduce((s, p) => s + p.monto, 0);
  const totalCargos    = paciente.cargos.reduce((s, c) => s + c.monto, 0);
  const saldoPendiente = Math.max(0, totalCargos - totalPagado);

  // Ejecutar todo en una transacción
  const result = await prisma.$transaction(async (tx) => {
    // 1. Registrar el egreso
    const egreso = await tx.egresoRegistro.create({
      data: {
        pacienteId,
        tipoEgreso:             body.tipoEgreso,
        notaMedica:             body.notaMedica,
        saldoPendiente,
        pertenenciasEntregadas: body.pertenenciasEntregadas,
        inscritoReforzamiento:  body.inscribirReforzamiento,
        autorizadoPorId:        usuarioId,
        fechaEgreso:            new Date(),
      },
    });

    // 2. Cambiar estado del paciente a EGRESADO
    await tx.paciente.update({
      where: { id: pacienteId },
      data:  { estado: EstadoPaciente.EGRESADO },
    });

    // 3. Liberar la cama del paciente (si tenía una asignada)
    if (paciente.cama?.id) {
      await tx.cama.update({
        where: { id: paciente.cama.id },
        data:  { estado: EstadoCama.DISPONIBLE, pacienteId: null },
      });
    }

    // 4. Crear programa de reforzamiento si el usuario lo solicitó
    let programa = null;
    if (body.inscribirReforzamiento && body.fechaInicioReforzamiento && body.fechaFinReforzamiento) {
      programa = await tx.programaReforzamiento.upsert({
        where:  { pacienteId },
        update: {
          fechaInicio:      new Date(body.fechaInicioReforzamiento),
          fechaFinEstimada: new Date(body.fechaFinReforzamiento),
          observaciones:    body.observacionesReforzamiento,
          estado:           'ACTIVO',
        },
        create: {
          pacienteId,
          fechaInicio:      new Date(body.fechaInicioReforzamiento),
          fechaFinEstimada: new Date(body.fechaFinReforzamiento),
          observaciones:    body.observacionesReforzamiento,
          estado:           'ACTIVO',
        },
      });
    }

    return { egreso, programa };
  });

  res.status(201).json({ success: true, data: result });
};

// GET /egreso/paciente/:pacienteId/registro
// Devuelve el registro de egreso ya guardado (para consultar después)
export const getRegistroEgreso = async (req: Request, res: Response) => {
  const pacienteId = parseInt(req.params.pacienteId);

  const registro = await prisma.egresoRegistro.findUnique({
    where: { pacienteId },
    include: {
      paciente: {
        select: {
          id: true, claveUnica: true, nombre: true,
          apellidoPaterno: true, fechaIngreso: true,
        },
      },
      autorizadoPor: { select: { id: true, nombre: true, apellidos: true, rol: true } },
    },
  });

  if (!registro) {
    res.status(404).json({ success: false, message: 'No se encontró registro de egreso para este paciente.' });
    return;
  }

  res.json({ success: true, data: registro });
};
