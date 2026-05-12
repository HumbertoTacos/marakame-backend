import { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { prisma } from '../utils/prisma';
import { AppError } from '../middlewares/errorHandler';
import { crearNotificacion } from '../utils/notificaciones';

// ============================================================
// EMPLEADOS
// ============================================================

export const createEmpleado = async (req: Request, res: Response) => {
  const { numeroEmpleado, nombre, apellidos, puesto, departamento, regimen, salarioBase, compensacionFija } = req.body;
  
  const empleado = await prisma.empleado.create({
    data: {
      numeroEmpleado,
      nombre,
      apellidos,
      puesto,
      departamento,
      regimen: regimen || 'CONFIANZA',
      salarioBase: parseFloat(salarioBase),
      compensacionFija: parseFloat(compensacionFija || 0)
    }
  });
  res.status(201).json({ success: true, data: empleado });
};

export const getEmpleados = async (req: Request, res: Response) => {
  const empleados = await prisma.empleado.findMany({
    orderBy: { nombre: 'asc' }
  });
  res.json({ success: true, data: empleados });
};

export const updateEmpleado = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      return res.status(400).json({ success: false, message: 'ID inválido.' });
    }

    const { nombre, apellidos, puesto, departamento, regimen, salarioBase, compensacionFija, activo } = req.body;

    // Sólo actualizamos campos que vienen en el body — así un toggle de activo no borra el sueldo.
    const data: any = {};
    if (nombre !== undefined)           data.nombre = String(nombre).trim();
    if (apellidos !== undefined)        data.apellidos = String(apellidos).trim();
    if (puesto !== undefined)           data.puesto = String(puesto).trim();
    if (departamento !== undefined)     data.departamento = String(departamento).trim();
    if (regimen !== undefined)          data.regimen = regimen;
    if (salarioBase !== undefined)      data.salarioBase = parseFloat(salarioBase);
    if (compensacionFija !== undefined) data.compensacionFija = parseFloat(compensacionFija);
    if (activo !== undefined)           data.activo = Boolean(activo);

    if (Object.keys(data).length === 0) {
      return res.status(400).json({ success: false, message: 'No hay datos para actualizar.' });
    }

    const empleado = await prisma.empleado.update({ where: { id }, data });
    res.json({ success: true, data: empleado });
  } catch (error: any) {
    if (error?.code === 'P2025') {
      return res.status(404).json({ success: false, message: 'Empleado no encontrado.' });
    }
    console.error('Error al actualizar empleado:', error);
    res.status(500).json({ success: false, message: 'Error interno al actualizar empleado', detalle: error.message });
  }
};

// ============================================================
// NÓMINA GENERAL (CICLOS)
// ============================================================

export const generarNomina = async (req: Request, res: Response) => {
  try {
    // El archivo de CONTPAQi llega en req.file (multipart/form-data).
    // El cuerpo trae: periodo, fechaInicio, fechaFin, regimen.
    const { periodo, fechaInicio, fechaFin, regimen } = req.body;

    if (!periodo || !fechaInicio || !fechaFin) {
      return res.status(400).json({ success: false, message: 'Faltan datos del periodo.' });
    }

    const archivo = (req as any).file as Express.Multer.File | undefined;
    if (!archivo) {
      return res.status(400).json({ success: false, message: 'Debes adjuntar el archivo de CONTPAQi.' });
    }

    // 1. Generar Folio
    const currentYear = new Date().getFullYear();
    const count = await prisma.nomina.count({
      where: { folio: { startsWith: `NOM-${currentYear}` } }
    });
    const folio = `NOM-${currentYear}-${String(count + 1).padStart(3, '0')}`;

    // 2. Crear la Nómina principal.
    // Estado inicial PRE_NOMINA: RH subió el archivo, ahora pasa a Finanzas para solicitar subsidio.
    // No calculamos nada por empleado; los totales y el desglose viven en el archivo de CONTPAQi.
    // RH NO firma aquí: su firma es al final del flujo cuando ya recibió la nómina firmada por el trabajador.
    const nomina = await prisma.nomina.create({
      data: {
        folio,
        periodo,
        fechaInicio: new Date(fechaInicio),
        fechaFin: new Date(fechaFin),
        estado: 'PRE_NOMINA',
        regimen: regimen || null,
        archivoUrl: `/uploads/nominas/${archivo.filename}`
      }
    });

    // Notifica a quien debe actuar (Finanzas) y a quienes deben enterarse (Administración / RH).
    const notifMsg = `Pre-nómina ${folio} (${periodo}) subida por RH. Esperando documento de subsidio.`;
    const notifLink = `/nominas/${nomina.id}`;
    await Promise.all([
      crearNotificacion({ rol: 'RECURSOS_FINANCIEROS' as any, titulo: 'Nueva pre-nómina pendiente', mensaje: notifMsg, link: notifLink, tipo: 'ALERTA' as any }),
      crearNotificacion({ rol: 'RRHH_FINANZAS' as any,       titulo: 'Nueva pre-nómina pendiente', mensaje: notifMsg, link: notifLink, tipo: 'INFO' as any }),
      crearNotificacion({ rol: 'JEFE_ADMINISTRATIVO' as any, titulo: 'Nueva pre-nómina iniciada', mensaje: notifMsg, link: notifLink, tipo: 'INFO' as any })
    ]);

    res.status(201).json({ success: true, data: nomina });

  } catch (error: any) {
    console.error("🔥🔥🔥 ERROR EXACTO EN EL BACKEND:", error.message);
    res.status(500).json({
      success: false,
      message: "Falló la creación en BD",
      detalle: error.message
    });
  }
};

