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
// NÓMINA GENERAL
// ============================================================

export const generarNomina = async (req: Request, res: Response) => {
  const { periodo, fechaInicio, fechaFin } = req.body;

  // 0. Generar Folio NOM-YYYY-NNN
  const currentYear = new Date().getFullYear();
  const count = await prisma.nomina.count({
    where: {
      folio: { startsWith: `NOM-${currentYear}` }
    }
  });
  const folio = `NOM-${currentYear}-${String(count + 1).padStart(3, '0')}`;

  // 1. Crear el cajón de Nómina Base
  const nomina = await prisma.nomina.create({
    data: {
      folio,
      periodo,
      fechaInicio: new Date(fechaInicio),
      fechaFin: new Date(fechaFin),
      estado: 'PRE_NOMINA' // Iniciamos en estado PRE_NOMINA
    }
  });

  // 2. Traer todos los empleados activos
  const empleadosActivos = await prisma.empleado.findMany({ where: { activo: true } });

  // 3. Generar pre-nóminas (Cálculos iniciales guiados por el manual)
  let globalPercepciones = 0;
  let globalDeducciones = 0;
  let globalNeto = 0;

  const preNominas = empleadosActivos.map(emp => {
    // Percepciones
    const sueldoBruto = emp.salarioBase;
    const compensacion = emp.compensacionFija || 0;
    const totalPercepciones = sueldoBruto + compensacion;
    
    // Deducciones (Simulación de ISR base al 8%)
    const retencionISR = sueldoBruto * 0.08; 
    const descuentoIncidencias = 0;
    const totalDeducciones = retencionISR + descuentoIncidencias;

    // Neto
    const totalAPagar = totalPercepciones - totalDeducciones;

    // Sumamos a los totales globales de la quincena
    globalPercepciones += totalPercepciones;
    globalDeducciones += totalDeducciones;
    globalNeto += totalAPagar;

    return {
      nominaId: nomina.id,
      empleadoId: emp.id,
      diasTrabajados: 15,
      horasExtra: 0,
      sueldoBruto,
      compensacion,
      otrasPercepciones: 0,
      totalPercepciones,
      retencionISR,
      descuentoIncidencias,
      otrasDeducciones: 0,
      totalDeducciones,
      totalAPagar,
      incidencias: null,
      reciboFirmado: false
    };
  });

  // 4. Insertar todos los cálculos de los trabajadores
  if (preNominas.length > 0) {
    await prisma.preNomina.createMany({
      data: preNominas
    });
  }

  // 5. Actualizar la nómina principal con los totales calculados
  const nominaGenerada = await prisma.nomina.update({
    where: { id: nomina.id },
    data: {
      totalPercepciones: globalPercepciones,
      totalDeducciones: globalDeducciones,
      totalNetoPagar: globalNeto
    },
    include: { prenominas: { include: { empleado: true } } }
  });

  res.status(201).json({ success: true, data: nominaGenerada });
};

export const getNominas = async (req: Request, res: Response) => {
  const nominas = await prisma.nomina.findMany({
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

  // Valores a actualizar (si no vienen en la petición, conservamos los anteriores)
  const newDias = diasTrabajados !== undefined ? parseFloat(diasTrabajados) : preNomina.diasTrabajados;
  const newOtrasPerc = otrasPercepciones !== undefined ? parseFloat(otrasPercepciones) : preNomina.otrasPercepciones;
  const newDescuentosInc = descuentoIncidencias !== undefined ? parseFloat(descuentoIncidencias) : preNomina.descuentoIncidencias;
  const newOtrasDeduc = otrasDeducciones !== undefined ? parseFloat(otrasDeducciones) : preNomina.otrasDeducciones;

  // RECALCULAR
  // Si trabajó menos días, su sueldo bruto se prorratea
  const baseReducida = (preNomina.sueldoBruto / 15) * newDias;
  
  const totalPercepciones = baseReducida + preNomina.compensacion + newOtrasPerc;
  
  // El ISR se mantiene igual al cálculo base o podrías recalcularlo proporcionalmente
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

  // Opcional: Podrías llamar aquí a un servicio para actualizar el totalGeneral de la Nomina Padre
  
  res.json({ success: true, data: preUpdate });
};