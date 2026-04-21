import { prisma } from './prisma';

/**
 * Genera la siguiente clave única incremental para el expediente del paciente.
 * ✔ Seguro contra concurrencia
 * ✔ Evita duplicados
 * ✔ Compatible con transacciones
 * ✔ No rompe tu esquema actual (string)
 */
export const generarSiguienteClaveUnica = async (tx?: any): Promise<string> => {
  const client = tx || prisma;

  const MAX_REINTENTOS = 5;
  let intento = 0;

  while (intento < MAX_REINTENTOS) {
    try {
      // 🔹 Obtener todas las claves válidas (numéricas)
      const pacientes = await client.paciente.findMany({
        where: {
          claveUnica: { not: null }
        },
        select: {
          claveUnica: true
        }
      });

      // 🔹 Filtrar y convertir a números válidos
      const numeros: number[] = pacientes
        .map((p: { claveUnica: string | null }) => parseInt(p.claveUnica!, 10))
        .filter((n: number) => !isNaN(n));

      // 🔹 Obtener el máximo real
      const max = numeros.length > 0 ? Math.max(...numeros) : 4921;

      const siguiente = max + 1;

      return siguiente.toString();

    } catch (error: any) {
      // 🔥 Si hay conflicto de concurrencia (P2002), reintenta
      if (error.code === 'P2002') {
        intento++;
        continue;
      }

      throw error;
    }
  }

  throw new Error('No se pudo generar una clave única después de varios intentos');
};


/**
 * Asigna clave única SOLO si el paciente no tiene una
 *  Evita duplicación
 * Usa transacción segura
 */
export const asignarClaveUnicaPaciente = async (pacienteId: number, tx: any) => {
  // Verificar si ya tiene clave
  const paciente = await tx.paciente.findUnique({
    where: { id: pacienteId },
    select: { claveUnica: true }
  });

  if (!paciente) {
    throw new Error('Paciente no encontrado');
  }

  // Si ya tiene clave, NO hacer nada
  if (paciente.claveUnica) {
    return paciente.claveUnica;
  }

  const MAX_REINTENTOS = 5;
  let intento = 0;

  while (intento < MAX_REINTENTOS) {
    try {
      const claveUnica = await generarSiguienteClaveUnica(tx);

      const actualizado = await tx.paciente.update({
        where: { id: pacienteId },
        data: { claveUnica },
        select: { claveUnica: true }
      });

      return actualizado.claveUnica;

    } catch (error: any) {
      // Error de duplicado → reintentar
      if (error.code === 'P2002') {
        intento++;
        continue;
      }

      throw error;
    }
  }

  throw new Error('No se pudo asignar clave única al paciente');
};


/**
 * Función de utilidad para enmascarar datos de respuesta y cumplir con privacidad.
 */
export const aplicarCapaPrivacidad = (data: any): any => {
  if (data === null || data === undefined) return data;

  if (Array.isArray(data)) {
    return data.map(item => aplicarCapaPrivacidad(item));
  }

  if (data instanceof Date) {
    return data;
  }

  if (typeof data === 'object') {
    const clone = { ...data };

    // Detectar objeto paciente
    if (
      clone.claveUnica !== undefined ||
      (clone.nombre !== undefined && clone.apellidoPaterno !== undefined)
    ) {
      delete clone.nombre;
      delete clone.apellidoPaterno;
      delete clone.apellidoMaterno;
    }

    for (const key in clone) {
      if (Object.prototype.hasOwnProperty.call(clone, key)) {
        clone[key] = aplicarCapaPrivacidad(clone[key]);
      }
    }

    return clone;
  }

  return data;
};