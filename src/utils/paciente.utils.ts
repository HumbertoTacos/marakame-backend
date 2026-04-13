import { prisma } from './prisma';

/**
 * Genera la siguiente clave única incremental para el expediente del paciente.
 * Busca el valor numérico más alto actual y le suma 1. 
 * Si no hay expedientes, inicia en '4922'.
 * Soporta transacciones de Prisma recibiendo un cliente opcional.
 */
export const generarSiguienteClaveUnica = async (tx?: any): Promise<string> => {
  const client = tx || prisma;

  // 1. Obtener el último paciente que tiene claveUnica asignada (ordenado por id desc)
  const ultimoPaciente = await client.paciente.findFirst({
    where: {
      claveUnica: { not: null }
    },
    orderBy: {
      id: 'desc'
    },
    select: {
      claveUnica: true
    }
  });

  if (!ultimoPaciente || !ultimoPaciente.claveUnica) {
    return '4922';
  }

  // 2. Extraer número, incrementar y devolver
  const numeroActual = parseInt(ultimoPaciente.claveUnica, 10);
  if (isNaN(numeroActual)) return '4922';
  
  return (numeroActual + 1).toString();
};

/**
 * Función de utilidad para enmascarar datos de respuesta y cumplir con la capa de privacidad.
 * Omite nombre y apellidos en cualquier nivel de anidación si se detecta un objeto paciente.
 */
export const aplicarCapaPrivacidad = (data: any): any => {
  if (data === null || data === undefined) return data;

  // Si es un arreglo, procesamos cada elemento de forma recursiva
  if (Array.isArray(data)) {
    return data.map(item => aplicarCapaPrivacidad(item));
  }

  // Si es una fecha, la devolvemos tal cual para evitar que el spread { ...data } la deje vacía
  if (data instanceof Date) {
    return data;
  }

  // Si es un objeto, clonamos y procesamos
  if (typeof data === 'object') {
    // Clonamos el objeto para evitar mutaciones accidentales
    const clone = { ...data };

    // Si el objeto actual parece ser un paciente (basado en claveUnica o campos nominales)
    // O si es un objeto que contiene un campo 'paciente'
    if (clone.claveUnica !== undefined || (clone.nombre !== undefined && clone.apellidoPaterno !== undefined)) {
      // Omitimos los datos nominales
      delete clone.nombre;
      delete clone.apellidoPaterno;
      delete clone.apellidoMaterno;
    }

    // Procesamos recursivamente las propiedades del objeto (por si hay pacientes anidados)
    for (const key in clone) {
      if (Object.prototype.hasOwnProperty.call(clone, key)) {
        clone[key] = aplicarCapaPrivacidad(clone[key]);
      }
    }

    return clone;
  }

  return data;
};