export const getNominas = async (req: Request, res: Response) => {
  // CORRECCIÓN: Quitamos el filtro 'not: AUTORIZADO'. Ahora manda TODO a React.
  const nominas = await prisma.nomina.findMany({
    include: {
      usuarioAutoriza: { select: { nombre: true, apellidos: true } },
      prenominas: { include: { empleado: true } }
    },
    orderBy: { createdAt: 'desc' }
  });
  res.json({ success: true, data: nominas });
};

// ============================================================
// FLUJO DE FIRMAS (NUEVO Y AUTOMATIZADO)
// ============================================================
export const firmarNomina = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const rolUsuario = req.usuario!.rol;

    const nomina = await prisma.nomina.findUnique({ where: { id: Number(id) } });
    if (!nomina) return res.status(404).json({ success: false, message: 'Nómina no encontrada' });

    // Secuencia oficial del manual: Finanzas → Jefatura Administrativa → Dirección General → cierre RH.
    // Cada paso lo firma su rol específico. Mantenemos compatibilidad con el rol legacy RRHH_FINANZAS
    // y con ADMIN_GENERAL (que actúa como super-admin con permisos de cualquier paso).

    // Flujo simplificado. admin@marakame.com NO participa.
    // - Finanzas (paso 1): RECURSOS_FINANCIEROS o RRHH_FINANZAS
    // - Jefatura Administrativa (paso 2): SÓLO JEFE_ADMINISTRATIVO firma y manda la lista a RH
    // - RH cierre (paso 3): RECURSOS_HUMANOS o RRHH_FINANZAS
    const esFinanzas = rolUsuario === 'RECURSOS_FINANCIEROS' || rolUsuario === 'RRHH_FINANZAS';
    const esAdministracion = rolUsuario === 'JEFE_ADMINISTRATIVO';
    const esRH = rolUsuario === 'RECURSOS_HUMANOS' || rolUsuario === 'RRHH_FINANZAS';

    let firmaACambiar: 'firmaFinanzas' | 'firmaAdministracion' | 'firmaRecursosHumanos' | null = null;
    let etiquetaPaso = '';

    if (!nomina.firmaFinanzas) {
      // Paso 1: Recursos Financieros recibe la pre-nómina y elabora la solicitud de subsidio
      if (esFinanzas) {
        firmaACambiar = 'firmaFinanzas';
        etiquetaPaso = 'Recursos Financieros (solicitud de subsidio)';
      }
    } else if (!nomina.firmaAdministracion) {
      // Paso 2: Administración General revisa y autoriza (cubre Jefatura + Dirección).
      // Requisito: debe haber subido antes el reporte de asistencias quincenal firmado.
      if (esAdministracion) {
        if (!nomina.archivoAsistenciasUrl) {
          return res.status(400).json({
            success: false,
            message: 'Antes de firmar, Administración debe subir el reporte de asistencias quincenal firmado.'
          });
        }
        firmaACambiar = 'firmaAdministracion';
        etiquetaPaso = 'Administración General (revisión y autorización)';
      }
    } else if (!nomina.firmaRecursosHumanos) {
      // Paso 3: Recursos Humanos cierra el ciclo subiendo la nómina firmada por el trabajador.
      if (esRH) {
        firmaACambiar = 'firmaRecursosHumanos';
        etiquetaPaso = 'Recursos Humanos (cierre del ciclo)';
      }
    } else {
      return res.status(400).json({ success: false, message: 'La nómina ya tiene todas las firmas registradas.' });
    }

    if (!firmaACambiar) {
      return res.status(403).json({
        success: false,
        message: 'Tu rol no puede firmar el paso actual del flujo.'
      });
    }

    const dataToUpdate: any = { [firmaACambiar]: true };

    // Cambios de estado a lo largo del flujo:
    // PRE_NOMINA → SOLICITUD_SUBSIDIO al firmar Finanzas
    // SOLICITUD_SUBSIDIO → AUTORIZADO al firmar Administración (cubre Jefatura + Dirección)
    // AUTORIZADO se mantiene cuando RH cierra; el archivado lo pasa a PAGADO.
    if (firmaACambiar === 'firmaFinanzas') {
      dataToUpdate.estado = 'SOLICITUD_SUBSIDIO';
      dataToUpdate.fechaSolicitudSubsidio = new Date();
    } else if (firmaACambiar === 'firmaAdministracion') {
      // Auto-firma de Dirección: el rol admin ya no participa, queda implícito en Administración.
      dataToUpdate.firmaDireccion = true;
      dataToUpdate.estado = 'AUTORIZADO';
      dataToUpdate.fechaAutorizacion = new Date();
      dataToUpdate.usuarioAutorizaId = req.usuario!.id;
    }

    const actualizada = await prisma.nomina.update({
      where: { id: Number(id) },
      data: dataToUpdate
    });

    // Notificar al siguiente paso del flujo.
    const link3 = `/nominas/${actualizada.id}`;
    if (firmaACambiar === 'firmaAdministracion') {
      // Administración firmó → RH debe subir la nómina firmada por el trabajador.
      const msg = `Pre-nómina ${actualizada.folio} autorizada. RH debe subir la nómina firmada por el trabajador.`;
      await Promise.all([
        crearNotificacion({ rol: 'RECURSOS_HUMANOS' as any, titulo: 'Pre-nómina autorizada', mensaje: msg, link: link3, tipo: 'ALERTA' as any }),
        crearNotificacion({ rol: 'RRHH_FINANZAS' as any,    titulo: 'Pre-nómina autorizada', mensaje: msg, link: link3, tipo: 'INFO' as any })
      ]);
    } else if (firmaACambiar === 'firmaFinanzas') {
      // Caso fallback (firmar sin subir subsidio) — notifica a administración.
      const msg = `Pre-nómina ${actualizada.folio} firmada por Finanzas. Esperando revisión de Administración.`;
      await Promise.all([
        crearNotificacion({ rol: 'RRHH_FINANZAS' as any,       titulo: 'Pre-nómina pendiente de firma', mensaje: msg, link: link3, tipo: 'ALERTA' as any }),
        crearNotificacion({ rol: 'JEFE_ADMINISTRATIVO' as any, titulo: 'Pre-nómina pendiente de firma', mensaje: msg, link: link3, tipo: 'ALERTA' as any })
      ]);
    }

    res.json({
      success: true,
      message: `Firma de ${etiquetaPaso} registrada.`,
      data: actualizada
    });
  } catch (error: any) {
    console.error("Error al firmar:", error);
    res.status(500).json({ success: false, message: 'Error interno al firmar', detalle: error.message });
  }
};


