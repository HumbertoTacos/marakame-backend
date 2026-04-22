import { Request, Response } from 'express';
import { prisma } from '../utils/prisma';
import { AppError } from '../middlewares/errorHandler';
import { aplicarCapaPrivacidad, asignarClaveUnicaPaciente } from '../utils/paciente.utils';

export const createPrimerContacto = async (req: Request, res: Response) => {
  const data = req.body;
  const usuarioId = req.usuario!.id;

  const result = await prisma.$transaction(async (tx) => {
    // 1. Preparar datos del Paciente (Prospecto)
    const nombreFinal = data.nombrePaciente?.trim() || 'Prospecto Anónimo';
    
    // Si no hay fecha de nacimiento, usamos un placeholder (Integridad del modelo maestro)
    const fechaNacimientoFinal = new Date('1900-01-01');

    // 2. Crear o Vincular Paciente (Estado PROSPECTO por defecto)
    let pacienteIdToUse: number;

    if (data.pacienteId) {
      pacienteIdToUse = parseInt(data.pacienteId as string, 10);
      // Si ya existe, actualizamos su estado según el dictamen
      await tx.paciente.update({
        where: { id: pacienteIdToUse },
        data: { 
          estado: data.esApto === true || data.esApto === 'true' ? 'PENDIENTE_INGRESO' : (data.esApto === false || data.esApto === 'false' ? 'CANALIZADO' : 'PROSPECTO'),
          sustancias: data.sustancias || []
        }
      });
    } else {
      // Crear nuevo paciente con el estado dictaminado
      const estadoFinal = data.esApto === true || data.esApto === 'true' ? 'PENDIENTE_INGRESO' : (data.esApto === false || data.esApto === 'false' ? 'CANALIZADO' : 'PROSPECTO');
      
      const paciente = await tx.paciente.create({
        data: {
          nombre: nombreFinal,
          apellidoPaterno: '',
          apellidoMaterno: '',
          fechaNacimiento: fechaNacimientoFinal,
          sexo: 'M',
          estado: estadoFinal,
          sustancias: data.sustancias || []
        }
      });
      pacienteIdToUse = paciente.id;
    }

    // 3. Crear el registro de Primer Contacto (Digitalización Literal 31 Puntos)
    const primerContacto = await tx.primerContacto.create({
      data: {
        pacienteId: pacienteIdToUse,
        usuarioId: usuarioId,
        // 1-3. Generales
        hora: data.hora,
        medioEnterado: data.medioEnterado,
        // 4-9. Datos del Solicitante
        nombreLlamada: data.nombreLlamada,
        lugarLlamada: data.lugarLlamada,
        domicilioLlamada: data.domicilioLlamada,
        telCasaLlamada: data.telCasaLlamada,
        celularLlamada: data.celularLlamada,
        ocupacionLlamada: data.ocupacionLlamada,
        // 10-19. Datos del Prospecto
        parentescoLlamada: data.parentescoLlamada,
        parentescoOtro: data.parentescoOtro,
        nombrePaciente: nombreFinal,
        edadPaciente: data.edadPaciente ? parseInt(data.edadPaciente as string, 10) : null,
        estadoCivilPaciente: data.estadoCivilPaciente,
        hijosPaciente: data.hijosPaciente ? parseInt(data.hijosPaciente as string, 10) : null,
        direccionPaciente: data.direccionPaciente,
        escolaridadPaciente: data.escolaridadPaciente,
        origenPaciente: data.origenPaciente,
        telefonoPaciente: data.telefonoPaciente,
        ocupacionPaciente: data.ocupacionPaciente,
        // 20. Sustancias
        sustancias: data.sustancias || [],
        sustanciasOtros: data.sustanciasOtros || [],
        // 21-23. Disposición y Antecedentes
        dispuestoInternarse: data.dispuestoInternarse,
        realizoIntervencion: data.realizoIntervencion,
        conclusionIntervencion: data.conclusionIntervencion,
        tratamientoPrevio: data.tratamientoPrevio,
        lugarTratamiento: data.lugarTratamiento,
        // 24. Otros
        posibilidadesEconomicas: data.posibilidadesEconomicas,
        // 25-29. Acuerdos Literales
        acuerdoLlamarle: data.acuerdoLlamarle === true || data.acuerdoLlamarle === 'true',
        acuerdoOtro: data.acuerdoOtro,
        acuerdoEsperarLlamada: data.acuerdoEsperarLlamada === true || data.acuerdoEsperarLlamada === 'true',
        acuerdoEsperarVisita: data.acuerdoEsperarVisita === true || data.acuerdoEsperarVisita === 'true',
        acuerdoPosibleIngreso: data.acuerdoPosibleIngreso === true || data.acuerdoPosibleIngreso === 'true',
        // CRM Tracking
        acuerdoSeguimiento: data.acuerdoSeguimiento || 'ESPERAR_LLAMADA',
        fechaAcuerdo: data.fechaAcuerdo ? new Date(data.fechaAcuerdo) : null,
        // 30-31. Cierre Médico
        medicoValoro: data.medicoValoro,
        conclusionMedica: data.conclusionMedica,
        // Dictamen de Admisiones
        esApto: data.esApto === true || data.esApto === 'true',
      }
    });

    return primerContacto;
  });

  res.status(201).json({ success: true, data: result });
};

