import { Request, Response } from 'express';
import { prisma } from '../utils/prisma';
import {
  EstadoPaciente,
  EstadoIngreso,
  EstadoStock,
  EstadoCompra,
  EstadoNomina,
  Rol,
} from '@prisma/client';

export const getDashboardStats = async (req: Request, res: Response) => {
  const capacidadTotal = 40;

  // Todas las queries corren en paralelo
  const [
    pacientesInternados,
    ingresosEnProceso,
    productosCriticos,
    productosBajos,
    comprasPendientes,
    nominasPendientes,
    nutricionData,
    psicologiaData,
  ] = await Promise.all([
    prisma.paciente.count({ where: { estado: EstadoPaciente.INTERNADO } }),
    prisma.ingreso.count({ where: { estado: EstadoIngreso.EN_PROCESO } }),
    prisma.almacenProducto.count({ where: { estadoStock: EstadoStock.CRITICO } }),
    prisma.almacenProducto.count({ where: { estadoStock: EstadoStock.BAJO } }),
    prisma.compraRequisicion.count({ where: { estado: EstadoCompra.EN_AUTORIZACION_DIRECCION } }),
    prisma.nomina.count({ where: { estado: EstadoNomina.BORRADOR } }),

    // Métricas de nutrición — aisladas para que un fallo no rompa el dashboard
    (async () => {
      try {
        const [totalPlanes, conSobrepeso, conRestricciones] = await Promise.all([
          (prisma as any).planNutricional.count(),
          (prisma as any).planNutricional.count({ where: { imc: { gte: 25 } } }),
          (prisma as any).planNutricional.count({ where: { restricciones: { not: null } } }),
        ]);
        return { totalPlanes, conSobrepeso, conRestricciones };
      } catch {
        return { totalPlanes: 0, conSobrepeso: 0, conRestricciones: 0 };
      }
    })(),

    // Métricas de psicología — aisladas igualmente
    (async () => {
      try {
        const inicio7dias = new Date();
        inicio7dias.setDate(inicio7dias.getDate() - 7);
        const [psicologia, consejeria, familia, total, conSesion] = await Promise.all([
          (prisma as any).notaSesionClinica.count({ where: { tipo: 'PSICOLOGIA', fecha: { gte: inicio7dias } } }),
          (prisma as any).notaSesionClinica.count({ where: { tipo: 'CONSEJERIA', fecha: { gte: inicio7dias } } }),
          (prisma as any).notaSesionClinica.count({ where: { tipo: 'FAMILIA',    fecha: { gte: inicio7dias } } }),
          (prisma as any).notaSesionClinica.count({ where: { fecha: { gte: inicio7dias } } }),
          (prisma as any).notaSesionClinica.findMany({
            where: { tipo: 'PSICOLOGIA' },
            select: { expedienteId: true },
            distinct: ['expedienteId'],
          }),
        ]);
        return { psicologia, consejeria, familia, sesiones7d: total, conSesion: conSesion.length };
      } catch {
        return { psicologia: 0, consejeria: 0, familia: 0, sesiones7d: 0, conSesion: 0 };
      }
    })(),
  ]);

  const ocupacionPorcentaje = ((pacientesInternados / capacidadTotal) * 100).toFixed(1);

  res.json({
    success: true,
    data: {
      ocupacion: {
        internados: pacientesInternados,
        capacidad: capacidadTotal,
        porcentaje: parseFloat(ocupacionPorcentaje),
      },
      admisiones: { enProceso: ingresosEnProceso },
      almacen:    { criticos: productosCriticos, bajos: productosBajos },
      operaciones: { comprasAutorizacion: comprasPendientes, nominasBorrador: nominasPendientes },
      nutricion: {
        totalPlanes:          nutricionData.totalPlanes,
        sinPlan:              Math.max(0, pacientesInternados - nutricionData.totalPlanes),
        conSobrepesoObesidad: nutricionData.conSobrepeso,
        conRestricciones:     nutricionData.conRestricciones,
      },
      psicologia: {
        sesiones7d:       psicologiaData.sesiones7d,
        psicologia:       psicologiaData.psicologia,
        consejeria:       psicologiaData.consejeria,
        familia:          psicologiaData.familia,
        sinPrimeraSesion: Math.max(0, pacientesInternados - psicologiaData.conSesion),
      },
    },
  });
};