export const autorizarNomina = async (req: Request, res: Response) => {
  const { id } = req.params;
  const usuarioId = req.usuario!.id;

  const nominaBase = await prisma.nomina.findUnique({ 
    where: { id: parseInt(id as string, 10) }
  });
  
  if (!nominaBase) throw new AppError(404, 'Nómina no encontrada');

  const nomina = await prisma.nomina.update({
    where: { id: parseInt(id as string, 10) },
    data: {
      estado: 'AUTORIZADO',
      usuarioAutorizaId: usuarioId,
      fechaAutorizacion: new Date(),
    }
  });

  res.json({ success: true, data: nomina });
};

// ============================================================
// PRE-NÓMINAS (Cálculos individuales por empleado)
// ============================================================

export const updatePreNomina = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { 
    diasTrabajados, horasExtra, 
    otrasPercepciones, 
    descuentoIncidencias, otrasDeducciones, 
    incidencias, reciboFirmado 
  } = req.body;

  const preNomina = await prisma.preNomina.findUnique({ where: { id: parseInt(id as string, 10) } });
  if (!preNomina) throw new AppError(404, 'Pre-Nómina no encontrada');

  const newDias = diasTrabajados !== undefined ? parseFloat(diasTrabajados) : preNomina.diasTrabajados;
  const newOtrasPerc = otrasPercepciones !== undefined ? parseFloat(otrasPercepciones) : preNomina.otrasPercepciones;
  const newDescuentosInc = descuentoIncidencias !== undefined ? parseFloat(descuentoIncidencias) : preNomina.descuentoIncidencias;
  const newOtrasDeduc = otrasDeducciones !== undefined ? parseFloat(otrasDeducciones) : preNomina.otrasDeducciones;

  const baseReducida = (preNomina.sueldoBruto / 15) * newDias;
  const totalPercepciones = baseReducida + preNomina.compensacion + newOtrasPerc;
  const totalDeducciones = preNomina.retencionISR + newDescuentosInc + newOtrasDeduc;
  const nuevoTotal = totalPercepciones - totalDeducciones;

  const preUpdate = await prisma.preNomina.update({
    where: { id: parseInt(id as string, 10) },
    data: {
      diasTrabajados: newDias,
      horasExtra: horasExtra !== undefined ? parseFloat(horasExtra) : preNomina.horasExtra,
      otrasPercepciones: newOtrasPerc,
      totalPercepciones,
      descuentoIncidencias: newDescuentosInc,
      otrasDeducciones: newOtrasDeduc,
      totalDeducciones,
      totalAPagar: nuevoTotal,
      incidencias: incidencias !== undefined ? incidencias : preNomina.incidencias,
      reciboFirmado: reciboFirmado !== undefined ? reciboFirmado : preNomina.reciboFirmado
    }
  });
  
  res.json({ success: true, data: preUpdate });
};