export const getPrimerContactos = async (req: Request, res: Response) => {
  const { incluirInactivos } = req.query;
  const showAll = incluirInactivos === 'true';

  const contactos = await prisma.primerContacto.findMany({
    where: showAll ? {} : { activo: true },
    select: {
      id: true,
      nombreLlamada: true,
      celularLlamada: true,
      parentescoLlamada: true,
      medioEnterado: true,
      nombrePaciente: true,
      sustancias: true,
      createdAt: true,
      activo: true,
      // Acuerdos CRM
      acuerdoSeguimiento: true,
      fechaAcuerdo: true,
      // Acuerdos Literales
      acuerdoLlamarle: true,
      acuerdoEsperarLlamada: true,
      acuerdoEsperarVisita: true,
      acuerdoPosibleIngreso: true,
      paciente: {
        select: {
          id: true,
          nombre: true,
          apellidoPaterno: true,
          apellidoMaterno: true,
          sexo: true,
          fechaNacimiento: true,
          sustancias: true,
          estado: true
        }
      },
      usuario: { select: { nombre: true, apellidos: true } }
    },
    orderBy: { createdAt: 'desc' }
  });

  const privacyData = aplicarCapaPrivacidad(contactos);
  res.json({ success: true, data: privacyData });
};

export const getSustancias = async (req: Request, res: Response) => {
  const sustancias = await prisma.sustancia.findMany({
    where: { activo: true },
    orderBy: { nombre: 'asc' }
  });
  res.json({ success: true, data: sustancias });
};

/**
 * Agendar Cita de Seguimiento (CRM)
 * PATCH /api/v1/admisiones/primer-contacto/:id/agendar
 */
export const agendarCitaProspecto = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { fechaAcuerdo } = req.body;

  if (!fechaAcuerdo) {
    throw new AppError(400, 'La fecha de la cita es obligatoria');
  }

  // Normalizar fecha a mediodía local para evitar desfases UTC que cambien el día calendario
  const dateObj = new Date(fechaAcuerdo);
  const normalizedDate = new Date(
    dateObj.getFullYear(),
    dateObj.getMonth(),
    dateObj.getDate(),
    12, 0, 0
  );

  const updated = await prisma.primerContacto.update({
    where: { id: parseInt(id as string, 10) },
    data: {
      acuerdoSeguimiento: 'CITA_PROGRAMADA',
      fechaAcuerdo: normalizedDate
    }
  });

  res.json({ success: true, data: updated, message: 'Cita programada exitosamente' });
};

/**
 * Solicitar Valoración Médica (Transición a Área Clínica)
 * PATCH /api/v1/admisiones/paciente/:id/solicitar-valoracion
 */
