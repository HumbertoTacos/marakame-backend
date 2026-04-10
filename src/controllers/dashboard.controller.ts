import { Request, Response } from 'express';
import { prisma } from '../utils/prisma';

export const getDashboardStats = async (req: Request, res: Response) => {
  // 1. Ocupación de Camas
  const pacientesInternados = await prisma.paciente.count({
    where: { estado: 'INTERNADO' }
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
    where: { estado: 'EN_PROCESO' }
  });

  // Inventario en riesgo
  const productosCriticos = await prisma.almacenProducto.count({
    where: { estadoStock: 'CRITICO' }
  });

  const productosBajos = await prisma.almacenProducto.count({
    where: { estadoStock: 'BAJO' }
  });

  // Requisiciones pendientes de autorización
  const comprasPendientes = await prisma.compraRequisicion.count({
    where: { estado: 'PENDIENTE_AUTORIZACION' }
  });

  // Nóminas en Borrador
  const nominasPendientes = await prisma.nomina.count({
    where: { estado: 'BORRADOR' }
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