export const actualizarPreNomina = async (req: Request, res: Response) => {
  try {
    const { id } = req.params; 
    
    const { 
      sueldoBruto, 
      compensacion, 
      horasExtra, 
      otrasPercepciones, 
      retencionISR, 
      descuentoIncidencias, 
      otrasDeducciones 
    } = req.body;

    // 1. Recalcular los totales individuales del empleado
    const totalPercepciones = 
      Number(sueldoBruto || 0) + 
      Number(compensacion || 0) + 
      Number(horasExtra || 0) + 
      Number(otrasPercepciones || 0);

    const totalDeducciones = 
      Number(retencionISR || 0) + 
      Number(descuentoIncidencias || 0) + 
      Number(otrasDeducciones || 0);

    const totalAPagar = totalPercepciones - totalDeducciones;

    // 2. Actualizar el registro individual (PreNómina)
    const preNominaActualizada = await prisma.preNomina.update({
      where: { id: Number(id) },
      data: {
        sueldoBruto: Number(sueldoBruto),
        compensacion: Number(compensacion),
        horasExtra: Number(horasExtra),
        otrasPercepciones: Number(otrasPercepciones),
        retencionISR: Number(retencionISR),
        descuentoIncidencias: Number(descuentoIncidencias),
        otrasDeducciones: Number(otrasDeducciones),
        totalPercepciones,
        totalDeducciones,
        totalAPagar
      }
    });

    // --- MAGIA AUTOMÁTICA: RECALCULAR LA NÓMINA GENERAL ---
    const nominaId = preNominaActualizada.nominaId;

    // 3. Sumar todos los recibos que pertenecen a esta misma Nómina
    const sumatorias = await prisma.preNomina.aggregate({
      where: { nominaId: nominaId },
      _sum: {
        totalPercepciones: true,
        totalDeducciones: true,
        totalAPagar: true
      }
    });

    // 4. Actualizar la Nómina principal con los nuevos grandes totales
    await prisma.nomina.update({
      where: { id: nominaId },
      data: {
        totalPercepciones: sumatorias._sum.totalPercepciones || 0,
        totalDeducciones: sumatorias._sum.totalDeducciones || 0,
        totalNetoPagar: sumatorias._sum.totalAPagar || 0
      }
    });
    // -------------------------------------------------------

    res.status(200).json({ 
      success: true, 
      message: "Recibo actualizado y totales generales recalculados correctamente",
      data: preNominaActualizada 
    });

  } catch (error: any) {
    console.error("ERROR AL ACTUALIZAR PRENOMINA:", error.message);
    res.status(500).json({ 
      success: false, 
      message: "Falló la actualización del recibo", 
      detalle: error.message 
    });
  }
};