export const solicitarValoracionMedica = async (req: Request, res: Response) => {
  const { id } = req.params;

  // 1. Verificar que el paciente existe
  const paciente = await prisma.paciente.findUnique({
    where: { id: parseInt(id as string, 10) }
  });

  if (!paciente) throw new AppError(404, 'Paciente no encontrado');

  // 2. Transicionar estado a EN_VALORACION
  const updated = await prisma.paciente.update({
    where: { id: parseInt(id as string, 10) },
    data: { estado: 'EN_VALORACION' }
  });

  res.json({ 
    success: true, 
    data: updated, 
    message: 'Paciente enviado a bandeja de Valoración Médica' 
  });
};

/**
 * Registrar Llegada del Prospecto a su Cita
 * PATCH /api/v1/admisiones/paciente/:id/confirmar-llegada
 */
export const registrarLlegadaCita = async (req: Request, res: Response) => {
  const { id } = req.params;

  // 1. Verificar que el paciente existe
  const paciente = await prisma.paciente.findUnique({
    where: { id: parseInt(id as string, 10) }
  });

  if (!paciente) throw new AppError(404, 'Paciente no encontrado');

  // 2. Transicionar estado a EN_VALORACION (Esto desbloquea valoraciones en el front)
  const updated = await prisma.paciente.update({
    where: { id: parseInt(id as string, 10) },
    data: { estado: 'EN_VALORACION' }
  });

  // 3. También buscamos si tiene una cita programada para marcarla o actualizar su acuerdo
  await prisma.primerContacto.updateMany({
    where: { 
      pacienteId: paciente.id,
      acuerdoSeguimiento: 'CITA_PROGRAMADA'
    },
    data: {
      acuerdoSeguimiento: 'POSIBLE_INGRESO' // O un estado que indique que ya está aquí
    }
  });

  res.json({ 
    success: true, 
    data: updated, 
    message: 'Llegada registrada. El paciente ahora puede ser valorado por el médico y trabajo social.' 
  });
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

export const getPrimerContactoByPacienteId = async (req: Request, res: Response) => {
  const { pacienteId } = req.params;
  
  const contacto = await prisma.primerContacto.findFirst({
    where: { 
      pacienteId: parseInt(pacienteId as string, 10),
      activo: true 
    },
    orderBy: { createdAt: 'desc' },
    include: {
      paciente: true,
      usuario: { select: { nombre: true, apellidos: true } }
    }
  });

  if (!contacto) throw new AppError(404, 'No se encontró un primer contacto para este paciente');
  res.json({ success: true, data: contacto });
};

export const updatePrimerContacto = async (req: Request, res: Response) => {
  const { id } = req.params;
  const data = req.body;

  const result = await prisma.primerContacto.update({
    where: { id: parseInt(id as string, 10) },
    data: {
      acuerdoOtro: data.acuerdoOtro,
      acuerdoEsperarLlamada: data.acuerdoEsperarLlamada,
      acuerdoEsperarVisita: data.acuerdoEsperarVisita,
      acuerdoPosibleIngreso: data.acuerdoPosibleIngreso,

      // 🔥 ESTO FALTABA
      acuerdoSeguimiento: data.acuerdoSeguimiento,
      fechaAcuerdo: data.fechaAcuerdo
        ? new Date(data.fechaAcuerdo)
        : undefined,

      posibilidadesEconomicas: data.posibilidadesEconomicas,
      medicoValoro: data.medicoValoro,
      conclusionMedica: data.conclusionMedica
    }
  });

  res.json({ success: true, data: result });
};

/**
 * Desactivar (Borrado Lógico) de un Prospecto
 * PATCH /api/v1/admisiones/primer-contacto/:id/desactivar
 */
export const desactivarPrimerContacto = async (req: Request, res: Response) => {
  const { id } = req.params;

  const updated = await prisma.primerContacto.update({
    where: { id: parseInt(id as string, 10) },
    data: { activo: false }
  });

  res.json({ success: true, data: updated, message: 'Prospecto archivado exitosamente' });
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
    select: {
      id: true,
      cumpleCriteriosInternamiento: true,
      aceptaInternarse: true,
      medicoNombre: true,
      fechaTentativaIngreso: true,
      createdAt: true,
      paciente: {
        select: {
          id: true,
          nombre: true,
          apellidoPaterno: true,
          apellidoMaterno: true,
          claveUnica: true
        }
      },
      usuario: { select: { nombre: true, apellidos: true } }
    },
  });

  const privacyData = aplicarCapaPrivacidad(valoraciones);
  res.json({ success: true, data: privacyData });
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
    select: {
      id: true,
      estado: true,
      pasoActual: true,
      fechaIngreso: true,
      areaAsignada: true,
      paciente: {
        select: {
          id: true,
          nombre: true,
          apellidoPaterno: true,
          apellidoMaterno: true,
          claveUnica: true
        }
      },
      usuario: { select: { nombre: true, apellidos: true } }
    },
  });

  const privacyData = aplicarCapaPrivacidad(ingresos);
  res.json({ success: true, data: privacyData });
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
// GESTIÓN DE CAMAS
// ============================================================

