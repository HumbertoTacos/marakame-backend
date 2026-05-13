import { EstadoCompra, EstadoRequisicion, EstadoContraRecibo, EstadoRecepcion, EstadoSalida } from '@prisma/client';
import { AppError } from '../middlewares/errorHandler';

// ============================================================
// MÁQUINA DE ESTADOS: COMPRA REQUISICIÓN
// ============================================================

const compraTransiciones: Record<EstadoCompra, EstadoCompra[]> = {
  EN_COMPRAS: [EstadoCompra.COTIZACIONES_CARGADAS],
  COTIZACIONES_CARGADAS: [EstadoCompra.EN_REVISION_ADMINISTRACION, EstadoCompra.EN_COMPRAS],
  EN_REVISION_ADMINISTRACION: [EstadoCompra.EN_REVISION_DIRECCION, EstadoCompra.DEVUELTA_A_COMPRAS],
  DEVUELTA_A_COMPRAS: [EstadoCompra.COTIZACIONES_CARGADAS, EstadoCompra.EN_COMPRAS, EstadoCompra.EN_REVISION_ADMINISTRACION],
  EN_REVISION_DIRECCION: [EstadoCompra.AUTORIZADA, EstadoCompra.RECHAZADO],
  AUTORIZADA: [EstadoCompra.ORDEN_GENERADA],
  ORDEN_GENERADA: [EstadoCompra.FACTURAS_RECIBIDAS],
  FACTURAS_RECIBIDAS: [EstadoCompra.EXPEDIENTE_GENERADO],
  EXPEDIENTE_GENERADO: [EstadoCompra.ENVIADA_A_FINANZAS, EstadoCompra.FINALIZADO],
  ENVIADA_A_FINANZAS: [EstadoCompra.FINALIZADO],
  FINALIZADO: [],
  RECHAZADO: [],

  // Estados antiguos (permitir transiciones para compatibilidad)
  REQUISICION_CREADA: [EstadoCompra.EN_REVISION_RECURSOS],
  EN_REVISION_RECURSOS: [EstadoCompra.EN_REVISION_COMPRAS],
  EN_REVISION_COMPRAS: [EstadoCompra.PROVEEDOR_SELECCIONADO],
  PROVEEDOR_SELECCIONADO: [EstadoCompra.NEGOCIACION_COMPLETADA],
  NEGOCIACION_COMPLETADA: [EstadoCompra.ORDEN_PAGO_GENERADA],
  ORDEN_PAGO_GENERADA: [EstadoCompra.PAGO_GENERADO],
  PAGO_GENERADO: [],
  REQUISICION_REVISADA: [],
  EN_REVISION_ADMIN: [],
  EN_AUTORIZACION_DIRECCION: [],
};

/**
 * Valida que la transición de estado sea permitida
 */
export function validarTransicionCompra(estadoActual: EstadoCompra, estadoNuevo: EstadoCompra): void {
  const transicionesPermitidas = compraTransiciones[estadoActual];

  if (!transicionesPermitidas || !transicionesPermitidas.includes(estadoNuevo)) {
    throw new AppError(
      409,
      `Transición no permitida: de ${estadoActual} a ${estadoNuevo}`
    );
  }
}

// ============================================================
// MÁQUINA DE ESTADOS: REQUISICIÓN
// ============================================================

const requisicionTransiciones: Record<EstadoRequisicion, EstadoRequisicion[]> = {
  CREADA: [EstadoRequisicion.EN_REVISION_ALMACEN],
  EN_REVISION_ALMACEN: [
    EstadoRequisicion.SURTIDA,
    EstadoRequisicion.PARCIAL,
    EstadoRequisicion.SIN_EXISTENCIA,
    EstadoRequisicion.ENVIADA_A_COMPRAS
  ],
  SURTIDA: [EstadoRequisicion.FINALIZADA],
  PARCIAL: [EstadoRequisicion.ENVIADA_A_COMPRAS, EstadoRequisicion.FINALIZADA],
  SIN_EXISTENCIA: [EstadoRequisicion.ENVIADA_A_COMPRAS],
  ENVIADA_A_COMPRAS: [EstadoRequisicion.EN_REVISION_ADMINISTRATIVA, EstadoRequisicion.DEVUELTA_A_COMPRAS],
  EN_REVISION_ADMINISTRATIVA: [
    EstadoRequisicion.EN_AUTORIZACION_DIRECCION,
    EstadoRequisicion.DEVUELTA_A_COMPRAS,
    EstadoRequisicion.RECHAZADA
  ],
  DEVUELTA_A_COMPRAS: [EstadoRequisicion.ENVIADA_A_COMPRAS],
  EN_AUTORIZACION_DIRECCION: [EstadoRequisicion.AUTORIZADA, EstadoRequisicion.RECHAZADA],
  AUTORIZADA: [EstadoRequisicion.ORDEN_GENERADA],
  ORDEN_GENERADA: [EstadoRequisicion.FACTURAS_RECIBIDAS],
  FACTURAS_RECIBIDAS: [EstadoRequisicion.EXPEDIENTE_GENERADO],
  EXPEDIENTE_GENERADO: [EstadoRequisicion.ENVIADA_A_FINANZAS],
  ENVIADA_A_FINANZAS: [EstadoRequisicion.FINALIZADA],
  FINALIZADA: [],
  RECHAZADA: [],
};

