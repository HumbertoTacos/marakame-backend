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
        estado: 'EN_REVISION', // <--- Mantenemos el estado que pediste
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

      // AQUÍ ESTÁ EL CAMBIO CLAVE: Usamos el nombre correcto del modelo en Prisma
      // Si tu esquema dice @@map("prenominas") pero el modelo se llama PreNomina,
      // entonces prisma.preNomina es correcto. Si el modelo se llama Prenomina, entonces
      // usamos prisma.prenomina. Revisa tu schema.prisma para confirmar el nombre del MODELO.
      // Asumiendo que el modelo se llama PreNomina (como en el código anterior):
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
  // Filtramos para NO mostrar las que ya están autorizadas en el Dashboard principal
  const nominas = await prisma.nomina.findMany({
    where: {
      estado: {
        not: 'AUTORIZADO' 
      }
    },
    include: {
      usuarioAutoriza: { select: { nombre: true, apellidos: true } },
      prenominas: { include: { empleado: true } }
    },
    orderBy: { createdAt: 'desc' }
  });
  res.json({ success: true, data: nominas });
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


//Guarda datos y hace los calculos finales para la nomina de cada empleado

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
          include: { empleado: true } // Traemos los recibos y los datos del empleado
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