export const getNominaById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const nomina = await prisma.nomina.findUnique({
      where: { id: Number(id) },
      include: { 
        prenominas: { 
          include: { empleado: true }
        } 
      }
    });

    if (!nomina) {
      return res.status(404).json({ success: false, message: "Nómina no encontrada" });
    }

    res.status(200).json({ success: true, data: nomina });
  } catch (error: any) {
    res.status(500).json({ success: false, message: "Error al buscar la nómina", detalle: error.message });
  }
};

export const archivarNomina = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    const nomina = await prisma.nomina.update({
      where: { id: Number(id) },
      data: { estado: 'PAGADO' } // Cambia a estado terminal
    });

    res.json({ success: true, message: 'Nómina archivada y cerrada.', data: nomina });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Error al archivar la nómina', detalle: error.message });
  }
};

// ============================================================
// CONTROL DE ASISTENCIAS DIARIAS
// ============================================================

export const guardarAsistencias = async (req: Request, res: Response) => {
  try {
    // El body viene como multipart/form-data: `fecha` es string, `registros` viene como JSON string,
    // y los archivos llegan en req.files con fieldname `archivo_<empleadoId>`.
    const { fecha } = req.body;
    const usuarioId = req.usuario!.id;

    let registros: any[] = [];
    try {
      registros = typeof req.body.registros === 'string'
        ? JSON.parse(req.body.registros)
        : (req.body.registros || []);
    } catch {
      return res.status(400).json({ success: false, message: 'Formato inválido en `registros`.' });
    }

    if (!fecha || !Array.isArray(registros) || registros.length === 0) {
      return res.status(400).json({ success: false, message: 'Faltan datos: fecha o registros.' });
    }

    // Indexamos archivos subidos por empleadoId (fieldname = archivo_<id>)
    const archivosPorEmpleado: Record<string, string> = {};
    const files = (req.files as Express.Multer.File[]) || [];
    for (const f of files) {
      const match = f.fieldname.match(/^archivo_(\d+)$/);
      if (match) {
        archivosPorEmpleado[match[1]] = `/uploads/justificantes/${f.filename}`;
      }
    }

    // 1. Buscar la Nómina que esté actualmente en curso (opcional).
    // Si no hay nómina abierta, igual se registra la asistencia: el control diario
    // es independiente del ciclo de nómina y debe poder hacerse cualquier día.
    const nominaActiva = await prisma.nomina.findFirst({
      where: {
        estado: { in: ['BORRADOR', 'PRE_NOMINA', 'EN_REVISION'] }
      },
      orderBy: { id: 'desc' }
    });

    // 2. Bloqueo: si ya hay registros para alguno de estos empleados en la fecha, rechazamos.
    const fechaInicio = new Date(fecha);
    fechaInicio.setUTCHours(0, 0, 0, 0);
    const fechaFin = new Date(fecha);
    fechaFin.setUTCHours(23, 59, 59, 999);

    const empleadoIds = registros.map((r: any) => Number(r.empleadoId)).filter(Number.isFinite);
    const yaRegistrados = await prisma.registroAsistencia.findMany({
      where: {
        empleadoId: { in: empleadoIds },
        fecha: { gte: fechaInicio, lte: fechaFin }
      },
      select: { empleadoId: true }
    });

    if (yaRegistrados.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'La asistencia de hoy ya fue capturada para este grupo. No se puede volver a registrar el mismo día.',
        empleadosBloqueados: yaRegistrados.map(r => r.empleadoId)
      });
    }

    // 3. Preparar los datos (incluyendo URL del documento si subieron archivo).
    // Regla del estadoJustificacion:
    //   - ASISTENCIA → NO_APLICA (no hay incidencia que justificar)
    //   - FALTA/RETARDO + el jefe dijo que SÍ tiene justificante → PENDIENTE (admin debe revisar)
    //   - FALTA/RETARDO + el jefe dijo que NO tiene justificante → RECHAZADA (es falta directa, sin nada que revisar)
    const datosAInsertar = registros.map((reg: any) => {
      let estadoJustificacion: 'NO_APLICA' | 'PENDIENTE' | 'RECHAZADA' = 'NO_APLICA';
      if (reg.tipo !== 'ASISTENCIA') {
        estadoJustificacion = reg.quiereJustificar === true ? 'PENDIENTE' : 'RECHAZADA';
      }
      // Omitimos `nominaId` cuando no hay nómina abierta (la columna es opcional en BD).
      const base: any = {
        fecha: new Date(fecha),
        tipo: reg.tipo,
        motivoJustificacion: reg.quiereJustificar ? (reg.motivo || null) : null,
        documentoUrl: archivosPorEmpleado[String(reg.empleadoId)] || null,
        estadoJustificacion,
        empleadoId: Number(reg.empleadoId),
        registradoPorId: usuarioId
      };
      if (nominaActiva) base.nominaId = nominaActiva.id;
      return base;
    });

    // 4. Guardar en la base de datos
    const resultado = await prisma.registroAsistencia.createMany({
      data: datosAInsertar as any,
      skipDuplicates: true
    });

    res.json({
      success: true,
      message: `Se guardaron ${resultado.count} registros de asistencia.`,
      data: resultado
    });

  } catch (error: any) {
    console.error("Error al guardar asistencias:", error);
    res.status(500).json({ success: false, message: 'Error interno al guardar asistencias', detalle: error.message });
  }
};

