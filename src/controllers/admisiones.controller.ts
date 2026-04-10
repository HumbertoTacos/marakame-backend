import { Request, Response } from 'express';
import { prisma } from '../utils/prisma';
import { AppError } from '../middlewares/errorHandler';

export const createPrimerContacto = async (req: Request, res: Response) => {
  const data = req.body;
  const usuarioId = req.usuario!.id;

  // Si envían data del paciente, creamos un registro paciente si no existe o usamos el id si lo hay
  const pacienteId = data.pacienteId;

  // Lógica de paciente (crear o vincular)
  let pacienteIdToUse: number;

  if (pacienteId) {
    pacienteIdToUse = parseInt(pacienteId as string, 10);
  } else {
    const paciente = await prisma.paciente.create({
      data: {
        nombre: data.nombrePaciente || 'Sin Nombre',
        apellidoPaterno: data.apellidoPaterno || '',
        apellidoMaterno: data.apellidoMaterno || '',
        fechaNacimiento: data.fechaNacimiento ? new Date(data.fechaNacimiento) : new Date(),
        sexo: data.sexo || 'M',
        sustancias: data.sustancias || [],
      }
    });
    pacienteIdToUse = paciente.id;
  }

  const primerContacto = await prisma.primerContacto.create({
    data: {
      pacienteId: pacienteIdToUse,
      usuarioId: usuarioId,
      dia: new Date().toLocaleDateString('es-ES', { weekday: 'long' }),
      fuenteReferencia: data.fuenteReferencia || 'OTRO',
      solicitanteNombre: data.solicitanteNombre,
      solicitanteTelefono: data.solicitanteTelefono,
      solicitanteCelular: data.solicitanteCelular,
      solicitanteDireccion: data.solicitanteDireccion,
      solicitanteOcupacion: data.solicitanteOcupacion,
      relacionPaciente: data.relacionPaciente || 'FAMILIAR',
      dispuestoInternarse: data.dispuestoInternarse || 'NO',
      requiereIntervencion: data.requiereIntervencion || false,
      estadoPrevioTratamiento: data.estadoPrevioTratamiento || false,
      acuerdo: data.acuerdo,
      observaciones: data.observaciones,
      posibilidadesEconomicas: data.posibilidadesEconomicas,
      medicoNombre: data.medicoNombre,
      conclusionMedica: data.conclusionMedica,
    }
  });

  res.status(201).json({ success: true, data: primerContacto });
};

export const getPrimerContactos = async (req: Request, res: Response) => {
  const contactos = await prisma.primerContacto.findMany({
    include: {
      paciente: true,
      usuario: { select: { nombre: true, apellidos: true } }
    },
    orderBy: { fecha: 'desc' }
  });
  res.json({ success: true, data: contactos });
};

export const getPrimerContactoById = async (req: Request, res: Response) => {
  const { id } = req.params;
  const contacto = await prisma.primerContacto.findUnique({
    where: { id: parseInt(id as string, 10) },
    include: {
      paciente: true,
      usuario: { select: { nombre: true, apellidos: true } }
    }
  });

  if (!contacto) throw new AppError(404, 'Primer contacto no encontrado');

  res.json({ success: true, data: contacto });
};

export const createValoracionDiagnostica = async (req: Request, res: Response) => {
  const data = req.body;
  const usuarioId = req.usuario!.id;

  const valoracion = await prisma.valoracionDiagnostica.create({
    data: {
      pacienteId: parseInt(data.pacienteId as string, 10),
      usuarioId: usuarioId,
      sustanciasConsume: data.sustanciasConsume || [],
      descripcionSustancias: data.descripcionSustancias,
      cumpleCriteriosInternamiento: data.cumpleCriteriosInternamiento || false,
      aceptaInternarse: data.aceptaInternarse || false,
      requiereIntervencion: data.requiereIntervencion || false,
      internacionPrevia: data.internacionPrevia || false,
      posibilidadesEconomicas: data.posibilidadesEconomicas,
      acuerdos: data.acuerdos,
      fechaTentativaIngreso: data.fechaTentativaIngreso ? new Date(data.fechaTentativaIngreso) : null,
      medicoNombre: data.medicoNombre,
      observacionesMedicas: data.observacionesMedicas,
    }
  });

  // Si acepta internarse, actualizamos el estado del paciente
  if (data.aceptaInternarse) {
    await prisma.paciente.update({
      where: { id: parseInt(data.pacienteId as string, 10) },
      data: { estado: 'PENDIENTE_INGRESO' }
    });
  }

  res.status(201).json({ success: true, data: valoracion });
};

export const getValoraciones = async (req: Request, res: Response) => {
  const valoraciones = await prisma.valoracionDiagnostica.findMany({
    include: {
      paciente: true,
      usuario: { select: { nombre: true, apellidos: true } }
    },
    orderBy: { fecha: 'desc' }
  });
  res.json({ success: true, data: valoraciones });
};