export const getCamas = async (req: Request, res: Response) => {
  const { area } = req.query;
  const filter: any = {};
  
  if (area) {
    filter.habitacion = {
      area: area as string
    };
  }

  const camas = await prisma.cama.findMany({
    where: filter,
    include: {
      habitacion: true,
      paciente: {
        select: {
          id: true,
          claveUnica: true,
          nombre: true,
          apellidoPaterno: true,
          apellidoMaterno: true
        }
      }
    },
    orderBy: { numero: 'asc' }
  });

  const privacyData = aplicarCapaPrivacidad(camas);
  res.json({ success: true, data: privacyData });
};

// ============================================================
// GESTIÓN DE SOLICITUDES DE INGRESO
// ============================================================

export const getSolicitudes = async (req: Request, res: Response) => {
  const solicitudes = await prisma.solicitudIngreso.findMany({
    select: {
      id: true,
      folio: true,
      estado: true,
      urgencia: true,
      createdAt: true,
      paciente: {
        select: {
          id: true,
          nombre: true,
          apellidoPaterno: true,
          apellidoMaterno: true,
          claveUnica: true
        }
      },
      solicitante: {
        select: {
          nombre: true,
          parentesco: true
        }
      },
      asignacionCama: {
        select: {
          id: true,
          cama: {
            select: { numero: true }
          }
        }
      }
    },
  });

  const privacyData = aplicarCapaPrivacidad(solicitudes);
  res.json({ success: true, data: privacyData });
};

export const getSolicitudByFolio = async (req: Request, res: Response) => {
  const { folio } = req.params;
  const solicitud = await prisma.solicitudIngreso.findUnique({
    where: { folio: folio as string },
    include: {
      paciente: true,
      solicitante: true,
      asignacionCama: {
        include: { cama: true }
      }
    }
  });

  if (!solicitud) throw new AppError(404, 'Solicitud no encontrada');
  res.json({ success: true, data: solicitud });
};

// ============================================================
// GESTIÓN DE SOLICITUDES DE INGRESO
// ============================================================