/**
 * Valida que la transición de requisición sea permitida
 */
export function validarTransicionRequisicion(estadoActual: EstadoRequisicion, estadoNuevo: EstadoRequisicion): void {
  const transicionesPermitidas = requisicionTransiciones[estadoActual];

  if (!transicionesPermitidas || !transicionesPermitidas.includes(estadoNuevo)) {
    throw new AppError(
      409,
      `Transición no permitida: de ${estadoActual} a ${estadoNuevo}`
    );
  }
}

// ============================================================
// MÁQUINA DE ESTADOS: CONTRA RECIBO
// ============================================================

const contraReciboTransiciones: Record<EstadoContraRecibo, EstadoContraRecibo[]> = {
  PENDIENTE: [EstadoContraRecibo.PAGADO, EstadoContraRecibo.CANCELADO],
  PAGADO: [EstadoContraRecibo.CANCELADO],
  CANCELADO: [],
};

/**
 * Valida que la transición de contra-recibo sea permitida
 */
export function validarTransicionContraRecibo(estadoActual: EstadoContraRecibo, estadoNuevo: EstadoContraRecibo): void {
  const transicionesPermitidas = contraReciboTransiciones[estadoActual];

  if (!transicionesPermitidas || !transicionesPermitidas.includes(estadoNuevo)) {
    throw new AppError(
      409,
      `Transición no permitida: de ${estadoActual} a ${estadoNuevo}`
    );
  }
}

// ============================================================
// MÁQUINA DE ESTADOS: RECEPCIÓN
// ============================================================

const recepcionTransiciones: Record<EstadoRecepcion, EstadoRecepcion[]> = {
  PENDIENTE: [EstadoRecepcion.ACEPTADO, EstadoRecepcion.RECHAZADO],
  ACEPTADO: [],
  RECHAZADO: [EstadoRecepcion.PENDIENTE], // Permitir reintentar
};

/**
 * Valida que la transición de recepción sea permitida
 */
export function validarTransicionRecepcion(estadoActual: EstadoRecepcion, estadoNuevo: EstadoRecepcion): void {
  const transicionesPermitidas = recepcionTransiciones[estadoActual];

  if (!transicionesPermitidas || !transicionesPermitidas.includes(estadoNuevo)) {
    throw new AppError(
      409,
      `Transición no permitida: de ${estadoActual} a ${estadoNuevo}`
    );
  }
}

// ============================================================
// MÁQUINA DE ESTADOS: SALIDA
// ============================================================

const salidaTransiciones: Record<EstadoSalida, EstadoSalida[]> = {
  PENDIENTE: [EstadoSalida.AUTORIZADA, EstadoSalida.CANCELADA],
  AUTORIZADA: [EstadoSalida.ENTREGADA, EstadoSalida.CANCELADA],
  ENTREGADA: [],
  CANCELADA: [],
};

/**
 * Valida que la transición de salida sea permitida
 */
export function validarTransicionSalida(estadoActual: EstadoSalida, estadoNuevo: EstadoSalida): void {
  const transicionesPermitidas = salidaTransiciones[estadoActual];

  if (!transicionesPermitidas || !transicionesPermitidas.includes(estadoNuevo)) {
    throw new AppError(
      409,
      `Transición no permitida: de ${estadoActual} a ${estadoNuevo}`
    );
  }
}

// ============================================================
// HELPERS
// ============================================================

/**
 * Obtiene las transiciones permitidas desde un estado
 */
export function obtenerTransicionesPermitidas(estadoActual: EstadoCompra | EstadoRequisicion | EstadoContraRecibo): string[] {
  const maquinas: Record<string, Record<string, string[]>> = {
    compra: compraTransiciones as any,
    requisicion: requisicionTransiciones as any,
    contraRecibo: contraReciboTransiciones as any,
  };

  for (const [, transiciones] of Object.entries(maquinas)) {
    if (transiciones[estadoActual as any]) {
      return transiciones[estadoActual as any];
    }
  }

  return [];
}
