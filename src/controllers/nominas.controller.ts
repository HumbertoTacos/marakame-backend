import { Request, Response } from 'express';
import { prisma } from '../utils/prisma';
import { AppError } from '../middlewares/errorHandler';

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

// ============================================================
// NÓMINA GENERAL (CICLOS)
// ============================================================

export const generarNomina = async (req: Request, res: Response) => {
  try {
    const { 
      periodo, 
      fechaInicio, 
      fechaFin, 
      totalPercepciones, 
      totalDeducciones, 
      totalNetoPagar,
      regimen 
    } = req.body;

    // 1. Generar Folio
    const currentYear = new Date().getFullYear();
    const count = await prisma.nomina.count({
      where: { folio: { startsWith: `NOM-${currentYear}` } }
    });
    const folio = `NOM-${currentYear}-${String(count + 1).padStart(3, '0')}`;

    // 2. Crear la Nómina principal (Estado: EN_REVISION)
    const nomina = await prisma.nomina.create({
      data: {
        folio,
        periodo,
        fechaInicio: new Date(fechaInicio),
        fechaFin: new Date(fechaFin),
        estado: 'EN_REVISION', 
        totalPercepciones: parseFloat(totalPercepciones || '0'),
        totalDeducciones: parseFloat(totalDeducciones || '0'),
        totalNetoPagar: parseFloat(totalNetoPagar || '0')
      }
    });

    // 3. Buscar Empleados por Régimen
    const empleadosActivos = await prisma.empleado.findMany({ 
      where: { 
        activo: true,
        regimen: regimen || 'CONFIANZA' 
      } 
    });

    // 4. Crear PreNóminas (Detalles por empleado)
    if (empleadosActivos.length > 0) {
      const registrosPreNomina = empleadosActivos.map(emp => {
        const sueldoBruto = emp.salarioBase;
        const compensacion = emp.compensacionFija || 0;
        const tPerc = sueldoBruto + compensacion;
        const tDeduc = sueldoBruto * 0.08; 

        return {
          nominaId: nomina.id,
          empleadoId: emp.id,
          diasTrabajados: 15,
          horasExtra: 0,
          sueldoBruto,
          compensacion,
          otrasPercepciones: 0,
          totalPercepciones: tPerc,
          retencionISR: tDeduc,
          descuentoIncidencias: 0,
          otrasDeducciones: 0,
          totalDeducciones: tDeduc,
          totalAPagar: tPerc - tDeduc,
          reciboFirmado: false
        };
      });

      await prisma.preNomina.createMany({
        data: registrosPreNomina
      });
    }

    // 5. Devolver Resultado
    const resultado = await prisma.nomina.findUnique({
      where: { id: nomina.id },
      include: { prenominas: { include: { empleado: true } } }
    });

    res.status(201).json({ success: true, data: resultado });

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

    let dataToUpdate: any = {};

    // 1. Asignamos la firma dependiendo del rol
    switch (rolUsuario) {
      case 'RRHH_FINANZAS':
        dataToUpdate.firmaFinanzas = true;
        break;
      case 'ADMINISTRACION':
        dataToUpdate.firmaAdministracion = true;
        break;
      case 'DIRECCION_GENERAL':
      case 'ADMIN_GENERAL':
        dataToUpdate.firmaDireccion = true;
        break;
      case 'RECURSOS_HUMANOS':
        dataToUpdate.firmaRecursosHumanos = true;
        break;
      default:
        // Si tu rol no coincide o estás probando sin login estricto, 
        // puedes comentar el default para pruebas temporales.
        return res.status(403).json({ success: false, message: 'Tu rol no tiene jerarquía para firmar.' });
    }

    // 2. Revisamos cuántas firmas tendría en total con esta nueva acción
    const firmasCompletas = [
      dataToUpdate.firmaRecursosHumanos ?? nomina.firmaRecursosHumanos,
      dataToUpdate.firmaFinanzas ?? nomina.firmaFinanzas,
      dataToUpdate.firmaAdministracion ?? nomina.firmaAdministracion,
      dataToUpdate.firmaDireccion ?? nomina.firmaDireccion
    ].filter(Boolean).length;

    // 3. LA MAGIA: Si ya juntó las 4 firmas, cambiamos el estado automáticamente
    if (firmasCompletas === 4) {
      dataToUpdate.estado = 'AUTORIZADO';
      dataToUpdate.fechaAutorizacion = new Date();
      dataToUpdate.usuarioAutorizaId = req.usuario!.id;
    }

    // 4. Guardamos en la base de datos
    const actualizada = await prisma.nomina.update({
      where: { id: Number(id) },
      data: dataToUpdate
    });

    res.json({ success: true, message: 'Firma registrada correctamente.', data: actualizada });
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
    const { fecha, registros } = req.body;
    const usuarioId = req.usuario!.id; 

    // 1. Buscar la Nómina que esté actualmente en curso
    const nominaActiva = await prisma.nomina.findFirst({
      where: { 
        estado: { in: ['BORRADOR', 'PRE_NOMINA', 'EN_REVISION'] } 
      },
      orderBy: { id: 'desc' }
    });

    if (!nominaActiva) {
      return res.status(400).json({ 
        success: false, 
        message: 'No hay un periodo de nómina abierto. RRHH debe generar una nueva nómina primero.' 
      });
    }

    // 2. Preparar los datos para insertarlos de golpe (Bulk Insert)
    const datosAInsertar = registros.map((reg: any) => ({
      fecha: new Date(fecha),
      tipo: reg.tipo,
      motivoJustificacion: reg.motivo || null,
      estadoJustificacion: reg.tipo === 'ASISTENCIA' ? 'NO_APLICA' : 'PENDIENTE',
      empleadoId: reg.empleadoId,
      nominaId: nominaActiva.id,
      registradoPorId: usuarioId
    }));

    // 3. Guardar en la base de datos
    const resultado = await prisma.registroAsistencia.createMany({
      data: datosAInsertar,
      skipDuplicates: true // Evita errores si se manda 2 veces
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

export const obtenerAsistencias = async (req: Request, res: Response) => {
  try {
    const { fechaInicio, fechaFin } = req.query;
    
    if (!fechaInicio || !fechaFin) {
      return res.status(400).json({ success: false, message: 'Faltan rangos de fecha.' });
    }

    // Normalizamos las fechas para que abarquen el día completo
    const inicio = new Date(fechaInicio as string);
    inicio.setHours(0, 0, 0, 0);

    const fin = new Date(fechaFin as string);
    fin.setHours(23, 59, 59, 999);

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