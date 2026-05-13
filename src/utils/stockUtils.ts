import { EstadoStock } from '@prisma/client';
import { AppError } from '../middlewares/errorHandler';

/**
 * Calcula el estado del stock basado en cantidad y mínimo
 */
export function calcularEstadoStock(stockActual: number, stockMinimo: number): EstadoStock {
  if (stockActual <= 0) {
    return EstadoStock.CRITICO;
  }

  if (stockActual <= stockMinimo) {
    return EstadoStock.BAJO;
  }

  return EstadoStock.NORMAL;
}

/**
 * Determina si un producto está próximo a vencer
 * @param fechaCaducidad Fecha de caducidad del producto
 * @param diasAnticipacion Días antes del vencimiento (default: 30)
 */
export function estaProximoAVencer(fechaCaducidad: Date, diasAnticipacion: number = 30): boolean {
  if (!fechaCaducidad) return false;

  const hoy = new Date();
  const fechaLimite = new Date(hoy);
  fechaLimite.setDate(fechaLimite.getDate() + diasAnticipacion);

  return fechaCaducidad <= fechaLimite;
}

/**
 * Determina si un producto está vencido
 */
export function estaVencido(fechaCaducidad: Date): boolean {
  if (!fechaCaducidad) return false;

  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const fecha = new Date(fechaCaducidad);
  fecha.setHours(0, 0, 0, 0);

  return fecha < hoy;
}

/**
 * Valida que la fecha de caducidad sea válida
 * Para medicamentos/alimentos: mínimo 6 meses en el futuro
 */
export function validarCaducidad(fechaCaducidad: Date | null | undefined, esProductoPerecible: boolean = true): boolean {
  if (!esProductoPerecible) return true;

  if (!fechaCaducidad) {
    throw new AppError(400, 'Fecha de caducidad requerida para productos perecederos');
  }

  const hoy = new Date();
  const seiseMeses = new Date(hoy);
  seiseMeses.setMonth(seiseMeses.getMonth() + 6);

  if (fechaCaducidad < seiseMeses) {
    throw new AppError(400, 'Fecha de caducidad debe ser al menos 6 meses en el futuro');
  }

  if (fechaCaducidad < hoy) {
    throw new AppError(400, 'Fecha de caducidad no puede ser en el pasado');
  }

  return true;
}

/**
 * Valida que la cantidad sea válida
 */
export function validarCantidad(cantidad: number | null | undefined, minimo: number = 1): void {
  if (cantidad === null || cantidad === undefined) {
    throw new AppError(400, 'Cantidad es requerida');
  }

  if (!Number.isInteger(cantidad) || cantidad < minimo) {
    throw new AppError(400, `Cantidad debe ser un número entero >= ${minimo}`);
  }
}

/**
 * Calcula si hay suficiente stock para una salida
 */
export function hayStockSuficiente(stockActual: number, cantidadRequerida: number): boolean {
  return stockActual >= cantidadRequerida;
}

/**
 * Formatea el estado de stock para presentación
 */
export function formatearEstadoStock(estado: EstadoStock): string {
  const formatos: Record<EstadoStock, string> = {
    [EstadoStock.CRITICO]: 'Crítico',
    [EstadoStock.BAJO]: 'Bajo',
    [EstadoStock.NORMAL]: 'Normal',
  };

  return formatos[estado] || 'Desconocido';
}

/**
 * Determina si un producto es perecedero (requiere control de caducidad)
 */
export function esProductoPerecible(categoria: string): boolean {
  const perecederos = ['MEDICAMENTO', 'ALIMENTO'];
  return perecederos.includes(categoria);
}

/**
 * Calcula días hasta vencimiento
 */
export function calcularDiasAVencimiento(fechaCaducidad: Date): number {
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);

  const fecha = new Date(fechaCaducidad);
  fecha.setHours(0, 0, 0, 0);

  const diferencia = fecha.getTime() - hoy.getTime();
  const dias = Math.ceil(diferencia / (1000 * 60 * 60 * 24));

  return dias;
}

/**
 * Valida que el stock no sea negativo después de una operación
 */
export function validarStockNoNegativo(stockFinal: number): void {
  if (stockFinal < 0) {
    throw new AppError(400, 'Stock insuficiente para esta operación');
  }
}

/**
 * Obtiene el color/indicador visual para estado de stock
 */
export function getIndicadorStock(estado: EstadoStock): string {
  const indicadores: Record<EstadoStock, string> = {
    [EstadoStock.CRITICO]: '🔴',
    [EstadoStock.BAJO]: '🟠',
    [EstadoStock.NORMAL]: '🟢',
  };

  return indicadores[estado] || '⚪';
}

/**
 * Valida que los datos de inspección de entrada sean correctos
 */
export function validarInspeccionEntrada(
  empaqueCorrecto: boolean,
  cantidadCorrecta: boolean,
  presentacionCorrecta: boolean
): { valido: boolean; detalles: string[] } {
  const detalles: string[] = [];

  if (!empaqueCorrecto) {
    detalles.push('Empaque incorrecto o dañado');
  }

  if (!cantidadCorrecta) {
    detalles.push('Cantidad no coincide con factura');
  }

  if (!presentacionCorrecta) {
    detalles.push('Presentación del producto incorrecto');
  }

  return {
    valido: detalles.length === 0,
    detalles,
  };
}

/**
 * Obtiene descripción legible del motivo de rechazo
 */
export function obtenerDescripcionRechazo(empaqueCorrecto: boolean, cantidadCorrecta: boolean, presentacionCorrecta: boolean): string {
  const razones: string[] = [];

  if (!empaqueCorrecto) razones.push('empaque dañado');
  if (!cantidadCorrecta) razones.push('cantidad incorrecta');
  if (!presentacionCorrecta) razones.push('presentación incorrecta');

  return razones.length > 0 ? razones.join(', ') : 'Motivo no especificado';
}