export const createSolicitud = async (req: Request, res: Response) => {
  const data = req.body;
  const usuarioId = req.usuario!.id;

  const currentYear = new Date().getFullYear();
  const count = await prisma.solicitudIngreso.count({
    where: { folio: { startsWith: `ADM-${currentYear}` } }
  });

  const folio = `ADM-${currentYear}-${String(count + 1).padStart(3, '0')}`;

  const result = await prisma.$transaction(async (tx) => {
    const normalizedCurp = data.curp?.trim()
      ? data.curp.trim().toUpperCase()
      : null;

    // =========================
    // PACIENTE
    // =========================
    let paciente;

    if (data.pacienteId) {
      paciente = await tx.paciente.update({
        where: { id: parseInt(data.pacienteId, 10) },
        data: {
          curp: normalizedCurp,
          tipoAdiccion: data.tipoAdiccion,
          motivoIngreso: data.motivoIngreso,
          areaDeseada: data.areaDeseada
        }
      });
    } else {
      try {
        paciente = await tx.paciente.create({
          data: {
            nombre: data.nombre,
            apellidoPaterno: data.apellidoPaterno,
            apellidoMaterno: data.apellidoMaterno,
            fechaNacimiento: new Date(data.fechaNacimiento),
            sexo: data.sexo,
            curp: normalizedCurp,
            tipoAdiccion: data.tipoAdiccion,
            motivoIngreso: data.motivoIngreso,
            areaDeseada: data.areaDeseada
          }
        });
      } catch (error: any) {
        if (error.code === 'P2002') {
          throw new AppError(400, 'El CURP ya está registrado');
        }
        throw error;
      }
    }

    // =========================
    // FAMILIAR
    // =========================
    let familiar = await tx.familiarResponsable.findUnique({
      where: { pacienteId: paciente.id }
    });

    if (familiar) {
      familiar = await tx.familiarResponsable.update({
        where: { id: familiar.id },
        data: {
          nombre: data.solicitanteNombre,
          parentesco: data.solicitanteParentesco,
          telefono: data.solicitanteTelefono,
          correo: data.solicitanteCorreo,
          municipio: data.solicitanteMunicipio,
          estado: data.solicitanteEstado
        }
      });
    } else {
      familiar = await tx.familiarResponsable.create({
        data: {
          pacienteId: paciente.id,
          nombre: data.solicitanteNombre,
          parentesco: data.solicitanteParentesco,
          telefono: data.solicitanteTelefono,
          correo: data.solicitanteCorreo,
          municipio: data.solicitanteMunicipio,
          estado: data.solicitanteEstado
        }
      });
    }

    // =========================
    // SOLICITUD
    // =========================
    const solicitud = await tx.solicitudIngreso.create({
      data: {
        folio,
        pacienteId: paciente.id,
        solicitanteId: familiar.id,
        creadoPorId: usuarioId,
        urgencia: data.urgencia || 'BAJA',
        observaciones: data.observaciones,
        estado: data.camaId ? 'APROBADA' : 'PENDIENTE'
      }
    });

    // =========================
    // INTERNAMIENTO DIRECTO
    // =========================
    if (data.camaId) {
      const camaId = parseInt(data.camaId, 10);

      // 1. Asignar cama
      await tx.asignacionCama.create({
        data: {
          solicitudId: solicitud.id,
          camaId,
          fechaIngresoEstimada: new Date(),
          medicoResponsableId: usuarioId,
          medicoResponsableNom: req.usuario?.nombre || 'Administración'
        }
      });

      // 2. Ocupar cama
      await tx.cama.update({
        where: { id: camaId },
        data: { estado: 'OCUPADA', pacienteId: paciente.id }
      });

      // 3. 🔥 CLAVE ÚNICA SEGURA
      await asignarClaveUnicaPaciente(paciente.id, tx);

      // 4. Estado paciente
      await tx.paciente.update({
        where: { id: paciente.id },
        data: { estado: 'INTERNADO' }
      });

      // 5. Expediente
      await tx.expediente.upsert({
        where: { pacienteId: paciente.id },
        update: {},
        create: { pacienteId: paciente.id }
      });

      // 6. Documentos
      const docsAdmin = [
        'Carátula','Reglamento general','Inventario de pertenencias',
        'Hoja de división','Hoja de ingreso','Aviso de privacidad',
        'Políticas','Consentimiento','Condiciones','Formato de info',
        'Derechos','Reglamento familiar','Estudio socioeconómico',
        'Convenios','Recibos y Gastos'
      ];

      const docsEval = [
        'Cuestionario ASSIST','Cuestionario de abuso de drogas',
        'Escala de dependencia al alcohol','Ludopatía'
      ];

      await tx.documentoExpediente.createMany({
        data: [
          ...docsAdmin.map(nombre => ({
            nombre,
            pacienteId: paciente.id,
            ubicacion: 'LADO_IZQ' as const,
            estado: 'PENDIENTE'
          })),
          ...docsEval.map(nombre => ({
            nombre,
            pacienteId: paciente.id,
            ubicacion: 'EVALUACIONES' as const,
            estado: 'PENDIENTE'
          }))
        ]
      });
    }

    return solicitud;
  });

  res.status(201).json({ success: true, data: result });
};