// ============================================================
// DASHBOARD DIRECTORA GENERAL — Vista ejecutiva
// ============================================================
export const getDashboardDirectora = async (_req: Request, res: Response) => {
  const capacidadTotal = 40;
  const ahora          = new Date();
  const inicioMes      = new Date(ahora.getFullYear(), ahora.getMonth(), 1);
  const inicio30d      = new Date(ahora.getTime() - 30 * 86_400_000);

  const [
    internados,
    prospectos,
    enValoracion,
    pendienteIngreso,
    egresadosMes,
    ingresosMes,
    totalInternados30d,
    saldoPendiente,
    productosCriticos,
    productosBajos,
    comprasPendientes,
    nominasPendientes,
    usuariosPorRol,
    camasPorArea,
    totalPacientesHistorico,
  ] = await Promise.all([
    prisma.paciente.count({ where: { estado: EstadoPaciente.INTERNADO } }),
    prisma.paciente.count({ where: { estado: EstadoPaciente.PROSPECTO } }),
    prisma.paciente.count({ where: { estado: EstadoPaciente.EN_VALORACION } }),
    prisma.paciente.count({ where: { estado: EstadoPaciente.PENDIENTE_INGRESO } }),

    // Egresos del mes actual
    (prisma as any).egresoRegistro.count({
      where: { fechaEgreso: { gte: inicioMes } },
    }).catch(() => 0),

    // Pagos recibidos este mes
    prisma.pagoPaciente.aggregate({
      _sum: { monto: true },
      where: { fechaPago: { gte: inicioMes } },
    }),

    // Ingresos (admisiones) en los últimos 30 días
    prisma.paciente.count({
      where: { fechaIngreso: { gte: inicio30d } },
    }),

    // Saldo pendiente total de todos los pacientes internados
    prisma.cargoPaciente.aggregate({
      _sum: { monto: true },
      where: { pagado: false },
    }),

    prisma.almacenProducto.count({ where: { estadoStock: EstadoStock.CRITICO } }),
    prisma.almacenProducto.count({ where: { estadoStock: EstadoStock.BAJO } }),
    prisma.compraRequisicion.count({ where: { estado: EstadoCompra.EN_AUTORIZACION_DIRECCION } }),
    prisma.nomina.count({ where: { estado: EstadoNomina.BORRADOR } }),

    // Usuarios activos por rol
    prisma.usuario.groupBy({
      by: ['rol'],
      where: { activo: true, deletedAt: null },
      _count: { id: true },
    }),

    // Camas por área (habitaciones y su estado)
    prisma.habitacion.findMany({
      select: {
        area: true,
        capacidadMax: true,
        camas: { select: { estado: true } },
      },
    }),

    prisma.paciente.count(),
  ]);

  const ocupacionPct = parseFloat(((internados / capacidadTotal) * 100).toFixed(1));

  // Calcular ocupación por área
  const ocupacionAreas = camasPorArea.reduce((acc, hab) => {
    const area  = hab.area as string;
    const ocup  = hab.camas.filter((c: { estado: string }) => c.estado === 'OCUPADA').length;
    const total = hab.camas.length;
    if (!acc[area]) acc[area] = { ocupadas: 0, total: 0 };
    acc[area].ocupadas += ocup;
    acc[area].total    += total;
    return acc;
  }, {} as Record<string, { ocupadas: number; total: number }>);

  // Usuarios por rol formateado
  const staffPorRol = usuariosPorRol.reduce((acc, r) => {
    acc[r.rol as string] = (r._count as any).id;
    return acc;
  }, {} as Record<string, number>);

  res.json({
    success: true,
    data: {
      kpis: {
        internados,
        capacidadTotal,
        ocupacionPct,
        prospectos,
        enValoracion,
        pendienteIngreso,
        egresadosMes,
        ingresosMes30d: totalInternados30d,
        totalHistorico: totalPacientesHistorico,
      },
      finanzas: {
        cobrosMes:       ingresosMes._sum.monto ?? 0,
        saldoPendiente:  saldoPendiente._sum.monto ?? 0,
      },
      alertas: {
        productosCriticos,
        productosBajos,
        comprasPendientes,
        nominasPendientes,
      },
      ocupacionAreas,
      staffPorRol,
    },
  });
};
