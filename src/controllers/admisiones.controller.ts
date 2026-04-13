import { Request, Response } from 'express';
import { prisma } from '../utils/prisma';
import { AppError } from '../middlewares/errorHandler';
import { generarSiguienteClaveUnica, aplicarCapaPrivacidad } from '../utils/paciente.utils';

export const createPrimerContacto = async (req: Request, res: Response) => {
  const data = req.body;
  const usuarioId = req.usuario!.id;

  const result = await prisma.$transaction(async (tx) => {
    // 1. Preparar datos del Paciente (Prospecto)
    const nombreFinal = data.nombrePaciente?.trim() || 'Prospecto Anónimo';
    const apPaternoFinal = data.apellidoPaterno?.trim() || '';
    const apMaternoFinal = data.apellidoMaterno?.trim() || '';
    
    // Si no hay fecha de nacimiento, usamos un placeholder (Integridad del modelo maestro)
    const fechaNacimientoFinal = data.fechaNacimiento 
      ? new Date(data.fechaNacimiento) 
      : new Date('1900-01-01');

    // 2. Crear o Vincular Paciente (Estado PROSPECTO por defecto)
    let pacienteIdToUse: number;

    if (data.pacienteId) {
      pacienteIdToUse = parseInt(data.pacienteId as string, 10);
    } else {
      // Intentar vincular por CURP solo si existe
      const normalizedCurp = data.curp && data.curp.trim() !== '' 
        ? data.curp.trim().toUpperCase() 
        : null;

      const pacienteExistente = normalizedCurp 
        ? await tx.paciente.findUnique({ where: { curp: normalizedCurp } })
        : null;

      if (pacienteExistente) {
        pacienteIdToUse = pacienteExistente.id;
        // Actualizar sustancias si vienen nuevas
        await tx.paciente.update({
          where: { id: pacienteExistente.id },
          data: {
            sustancias: data.sustancias || pacienteExistente.sustancias,
          }
        });
      } else {
        // Crear nuevo paciente
        const paciente = await tx.paciente.create({
          data: {
            nombre: nombreFinal,
            apellidoPaterno: apPaternoFinal,
            apellidoMaterno: apMaternoFinal,
            fechaNacimiento: fechaNacimientoFinal,
            sexo: data.sexo || 'M', // Por defecto Masculino si no viene
            curp: normalizedCurp,
            sustancias: data.sustancias || [],
            estado: 'PROSPECTO'
          }
        });
        pacienteIdToUse = paciente.id;
      }
    }

    // 3. Crear el registro de Primer Contacto (Simplificado)
    const primerContacto = await tx.primerContacto.create({
      data: {
        pacienteId: pacienteIdToUse,
        usuarioId: usuarioId,
        fuenteReferencia: data.fuenteReferencia,
        solicitanteNombre: data.solicitanteNombre,
        solicitanteTelefono: data.solicitanteTelefono,
        relacionPaciente: data.relacionPaciente,
        edad: data.edad ? parseInt(data.edad as string, 10) : null,
        sustancias: data.sustancias || [],
        acuerdoSeguimiento: data.acuerdoSeguimiento,
        fechaSeguimiento: data.fechaSeguimiento ? new Date(data.fechaSeguimiento) : null,
        observaciones: data.observaciones
      }
    });

    return primerContacto;
  });

  res.status(201).json({ success: true, data: result });
};