// Recursos Financieros sube el documento de solicitud de subsidio.
// Esto AUTO-firma el paso de Finanzas y avanza el estado a SOLICITUD_SUBSIDIO.
export const subirSubsidio = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const archivo = (req as any).file as Express.Multer.File | undefined;
    if (!archivo) {
      return res.status(400).json({ success: false, message: 'Debes adjuntar el documento de subsidio.' });
    }

    const nomina = await prisma.nomina.findUnique({ where: { id: Number(id) } });
    if (!nomina) return res.status(404).json({ success: false, message: 'Nómina no encontrada.' });
    if (nomina.firmaFinanzas) {
      return res.status(400).json({ success: false, message: 'Esta nómina ya tiene firma de Finanzas.' });
    }

    const actualizada = await prisma.nomina.update({
      where: { id: Number(id) },
      data: {
        archivoSubsidioUrl: `/uploads/nominas/${archivo.filename}`,
        firmaFinanzas: true,
        estado: 'SOLICITUD_SUBSIDIO',
        fechaSolicitudSubsidio: new Date()
      }
    });

    // Notifica al siguiente paso: Administración General y Jefatura Administrativa.
    const msg2 = `Pre-nómina ${actualizada.folio} (${actualizada.periodo}) con subsidio listo. Esperando tu firma.`;
    const link2 = `/nominas/${actualizada.id}`;
    await Promise.all([
      crearNotificacion({ rol: 'RRHH_FINANZAS' as any,       titulo: 'Pre-nómina pendiente de firma', mensaje: msg2, link: link2, tipo: 'ALERTA' as any }),
      crearNotificacion({ rol: 'JEFE_ADMINISTRATIVO' as any, titulo: 'Pre-nómina pendiente de firma', mensaje: msg2, link: link2, tipo: 'ALERTA' as any })
    ]);

    res.json({ success: true, message: 'Documento de subsidio subido y firma de Finanzas aplicada.', data: actualizada });
  } catch (error: any) {
    console.error('Error subiendo subsidio:', error);
    res.status(500).json({ success: false, message: 'Error interno', detalle: error.message });
  }
};

