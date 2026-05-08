import { Request, Response } from 'express';
import { prisma } from '../utils/prisma';
import { AppError } from '../middlewares/errorHandler';
import { registrarAuditoria } from '../utils/auditoria';

// ══════════════════════════════════════════════════════════════
// TRATAMIENTOS MÉDICOS
// ══════════════════════════════════════════════════════════════

export const getTratamientos = async (req: Request, res: Response) => {
  const { expedienteId } = req.params;

  const tratamientos = await prisma.tratamientoMedico.findMany({
    where: { expedienteId: parseInt(expedienteId, 10) },
    include: {
      medico: true,
      suministros: {
        include: { enfermero: true },
        orderBy: { fechaSuministro: 'desc' }
      }
    },
    orderBy: { createdAt: 'desc' }
  });

  res.json({ success: true, data: tratamientos });
};

export const crearTratamiento = async (req: Request, res: Response) => {
  const { expedienteId } = req.params;
  const medicoId = req.usuario!.id;
  const { medicamento, dosis, frecuencia, fechaInicio, fechaFin, indicaciones } = req.body;

  if (!medicamento || !dosis || !frecuencia || !fechaInicio) {
    throw new AppError(400, 'Medicamento, dosis, frecuencia y fecha de inicio son requeridos');
  }

  const expedienteIdInt = parseInt(expedienteId, 10);
  const expediente = await prisma.expediente.findUnique({ where: { id: expedienteIdInt } });
  if (!expediente) throw new AppError(404, 'Expediente no encontrado');

  const tratamiento = await prisma.tratamientoMedico.create({
    data: {
      expedienteId: expedienteIdInt,
      medicoId,
      medicamento,
      dosis,
      frecuencia,
      fechaInicio: new Date(fechaInicio),
      fechaFin: fechaFin ? new Date(fechaFin) : undefined,
      indicaciones,
      activo: true
    },
    include: { medico: true }
  });

  await registrarAuditoria(
    medicoId, 'CREATE', 'CLINICA_TRATAMIENTO',
    { tratamientoId: tratamiento.id, medicamento, expedienteId: expedienteIdInt },
    req.ip
  );

  res.status(201).json({ success: true, data: tratamiento });
};

export const desactivarTratamiento = async (req: Request, res: Response) => {
  const { id } = req.params;
  const usuarioId = req.usuario!.id;
  const tratamientoId = parseInt(id, 10);

  const tratamiento = await prisma.tratamientoMedico.findUnique({ where: { id: tratamientoId } });
  if (!tratamiento) throw new AppError(404, 'Tratamiento no encontrado');
  if (!tratamiento.activo) throw new AppError(400, 'El tratamiento ya está inactivo');

  const updated = await prisma.tratamientoMedico.update({
    where: { id: tratamientoId },
    data: { activo: false, fechaFin: new Date() }
  });

  await registrarAuditoria(
    usuarioId, 'UPDATE', 'CLINICA_TRATAMIENTO',
    { tratamientoId, accion: 'DESACTIVADO' },
    req.ip
  );

  res.json({ success: true, data: updated });
};

// ══════════════════════════════════════════════════════════════
// SUMINISTRO DE TRATAMIENTOS
// ══════════════════════════════════════════════════════════════

export const registrarSuministro = async (req: Request, res: Response) => {
  const { id } = req.params; // tratamientoId
  const enfermeroId = req.usuario!.id;
  const { dosisAplicada, observaciones } = req.body;

  if (!dosisAplicada) throw new AppError(400, 'La dosis aplicada es requerida');

  const tratamientoId = parseInt(id, 10);
  const tratamiento = await prisma.tratamientoMedico.findUnique({ where: { id: tratamientoId } });
  if (!tratamiento) throw new AppError(404, 'Tratamiento no encontrado');
  if (!tratamiento.activo) throw new AppError(400, 'El tratamiento ya no está activo');

  const suministro = await prisma.suministroTratamiento.create({
    data: {
      tratamientoId,
      enfermeroId,
      dosisAplicada,
      observaciones,
      fechaSuministro: new Date()
    },
    include: { enfermero: true }
  });

  await registrarAuditoria(
    enfermeroId, 'CREATE', 'CLINICA_SUMINISTRO',
    { suministroId: suministro.id, tratamientoId },
    req.ip
  );

  res.status(201).json({ success: true, data: suministro });
};

export const getSuministros = async (req: Request, res: Response) => {
  const { id } = req.params; // tratamientoId

  const suministros = await prisma.suministroTratamiento.findMany({
    where: { tratamientoId: parseInt(id, 10) },
    include: { enfermero: true },
    orderBy: { fechaSuministro: 'desc' }
  });

  res.json({ success: true, data: suministros });
};

// ══════════════════════════════════════════════════════════════
// AGENDA DE CITAS
// ══════════════════════════════════════════════════════════════