export const updateEstadoSolicitud = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { estado, motivoRechazo } = req.body;

  const solicitud = await prisma.solicitudIngreso.update({
    where: { id: parseInt(id as string, 10) },
    data: { estado, motivoRechazo }
  });

  res.json({ success: true, data: solicitud });
};

export const asignarCama = async (req: Request, res: Response) => {
  const { id } = req.params; // solicitudId
  const { camaId, fechaIngresoEstimada, observaciones, medicoId, medicoNombre } = req.body;

  const result = await prisma.$transaction(async (tx) => {
    // 1. Obtener solicitud
    const solicitud = await tx.solicitudIngreso.findUnique({
      where: { id: parseInt(id as string, 10) }
    });
    if (!solicitud) throw new Error('Solicitud no encontrada');

    // 2. Crear Asignación
    const asignacion = await tx.asignacionCama.create({
      data: {
        solicitudId: solicitud.id,
        camaId: parseInt(camaId as string, 10),
        fechaIngresoEstimada: new Date(fechaIngresoEstimada),
        observaciones,
        medicoResponsableId: parseInt(medicoId as string, 10),
        medicoResponsableNom: medicoNombre
      }
    });

    // 3. Actualizar Solicitud
    await tx.solicitudIngreso.update({
      where: { id: solicitud.id },
      data: { estado: 'APROBADA' }
    });

    // 4. Actualizar Cama
    await tx.cama.update({
      where: { id: parseInt(camaId as string, 10) },
      data: {
        estado: 'OCUPADA',
        pacienteId: solicitud.pacienteId
      }
    });

    // 5. Actualizar Paciente y Generar Clave Única
    // 5.3 Formalizar Expediente y Clave Única
    await asignarClaveUnicaPaciente(solicitud.pacienteId, tx);
    await tx.paciente.update({
      where: { id: solicitud.pacienteId },
      data: { estado: 'INTERNADO' }
    });

    // 6. Generar Checklist Automático de Documentos (15 Documentos)
    const documentosRequeridos = [
      'Carátula', 'Reglamento general', 'Inventario de pertenencias', 
      'Hoja de división', 'Hoja de ingreso', 'Aviso de privacidad', 
      'Políticas', 'Consentimiento', 'Condiciones', 'Formato de info', 
      'Derechos', 'Reglamento familiar', 'Estudio socioeconómico', 
      'Convenios', 'Recibos y Gastos'
    ];

    await tx.documentoExpediente.createMany({
      data: [
        ...documentosRequeridos.map(nombre => ({
          nombre,
          pacienteId: solicitud.pacienteId,
          ubicacion: 'LADO_IZQ' as const,
          estado: 'PENDIENTE'
        })),
        ...['Cuestionario ASSIST', 'Cuestionario de abuso de drogas', 'Escala de dependencia al alcohol', 'Ludopatía'].map(nombre => ({
          nombre,
          pacienteId: solicitud.pacienteId,
          ubicacion: 'EVALUACIONES' as const,
          estado: 'PENDIENTE'
        }))
      ]
    });

    // 7. Asegurar Expediente Clínico (Relación 1 a 1 con Paciente)
    // Usamos upsert para evitar errores si el paciente ya tiene un expediente (re-ingresos)
    await tx.expediente.upsert({
      where: { pacienteId: solicitud.pacienteId },
      update: {}, // No sobreescribimos datos clínicos viejos aquí por ahora
      create: { 
        pacienteId: solicitud.pacienteId 
      }
    });

    return asignacion;
  });

  res.json({ success: true, data: result });
};