// Jefatura Administrativa firma su paso y manda la lista de asistencias quincenal a RH.
// Genera el CSV de asistencias del periodo de la nómina DESDE LA BD (sin subir nada manualmente),
// lo guarda en /uploads/nominas y aplica la firma de Administración → estado AUTORIZADO.
export const enviarAsistenciasARH = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);

    const nomina = await prisma.nomina.findUnique({ where: { id } });
    if (!nomina) return res.status(404).json({ success: false, message: 'Nómina no encontrada.' });
    if (!nomina.firmaFinanzas) {
      return res.status(400).json({ success: false, message: 'Finanzas debe firmar primero (subir documento de subsidio) antes de Administración.' });
    }
    // Si ya tiene firma de Administración pero NO tiene archivo de asistencias (residuo de bugs previos),
    // permitimos regenerar el archivo. Si ya tiene archivo Y firma, rechazamos para no duplicar.
    const yaFirmadoConArchivo = nomina.firmaAdministracion && (nomina as any).archivoAsistenciasUrl;
    if (yaFirmadoConArchivo) {
      return res.status(400).json({ success: false, message: 'Esta nómina ya tiene firma de Administración y archivo de asistencias.' });
    }

    // 1. Consulta asistencias del periodo de la nómina (rango fechaInicio → fechaFin, inclusivo)
    const inicio = new Date(nomina.fechaInicio); inicio.setUTCHours(0, 0, 0, 0);
    const fin    = new Date(nomina.fechaFin);    fin.setUTCHours(23, 59, 59, 999);
    const asistencias = await prisma.registroAsistencia.findMany({
      where: { fecha: { gte: inicio, lte: fin } },
      include: { empleado: true },
      orderBy: [{ fecha: 'asc' }]
    });

    // 2. Construye el CSV
    const escapeCsv = (s: any) => {
      const v = (s ?? '').toString();
      return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
    };
    const formatFecha = (d: Date) => {
      const y = d.getUTCFullYear();
      const m = String(d.getUTCMonth() + 1).padStart(2, '0');
      const day = String(d.getUTCDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    };

    const lineas: string[] = [];
    lineas.push(`REPORTE DE ASISTENCIAS - ${nomina.periodo}`);
    lineas.push(`Folio nómina: ${nomina.folio}`);
    lineas.push(`Periodo: ${formatFecha(inicio)} a ${formatFecha(fin)}`);
    lineas.push('');
    lineas.push('Departamento,Empleado,Puesto,Fecha,Tipo,Justificación,Motivo');

    for (const a of asistencias) {
      const emp = a.empleado;
      const fila = [
        escapeCsv(emp?.departamento || 'SIN ASIGNAR'),
        escapeCsv(`${emp?.nombre || ''} ${emp?.apellidos || ''}`.trim()),
        escapeCsv(emp?.puesto || ''),
        escapeCsv(formatFecha(new Date(a.fecha))),
        escapeCsv(a.tipo),
        escapeCsv(a.estadoJustificacion),
        escapeCsv(a.motivoJustificacion || '')
      ].join(',');
      lineas.push(fila);
    }

    lineas.push('');
    lineas.push(`Total registros: ${asistencias.length}`);
    lineas.push('Firmado y enviado por Administración General');

    const dir = path.join('uploads', 'nominas');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const filename = `ASIST_${Date.now()}_${nomina.folio.replace(/[^A-Za-z0-9-]/g, '_')}.csv`;
    const filepath = path.join(dir, filename);
    // BOM UTF-8 al inicio para que Excel reconozca acentos
    fs.writeFileSync(filepath, '﻿' + lineas.join('\n'), { encoding: 'utf8' });
    console.log(`[Nomina ${nomina.folio}] reporte de asistencias generado: ${filepath} (${asistencias.length} registros)`);

    // 3. Actualiza la nómina: firma Administración + Dirección, estado AUTORIZADO
    const actualizada = await prisma.nomina.update({
      where: { id },
      data: {
        archivoAsistenciasUrl: `/uploads/nominas/${filename}`,
        firmaAdministracion: true,
        firmaDireccion: true,
        estado: 'AUTORIZADO',
        fechaAutorizacion: new Date(),
        usuarioAutorizaId: req.usuario!.id
      }
    });

    // 4. Notifica a RH (su turno)
    const msg = `Pre-nómina ${actualizada.folio} autorizada. Reporte de asistencias enviado para armar la nómina final.`;
    const link = `/nominas/${actualizada.id}`;
    await Promise.all([
      crearNotificacion({ rol: 'RECURSOS_HUMANOS' as any, titulo: 'Pre-nómina autorizada', mensaje: msg, link, tipo: 'ALERTA' as any }),
      crearNotificacion({ rol: 'RRHH_FINANZAS' as any,    titulo: 'Pre-nómina autorizada', mensaje: msg, link, tipo: 'INFO' as any })
    ]);

    res.json({
      success: true,
      message: `Lista de asistencias enviada a RH (${asistencias.length} registros). Firma aplicada.`,
      data: actualizada
    });
  } catch (error: any) {
    console.error('Error enviando asistencias a RH:', error);
    res.status(500).json({ success: false, message: 'Error interno', detalle: error.message });
  }
};