export const getCitas = async (req: Request, res: Response) => {
  const { pacienteId } = req.params;

  const citas = await prisma.citaAgenda.findMany({
    where: { pacienteId: parseInt(pacienteId, 10) },
    include: { especialista: true },
    orderBy: { fechaHora: 'desc' }
  });

  res.json({ success: true, data: citas });
};

export const crearCita = async (req: Request, res: Response) => {
  const especialistaId = req.usuario!.id;
  const { pacienteId, fechaHora, motivo, observaciones } = req.body;

  if (!pacienteId || !fechaHora || !motivo) {
    throw new AppError(400, 'Paciente, fecha/hora y motivo son requeridos');
  }

  const pacienteIdInt = parseInt(pacienteId, 10);
  const paciente = await prisma.paciente.findUnique({ where: { id: pacienteIdInt } });
  if (!paciente) throw new AppError(404, 'Paciente no encontrado');

  const cita = await prisma.citaAgenda.create({
    data: {
      pacienteId: pacienteIdInt,
      especialistaId,
      fechaHora: new Date(fechaHora),
      motivo,
      observaciones,
      estado: 'PROGRAMADA'
    },
    include: { especialista: true }
  });

  await registrarAuditoria(
    especialistaId, 'CREATE', 'CLINICA_CITA',
    { citaId: cita.id, pacienteId: pacienteIdInt, motivo },
    req.ip
  );

  res.status(201).json({ success: true, data: cita });
};

export const actualizarCita = async (req: Request, res: Response) => {
  const { id } = req.params;
  const usuarioId = req.usuario!.id;
  const { estado, observaciones } = req.body;

  const citaId = parseInt(id, 10);
  const cita = await prisma.citaAgenda.findUnique({ where: { id: citaId } });
  if (!cita) throw new AppError(404, 'Cita no encontrada');

  const updated = await prisma.citaAgenda.update({
    where: { id: citaId },
    data: { estado, observaciones }
  });

  await registrarAuditoria(
    usuarioId, 'UPDATE', 'CLINICA_CITA',
    { citaId, nuevoEstado: estado },
    req.ip
  );

  res.json({ success: true, data: updated });
};

// ══════════════════════════════════════════════════════════════
// EVALUACIONES PSICOMÉTRICAS
// ══════════════════════════════════════════════════════════════

export const getEvaluaciones = async (req: Request, res: Response) => {
  const { pacienteId } = req.params;

  const evaluaciones = await (prisma as any).evaluacionResultado.findMany({
    where: { pacienteId: parseInt(pacienteId, 10) },
    include: { usuario: { select: { id: true, nombre: true, apellidos: true, rol: true } } },
    orderBy: { fechaAplicacion: 'desc' }
  });

  res.json({ success: true, data: evaluaciones });
};

export const registrarEvaluacion = async (req: Request, res: Response) => {
  const { pacienteId } = req.params;
  const usuarioId = req.usuario!.id;
  const { instrumento, puntajeTotal, interpretacion, observaciones } = req.body;

  if (!instrumento || puntajeTotal === undefined) {
    throw new AppError(400, 'Instrumento y puntaje son requeridos');
  }

  const pacienteIdInt = parseInt(pacienteId, 10);
  const paciente = await prisma.paciente.findUnique({ where: { id: pacienteIdInt } });
  if (!paciente) throw new AppError(404, 'Paciente no encontrado');

  const evaluacion = await (prisma as any).evaluacionResultado.create({
    data: {
      pacienteId: pacienteIdInt,
      usuarioId,
      instrumento,
      puntajeTotal: parseFloat(puntajeTotal),
      interpretacion,
      observaciones
    },
    include: { usuario: { select: { id: true, nombre: true, apellidos: true, rol: true } } }
  });

  await registrarAuditoria(
    usuarioId, 'CREATE', 'CLINICA_EVALUACION',
    { evaluacionId: evaluacion.id, instrumento, pacienteId: pacienteIdInt },
    req.ip
  );

  res.status(201).json({ success: true, data: evaluacion });
};

export const actualizarEvaluacion = async (req: Request, res: Response) => {
  const { id } = req.params;
  const usuarioId = req.usuario!.id;
  const { puntajeTotal, interpretacion, observaciones } = req.body;

  const evalId = parseInt(id, 10);
  const evaluacion = await (prisma as any).evaluacionResultado.findUnique({ where: { id: evalId } });
  if (!evaluacion) throw new AppError(404, 'Evaluación no encontrada');

  const updated = await (prisma as any).evaluacionResultado.update({
    where: { id: evalId },
    data: {
      puntajeTotal: puntajeTotal !== undefined ? parseFloat(puntajeTotal) : undefined,
      interpretacion,
      observaciones
    },
    include: { usuario: { select: { id: true, nombre: true, apellidos: true, rol: true } } }
  });

  await registrarAuditoria(
    usuarioId, 'UPDATE', 'CLINICA_EVALUACION',
    { evaluacionId: evalId },
    req.ip
  );

  res.json({ success: true, data: updated });
};
