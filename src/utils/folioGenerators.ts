import { prisma } from './prisma';
import { AppError } from '../middlewares/errorHandler';

/**
 * Genera folio único para Compra Requisición
 * Formato: COM-2026-00001
 */
export async function generateFolioCompra(): Promise<string> {
  try {
    const año = new Date().getFullYear();

    // Obtener el último folio del año actual
    const ultimoFolio = await prisma.compraRequisicion.findFirst({
      where: {
        folio: {
          startsWith: `COM-${año}-`,
        },
      },
      orderBy: {
        id: 'desc',
      },
      select: {
        folio: true,
      },
    });

    let numero = 1;
    if (ultimoFolio) {
      const partes = ultimoFolio.folio.split('-');
      numero = parseInt(partes[2], 10) + 1;
    }

    const folioFormateado = `COM-${año}-${String(numero).padStart(5, '0')}`;

    // Validar unicidad (aunque la DB lo garantiza con unique constraint)
    const existe = await prisma.compraRequisicion.findUnique({
      where: { folio: folioFormateado },
      select: { id: true },
    });

    if (existe) {
      // Si por alguna razón existe, incrementar e intentar de nuevo
      return generateFolioCompra(); // Recursivo, pero con poco riesgo real
    }

    return folioFormateado;
  } catch (error) {
    console.error('Error generando folio de compra:', error);
    throw new AppError(500, 'No se pudo generar folio de compra');
  }
}

/**
 * Genera folio único para Orden de Compra
 * Formato: ORD-2026-00001
 */
export async function generateFolioOrden(): Promise<string> {
  try {
    const año = new Date().getFullYear();

    const ultimoFolio = await prisma.compraOrden.findFirst({
      where: {
        folio: {
          startsWith: `ORD-${año}-`,
        },
      },
      orderBy: {
        id: 'desc',
      },
      select: {
        folio: true,
      },
    });

    let numero = 1;
    if (ultimoFolio) {
      const partes = ultimoFolio.folio.split('-');
      numero = parseInt(partes[2], 10) + 1;
    }

    const folioFormateado = `ORD-${año}-${String(numero).padStart(5, '0')}`;

    const existe = await prisma.compraOrden.findUnique({
      where: { folio: folioFormateado },
      select: { id: true },
    });

    if (existe) {
      return generateFolioOrden();
    }

    return folioFormateado;
  } catch (error) {
    console.error('Error generando folio de orden:', error);
    throw new AppError(500, 'No se pudo generar folio de orden');
  }
}

/**
 * Genera folio único para Orden de Pago
 * Formato: OPA-2026-00001
 */
export async function generateFolioOrdenPago(): Promise<string> {
  try {
    const año = new Date().getFullYear();

    const ultimoFolio = await prisma.compraOrdenPago.findFirst({
      where: {
        folio: {
          startsWith: `OPA-${año}-`,
        },
      },
      orderBy: {
        id: 'desc',
      },
      select: {
        folio: true,
      },
    });

    let numero = 1;
    if (ultimoFolio) {
      const partes = ultimoFolio.folio.split('-');
      numero = parseInt(partes[2], 10) + 1;
    }

    const folioFormateado = `OPA-${año}-${String(numero).padStart(5, '0')}`;

    const existe = await prisma.compraOrdenPago.findUnique({
      where: { folio: folioFormateado },
      select: { id: true },
    });

    if (existe) {
      return generateFolioOrdenPago();
    }

    return folioFormateado;
  } catch (error) {
    console.error('Error generando folio de orden pago:', error);
    throw new AppError(500, 'No se pudo generar folio de orden pago');
  }
}

/**
 * Genera folio único para Contra-Recibo
 * Formato: CR-00001
 */
export async function generateFolioContraRecibo(): Promise<string> {
  try {
    const ultimoContraRecibo = await prisma.contraRecibo.findFirst({
      orderBy: {
        id: 'desc',
      },
      select: {
        folio: true,
      },
    });

    let numero = 1;
    if (ultimoContraRecibo) {
      const partes = ultimoContraRecibo.folio.split('-');
      numero = parseInt(partes[1], 10) + 1;
    }

    const folioFormateado = `CR-${String(numero).padStart(5, '0')}`;

    const existe = await prisma.contraRecibo.findUnique({
      where: { folio: folioFormateado },
      select: { id: true },
    });

    if (existe) {
      return generateFolioContraRecibo();
    }

    return folioFormateado;
  } catch (error) {
    console.error('Error generando folio de contra-recibo:', error);
    throw new AppError(500, 'No se pudo generar folio de contra-recibo');
  }
}

/**
 * Genera folio único para Requisición
 * Formato: REQ-2026-00001
 */
export async function generateFolioRequisicion(): Promise<string> {
  try {
    const año = new Date().getFullYear();

    const ultimoFolio = await prisma.requisicion.findFirst({
      where: {
        folio: {
          startsWith: `REQ-${año}-`,
        },
      },
      orderBy: {
        id: 'desc',
      },
      select: {
        folio: true,
      },
    });

    let numero = 1;
    if (ultimoFolio) {
      const partes = ultimoFolio.folio.split('-');
      numero = parseInt(partes[2], 10) + 1;
    }

    const folioFormateado = `REQ-${año}-${String(numero).padStart(5, '0')}`;

    const existe = await prisma.requisicion.findUnique({
      where: { folio: folioFormateado },
      select: { id: true },
    });

    if (existe) {
      return generateFolioRequisicion();
    }

    return folioFormateado;
  } catch (error) {
    console.error('Error generando folio de requisición:', error);
    throw new AppError(500, 'No se pudo generar folio de requisición');
  }
}

/**
 * Genera código único para Producto
 * Formato: MED-001, INS-001, etc. basado en categoría
 */
export async function generateCodigoProducto(prefijo: string): Promise<string> {
  try {
    const ultimoProducto = await prisma.almacenProducto.findFirst({
      where: {
        codigo: {
          startsWith: prefijo,
        },
      },
      orderBy: {
        id: 'desc',
      },
      select: {
        codigo: true,
      },
    });

    let numero = 1;
    if (ultimoProducto) {
      const partes = ultimoProducto.codigo.split('-');
      numero = parseInt(partes[1], 10) + 1;
    }

    const codigoFormateado = `${prefijo}-${String(numero).padStart(3, '0')}`;

    const existe = await prisma.almacenProducto.findUnique({
      where: { codigo: codigoFormateado },
      select: { id: true },
    });

    if (existe) {
      return generateCodigoProducto(prefijo);
    }

    return codigoFormateado;
  } catch (error) {
    console.error('Error generando código de producto:', error);
    throw new AppError(500, 'No se pudo generar código de producto');
  }
}

/**
 * Obtiene el prefijo de categoría de producto
 */
export function getPrefijoCategoriaProducto(categoria: string): string {
  const prefijos: Record<string, string> = {
    MEDICAMENTO: 'MED',
    INSUMO_MEDICO: 'INS',
    MOBILIARIO: 'MOB',
    PAPELERIA: 'PAP',
    LIMPIEZA: 'LIM',
    ALIMENTO: 'ALI',
    OTRO: 'OTR',
  };

  return prefijos[categoria] || 'OTR';
}