// RH sube la nómina final escaneada con la firma del trabajador (cierre del ciclo).
// Aplica la firma de RH y deja la nómina lista para que Finanzas la archive.
export const subirNominaFinal = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const archivo = (req as any).file as Express.Multer.File | undefined;
    if (!archivo) {
      return res.status(400).json({ success: false, message: 'Debes adjuntar la nómina escaneada con firmas.' });
    }

    const nomina = await prisma.nomina.findUnique({ where: { id: Number(id) } });
    if (!nomina) return res.status(404).json({ success: false, message: 'Nómina no encontrada.' });
    if (nomina.estado !== 'AUTORIZADO') {
      return res.status(400).json({ success: false, message: 'La nómina debe estar AUTORIZADA antes de subir el documento firmado.' });
    }

    const actualizada = await prisma.nomina.update({
      where: { id: Number(id) },
      data: {
        archivoNominaFinalUrl: `/uploads/nominas/${archivo.filename}`,
        firmaRecursosHumanos: true
      }
    });

    // Notifica a Finanzas (deben archivar) y a Administración (queda enterada del cierre).
    const msg4 = `Nómina ${actualizada.folio} firmada por el trabajador. Lista para archivar.`;
    const link4 = `/nominas/${actualizada.id}`;
    await Promise.all([
      crearNotificacion({ rol: 'RECURSOS_FINANCIEROS' as any, titulo: 'Nómina lista para archivar', mensaje: msg4, link: link4, tipo: 'ALERTA' as any }),
      crearNotificacion({ rol: 'RRHH_FINANZAS' as any,        titulo: 'Nómina lista para archivar', mensaje: msg4, link: link4, tipo: 'INFO' as any })
    ]);

    res.json({ success: true, message: 'Nómina firmada por el trabajador subida. Lista para archivar.', data: actualizada });
  } catch (error: any) {
    console.error('Error subiendo nómina final:', error);
    res.status(500).json({ success: false, message: 'Error interno', detalle: error.message });
  }
};

export const decidirJustificacion = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { aprobar } = req.body;

    if (typeof aprobar !== 'boolean') {
      return res.status(400).json({ success: false, message: 'Debe enviar `aprobar: boolean` en el body.' });
    }

    const registro = await prisma.registroAsistencia.findUnique({ where: { id: Number(id) } });
    if (!registro) {
      return res.status(404).json({ success: false, message: 'Registro de asistencia no encontrado.' });
    }

    if (registro.tipo === 'ASISTENCIA') {
      return res.status(400).json({ success: false, message: 'Una asistencia normal no requiere justificación.' });
    }

    const actualizado = await prisma.registroAsistencia.update({
      where: { id: Number(id) },
      data: {
        estadoJustificacion: aprobar ? 'APROBADA' : 'RECHAZADA'
      },
      include: { empleado: true }
    });

    res.json({
      success: true,
      message: aprobar ? 'Justificación aprobada.' : 'Justificación rechazada.',
      data: actualizado
    });
  } catch (error: any) {
    console.error('Error decidiendo justificación:', error);
    res.status(500).json({ success: false, message: 'Error interno', detalle: error.message });
  }
};

export const obtenerAsistencias = async (req: Request, res: Response) => {
  try {
    const { fechaInicio, fechaFin } = req.query;
    
    if (!fechaInicio || !fechaFin) {
      return res.status(400).json({ success: false, message: 'Faltan rangos de fecha.' });
    }

    // Normalizamos en UTC para que el offset local no recorte los registros de los bordes
    // (ej. en México UTC-6, setHours(0) movía el inicio 6 horas adelante y dejaba fuera el día 1).
    const inicio = new Date(fechaInicio as string);
    inicio.setUTCHours(0, 0, 0, 0);

    const fin = new Date(fechaFin as string);
    fin.setUTCHours(23, 59, 59, 999);

    const registros = await prisma.registroAsistencia.findMany({
      where: {
        fecha: {
          gte: inicio,
          lte: fin,
        },
      },
      include: {
        empleado: true
      },
      orderBy: {
        fecha: 'asc'
      }
    });

    res.json({ success: true, data: registros });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};