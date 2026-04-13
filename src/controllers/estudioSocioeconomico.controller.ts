import { Request, Response } from 'express';
import { prisma } from '../utils/prisma';
import { AppError } from '../middlewares/errorHandler';

/**
 * Crea o actualiza un Estudio Socioeconómico para un paciente.
 * Implementa cálculo automático de egresos institucional.
 */
export const upsertEstudioSocioeconomico = async (req: Request, res: Response) => {
  const { pacienteId, datos, seccionActual, completado } = req.body;

  if (!pacienteId) {
    throw new AppError(400, 'El ID del paciente es obligatorio');
  }

  const id = typeof pacienteId === 'string' ? parseInt(pacienteId, 10) : pacienteId;

  // 1. Lógica de Cálculo de Egresos (Sección 7)
  // Extraemos montos del JSON de datos para sumarlos
  const getMonto = (val: any) => {
    const num = parseFloat(val);
    return isNaN(num) ? 0 : num;
  };

  const totalEgresos = 
    getMonto(datos.egresoAgua) +
    getMonto(datos.egresoLuz) +
    getMonto(datos.egresoGas) +
    getMonto(datos.egresoRentaHipoteca) +
    getMonto(datos.egresoAlimentacion) +
    getMonto(datos.egresoTransporte) +
    getMonto(datos.egresoVestido) +
    getMonto(datos.egresoEsparcimientos); // Nueva categoría obligatoria

  // 2. Normalización de campos explícitos desde el JSON
  // Mapeamos llaves del JSON a las columnas de la tabla para reporteo eficiente
  const estudio = await prisma.estudioSocioeconomico.upsert({
    where: { pacienteId: id },
    create: {
      pacienteId: id,
      seccionActual: seccionActual || 1,
      completado: completado || false,
      datos: datos || {},
      ingresoMensualRango: datos.ingresoMensualRango || null,
      numeroHabitacionesRango: datos.numeroHabitacionesRango || null,
      tieneMasDeUnaVivienda: datos.tieneMasDeUnaVivienda === true || datos.tieneMasDeUnaVivienda === 'true',
      pisoMaterial: datos.viviendaPiso || null,
      murosMaterial: datos.viviendaMuros || null,
      techoMaterial: datos.viviendaTecho || null,
      totalEgresosCalculado: totalEgresos,
      nivelSocioeconomico: calcularNivelPreliminar(totalEgresos)
    },
    update: {
      seccionActual: seccionActual,
      completado: completado,
      datos: datos,
      ingresoMensualRango: datos.ingresoMensualRango,
      numeroHabitacionesRango: datos.numeroHabitacionesRango,
      tieneMasDeUnaVivienda: datos.tieneMasDeUnaVivienda === true || datos.tieneMasDeUnaVivienda === 'true',
      pisoMaterial: datos.viviendaPiso,
      murosMaterial: datos.viviendaMuros,
      techoMaterial: datos.viviendaTecho,
      totalEgresosCalculado: totalEgresos,
      nivelSocioeconomico: calcularNivelPreliminar(totalEgresos)
    }
  });

  res.json({ success: true, data: estudio });
};

/**
 * Obtiene el estudio socioeconómico de un paciente.
 */
export const getEstudioByPaciente = async (req: Request, res: Response) => {
  const { pacienteId } = req.params;
  const id = parseInt(pacienteId as string, 10);

  const estudio = await prisma.estudioSocioeconomico.findUnique({
    where: { pacienteId: id }
  });

  if (!estudio) {
    return res.json({ success: true, data: null });
  }

  res.json({ success: true, data: estudio });
};

/**
 * Función interna para tabular nivel preliminar basado en egresos
 * (Lógica de ejemplo que Trabajo Social puede ajustar)
 */
function calcularNivelPreliminar(egresos: number): string {
  if (egresos > 20000) return 'A (Alto)';
  if (egresos > 10000) return 'B (Medio-Alto)';
  if (egresos > 5000) return 'C (Medio)';
  return 'D (Bajo)';
}
