import { Request, Response } from 'express';
import { prisma } from '../utils/prisma';
import { 
  EstadoPaciente,
  EstadoIngreso,
  EstadoStock,
  EstadoCompra,
  EstadoNomina
} from '@prisma/client';

export const getDashboardStats = async (req: Request, res: Response) => {
  // 1. Ocupación de Camas
  const pacientesInternados = await prisma.paciente.count({
    where: { estado: EstadoPaciente.INTERNADO }
  });
  const capacidadTotal = 80;
  const ocupacionPorcentaje = ((pacientesInternados / capacidadTotal) * 100).toFixed(1);

  // 2. Tareas Críticas / Alertas Operativas
  // Ingresos pendientes hoy
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const manana = new Date(hoy);
  manana.setDate(manana.getDate() + 1);

  const ingresosEnProceso = await prisma.ingreso.count({
    where: { estado: EstadoIngreso.EN_PROCESO }
  });

  // Inventario en riesgo
  const productosCriticos = await prisma.almacenProducto.count({
    where: { estadoStock: EstadoStock.CRITICO }
  });

  const productosBajos = await prisma.almacenProducto.count({
    where: { estadoStock: EstadoStock.BAJO }
  });

  // Requisiciones pendientes de autorización
  const comprasPendientes = await prisma.compraRequisicion.count({
    where: {
      estado: EstadoCompra.EN_AUTORIZACION_DIRECCION
    }
  });

  // Nóminas en Borrador
  const nominasPendientes = await prisma.nomina.count({
    where: { estado: EstadoNomina.BORRADOR }
  });

  res.json({
    success: true,
    data: {
      ocupacion: {
        internados: pacientesInternados,
        capacidad: capacidadTotal,
        porcentaje: parseFloat(ocupacionPorcentaje)
      },
      admisiones: {
        enProceso: ingresosEnProceso
      },
      almacen: {
        criticos: productosCriticos,
        bajos: productosBajos
      },
      operaciones: {
        comprasAutorizacion: comprasPendientes,
        nominasBorrador: nominasPendientes
      }
    }
  });
};