export const getPrimerContactos = async (req: Request, res: Response) => {
  const contactos = await prisma.primerContacto.findMany({
    select: {
      id: true,
      solicitanteNombre: true,
      solicitanteTelefono: true,
      relacionPaciente: true,
      dia: true,
      fuenteReferencia: true,
      acuerdoSeguimiento: true,
      fechaSeguimiento: true,
      createdAt: true,
      paciente: {
        select: {
          id: true,
          nombre: true,
          apellidoPaterno: true,
          apellidoMaterno: true,
          sexo: true,
          fechaNacimiento: true,
          sustancias: true
        }
      },
      usuario: { select: { nombre: true, apellidos: true } }
    },
    orderBy: { createdAt: 'desc' }
  });

  const privacyData = aplicarCapaPrivacidad(contactos);
  res.json({ success: true, data: privacyData });
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

export const updatePrimerContacto = async (req: Request, res: Response) => {
  const { id } = req.params;
  const data = req.body;

  const result = await prisma.primerContacto.update({
    where: { id: parseInt(id as string, 10) },
    data: {
      acuerdoSeguimiento: data.acuerdoSeguimiento,
      fechaSeguimiento: data.fechaSeguimiento ? new Date(data.fechaSeguimiento) : undefined,
      observaciones: data.observaciones
    }
  });

  res.json({ success: true, data: result });
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

export const createSolicitud = async (req: Request, res: Response) => {
  const data = req.body;
  const usuarioId = req.usuario!.id;

  // 1. Generar Folio ADM-YYYY-NNN
  const currentYear = new Date().getFullYear();
  const count = await prisma.solicitudIngreso.count({
    where: {
      folio: { startsWith: `ADM-${currentYear}` }
    }
  });
  const folio = `ADM-${currentYear}-${String(count + 1).padStart(3, '0')}`;

  const result = await prisma.$transaction(async (tx) => {
    // 1.1 Normalización de CURP (Replicando lógica de Primer Contacto)
    const normalizedCurp = data.curp && data.curp.trim() !== '' 
      ? data.curp.trim().toUpperCase() 
      : null;

    // 2. Buscar o crear paciente
    let paciente;
    if (data.pacienteId) {
      paciente = await tx.paciente.update({
        where: { id: parseInt(data.pacienteId as string, 10) },
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
          throw new AppError(400, 'El CURP ingresado ya está registrado en el sistema');
        }
        throw error;
      }
    }

    // 3. Buscar o crear Familiar (Solicitante)
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

    // 4. Crear Solicitud
    const solicitud = await tx.solicitudIngreso.create({
      data: {
        folio,
        pacienteId: paciente.id,
        solicitanteId: familiar.id,
        creadoPorId: usuarioId,
        urgencia: data.urgencia || 'BAJA',
        observaciones: data.observaciones,
        // Si ya viene con cama, la solicitud se aprueba automáticamente
        estado: data.camaId ? 'APROBADA' : 'PENDIENTE'
      }
    });

    // 5. FLUJO EXTRA: Internamiento Formal Inmediato (Si se seleccionó cama)
    if (data.camaId) {
      // 5.1 Asignación de Cama
      await tx.asignacionCama.create({
        data: {
          solicitudId: solicitud.id,
          camaId: parseInt(data.camaId as string, 10),
          fechaIngresoEstimada: new Date(),
          medicoResponsableId: usuarioId, // Por ahora el que lo interna
          medicoResponsableNom: req.usuario?.nombre || 'Administración'
        }
      });

      // 5.2 Ocupar Cama
      await tx.cama.update({
        where: { id: parseInt(data.camaId as string, 10) },
        data: { 
          estado: 'OCUPADA', 
          pacienteId: paciente.id 
        }
      });

      // 5.3 Formalizar Expediente y Clave Única
      const claveUnica = await generarSiguienteClaveUnica(tx);
      await tx.paciente.update({
        where: { id: paciente.id },
        data: { 
          estado: 'INTERNADO',
          claveUnica: claveUnica
        }
      });

      // 5.4 Crear Expediente Clínico
      await tx.expediente.upsert({
        where: { pacienteId: paciente.id },
        update: {},
        create: { pacienteId: paciente.id }
      });

      // 5.5 Generar Checklist de 19 Documentos
      const docsAdmin = [
        'Carátula', 'Reglamento general', 'Inventario de pertenencias', 
        'Hoja de división', 'Hoja de ingreso', 'Aviso de privacidad', 
        'Políticas', 'Consentimiento', 'Condiciones', 'Formato de info', 
        'Derechos', 'Reglamento familiar', 'Estudio socioeconómico', 
        'Convenios', 'Recibos y Gastos'
      ];
      const docsEval = [
        'Cuestionario ASSIST', 'Cuestionario de abuso de drogas', 
        'Escala de dependencia al alcohol', 'Ludopatía'
      ];

      await tx.documentoExpediente.createMany({
        data: [
          ...docsAdmin.map(nombre => ({
            nombre,
            pacienteId: paciente.id,
            ubicacion: 'LADO_IZQ' as any,
            estado: 'PENDIENTE' as any
          })),
          ...docsEval.map(nombre => ({
            nombre,
            pacienteId: paciente.id,
            ubicacion: 'EVALUACIONES' as any,
            estado: 'PENDIENTE' as any
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
    const claveUnica = await generarSiguienteClaveUnica(tx);
    await tx.paciente.update({
      where: { id: solicitud.pacienteId },
      data: { 
        estado: 'INTERNADO',
        claveUnica: claveUnica
      }
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
          estado: 'PENDIENTE' as const
        })),
        ...['Cuestionario ASSIST', 'Cuestionario de abuso de drogas', 'Escala de dependencia al alcohol', 'Ludopatía'].map(nombre => ({
          nombre,
          pacienteId: solicitud.pacienteId,
          ubicacion: 'EVALUACIONES' as const,
          estado: 'PENDIENTE' as const
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
