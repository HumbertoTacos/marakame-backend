import { Request, Response } from 'express';
import { prisma } from '../utils/prisma';
import { AppError } from '../middlewares/errorHandler';

// ============================================================
// EMPLEADOS
// ============================================================

export const createEmpleado = async (req: Request, res: Response) => {
  const { nombre, apellidos, puesto, departamento, salarioBase } = req.body;
  const empleado = await prisma.empleado.create({
    data: {
      nombre,
      apellidos,
      puesto,
      departamento,
      salarioBase: parseFloat(salarioBase)
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

  // 1. Crear el cajón de Nómina Base
  const nomina = await prisma.nomina.create({
    data: {
      periodo,
      fechaInicio: new Date(fechaInicio),
      fechaFin: new Date(fechaFin),
      estado: 'BORRADOR'
    }
  });

  // 2. Traer todos los empleados activos
  const empleadosActivos = await prisma.empleado.findMany({ where: { activo: true } });

  // 3. Generar pre-nóminas (cálculos en cero por defecto, asumiendo 15 días o parametrizar)
  const preNominas = empleadosActivos.map(emp => {
    // Calculo básico. Suponemos que laboró la quincena entera, pero esto se ajusta en updatePreNomina
    const salarioBase = emp.salarioBase; 
    return {
      nominaId: nomina.id,
      empleadoId: emp.id,
      diasTrabajados: 15,
      salarioBase: salarioBase,
      bonos: 0,
      deducciones: 0,
      totalAPagar: salarioBase
    };
  });

  await prisma.preNomina.createMany({
    data: preNominas
  });

  const nominaGenerada = await prisma.nomina.findUnique({
    where: { id: nomina.id },
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
    where: { id: parseInt(id as string, 10) }, 
    include: { prenominas: true } 
  });
  if (!nominaBase) throw new AppError(404, 'Nómina no encontrada');

  const totalGeneral = nominaBase.prenominas.reduce((acc, curr) => acc + curr.totalAPagar, 0);

  const nomina = await prisma.nomina.update({
    where: { id: parseInt(id as string, 10) },
    data: {
      estado: 'AUTORIZADO',
      usuarioAutorizaId: usuarioId,
      fechaAutorizacion: new Date(),
      totalGeneral
    }
  });

  res.json({ success: true, data: nomina });
};

// ============================================================
// PRE-NÓMINAS (Cálculos por empleado)
// ============================================================

export const updatePreNomina = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { diasTrabajados, horasExtra, bonos, deducciones, incidencias } = req.body;

  const preNomina = await prisma.preNomina.findUnique({ where: { id: parseInt(id as string, 10) } });
  if (!preNomina) throw new AppError(404, 'Pre-Nómina no encontrada');

  // Recalcular
  const baseReducida = (preNomina.salarioBase / 15) * parseFloat(diasTrabajados || preNomina.diasTrabajados);
  const nuevoTotal = baseReducida + parseFloat(bonos || 0) - parseFloat(deducciones || 0);

  const preUpdate = await prisma.preNomina.update({
    where: { id: parseInt(id as string, 10) },
    data: {
      diasTrabajados: parseFloat(diasTrabajados || preNomina.diasTrabajados),
      horasExtra: parseFloat(horasExtra || 0),
      bonos: parseFloat(bonos || 0),
      deducciones: parseFloat(deducciones || 0),
      incidencias: incidencias || preNomina.incidencias,
      totalAPagar: nuevoTotal
    }
  });

  res.json({ success: true, data: preUpdate });
};