export const getValoracionById = async (req: Request, res: Response) => {
  const { id } = req.params;
  const valoracion = await prisma.valoracionDiagnostica.findUnique({
    where: { id: parseInt(id as string, 10) },
    include: {
      paciente: true,
      usuario: { select: { nombre: true, apellidos: true } }
    }
  });

  if (!valoracion) throw new AppError(404, 'Valoración no encontrada');

  res.json({ success: true, data: valoracion });
};

// ============================================================
// INGRESO WIZARD (8 PASOS)
// ============================================================

export const createIngreso = async (req: Request, res: Response) => {
  const { pacienteId, motivoIngreso } = req.body;
  const usuarioId = req.usuario!.id;

  const ingreso = await prisma.ingreso.create({
    data: {
      pacienteId: parseInt(pacienteId as string, 10),
      usuarioId,
      motivoIngreso,
      estado: 'EN_PROCESO',
      pasoActual: 1
    }
  });

  res.status(201).json({ success: true, data: ingreso });
};

export const updateIngreso = async (req: Request, res: Response) => {
  const { id } = req.params;
  const data = req.body;

  // Evitamos actualizar datos relacionales directamente aquí si viene extra params
  const updateData: any = {
    pasoActual: data.pasoActual,
    estado: data.estado,
    motivoIngreso: data.motivoIngreso,
    fechaCita: data.fechaCita ? new Date(data.fechaCita) : undefined,
    horaCita: data.horaCita,
    medicoAsignado: data.medicoAsignado,
    resultadoValoracion: data.resultadoValoracion,
    observacionesValoracion: data.observacionesValoracion,
    esApto: data.esApto,
    motivoNoApto: data.motivoNoApto,
    habitacionAsignada: data.habitacionAsignada,
    areaAsignada: data.areaAsignada,
  };

  // Si finaliza el ingreso, la fecha se marca
  if (data.estado === 'COMPLETADO') {
    updateData.fechaIngreso = new Date();
  }

  const ingreso = await prisma.ingreso.update({
    where: { id: parseInt(id as string, 10) },
    data: updateData
  });

  // Si ya se asigna un area y habitación (paso 8), actualizamos el paciente
  if (data.habitacionAsignada && data.areaAsignada) {
    await prisma.paciente.update({
      where: { id: ingreso.pacienteId },
      data: {
        estado: 'INTERNADO'
      }
    });
  }

  res.json({ success: true, data: ingreso });
};

export const getIngresos = async (req: Request, res: Response) => {
  const ingresos = await prisma.ingreso.findMany({
    include: {
      paciente: true,
      usuario: { select: { nombre: true, apellidos: true } }
    },
    orderBy: { createdAt: 'desc' }
  });
  res.json({ success: true, data: ingresos });
};

export const getIngresoById = async (req: Request, res: Response) => {
  const { id } = req.params;
  const ingreso = await prisma.ingreso.findUnique({
    where: { id: parseInt(id as string, 10) },
    include: {
      paciente: true,
      usuario: { select: { nombre: true, apellidos: true } }
    }
  });

  if (!ingreso) throw new AppError(404, 'Ingreso no encontrado');

  res.json({ success: true, data: ingreso });
};

// ============================================================
// ESTUDIO SOCIOECONÓMICO (16 Secciones)
// ============================================================

export const createEstudioSocioeconomico = async (req: Request, res: Response) => {
  const { pacienteId, datos, nivelSocioeconomico, puntajeCalculado } = req.body;

  const estudio = await prisma.estudioSocioeconomico.create({
    data: {
      pacienteId: parseInt(pacienteId as string, 10),
      datos: datos || {},
      seccionActual: 1,
      nivelSocioeconomico,
      puntajeCalculado,
      completado: false
    }
  });

  res.status(201).json({ success: true, data: estudio });
};

export const updateEstudioSocioeconomico = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { datos, seccionActual, completado, nivelSocioeconomico, puntajeCalculado } = req.body;

  const estudio = await prisma.estudioSocioeconomico.update({
    where: { id: parseInt(id as string, 10) },
    data: {
      datos,
      seccionActual,
      completado,
      nivelSocioeconomico,
      puntajeCalculado
    }
  });

  res.json({ success: true, data: estudio });
};

export const getEstudiosSocioeconomicos = async (req: Request, res: Response) => {
  const estudios = await prisma.estudioSocioeconomico.findMany({
    include: { paciente: true },
    orderBy: { createdAt: 'desc' }
  });
  res.json({ success: true, data: estudios });
};

export const getEstudioByPacienteId = async (req: Request, res: Response) => {
  const { pacienteId } = req.params;
  const estudio = await prisma.estudioSocioeconomico.findUnique({
    where: { pacienteId: parseInt(pacienteId as string, 10) },
    include: { paciente: true }
  });

  if (!estudio) throw new AppError(404, 'Estudio socioeconómico no encontrado para este paciente');

  res.json({ success: true, data: estudio });
};
