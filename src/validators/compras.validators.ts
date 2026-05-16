import { z } from 'zod';
import { EstadoCompra, TipoCompra } from '@prisma/client';

// ============================================================
// REQUISICIÓN DE COMPRA
// ============================================================

export const createRequisicionSchema = z.object({
  requisicionId: z.number().int().positive('Requisición inválida'),
  tipo: z.nativeEnum(TipoCompra, {
    errorMap: () => ({ message: 'Tipo debe ser ORDINARIA o EXTRAORDINARIA' })
  }),
  presupuestoEstimado: z.number().positive('Presupuesto debe ser mayor a 0').optional(),
  esUrgente: z.boolean().default(false),
  observaciones: z.string().max(1000, 'Observaciones muy largas').optional(),
});

export type CreateRequisicionInput = z.infer<typeof createRequisicionSchema>;

// ============================================================
// COTIZACIONES
// ============================================================

export const cotizacionSchema = z.object({
  compraRequisicionId: z.number().int().positive('Compra inválida'),
  proveedorId: z.number().int().positive('Proveedor inválido'),
  precio: z.number().positive('Precio debe ser mayor a 0'),
  tiempoEntrega: z.string().max(100, 'Tiempo entrega muy largo').optional(),
  formaPago: z.string().max(100, 'Forma de pago muy larga').optional(),
  tipoCredito: z.string().max(100, 'Tipo crédito muy largo').optional(),
  documentoUrl: z.string().url('URL inválida del documento').optional(),
});

export type CotizacionInput = z.infer<typeof cotizacionSchema>;

// ============================================================
// SELECCIONAR PROVEEDOR GANADOR
// ============================================================

export const seleccionarProveedorSchema = z.object({
  compraRequisicionId: z.number().int().positive('Compra inválida'),
  proveedorSeleccionadoId: z.number().int().positive('Proveedor inválido'),
  totalFinal: z.number().positive('Total debe ser mayor a 0'),
  formaPago: z.string().max(100, 'Forma de pago muy larga').optional(),
  tipoCredito: z.string().max(100, 'Tipo crédito muy largo').optional(),
  observaciones: z.string().max(1000, 'Observaciones muy largas').optional(),
});

export type SeleccionarProveedorInput = z.infer<typeof seleccionarProveedorSchema>;

// ============================================================
// CAMBIAR ESTADO
// ============================================================

export const cambiarEstadoSchema = z.object({
  estado: z.nativeEnum(EstadoCompra, {
    errorMap: () => ({ message: 'Estado de compra inválido' })
  }),
  observaciones: z.string().max(1000, 'Observaciones muy largas').optional(),
  motivoRechazo: z.string().max(1000, 'Motivo rechazo muy largo').optional(),
});

export type CambiarEstadoInput = z.infer<typeof cambiarEstadoSchema>;

// ============================================================
// REGISTRAR FACTURA
// ============================================================

export const registrarFacturaSchema = z.object({
  compraRequisicionId: z.number().int().positive('Compra inválida'),
  numeroFactura: z.string().min(1, 'Número factura requerido').max(50),
  monto: z.number().positive('Monto debe ser mayor a 0'),
  documentoUrl: z.string().url('URL inválida del documento'),
});

export type RegistrarFacturaInput = z.infer<typeof registrarFacturaSchema>;

// ============================================================
// GENERAR ORDEN DE PAGO
// ============================================================

export const generarOrdenPagoSchema = z.object({
  compraRequisicionId: z.number().int().positive('Compra inválida'),
  folio: z.string().min(1, 'Folio requerido').max(50).optional(),
  asunto: z.string().max(200, 'Asunto muy largo').optional(),
  dirigidoA: z.string().max(200, 'Dirigido a muy largo').optional(),
  observaciones: z.string().max(1000, 'Observaciones muy largas').optional(),
});

export type GenerarOrdenPagoInput = z.infer<typeof generarOrdenPagoSchema>;

// ============================================================
// FILTROS Y BÚSQUEDAS
// ============================================================

export const filtroComprasSchema = z.object({
  estado: z.nativeEnum(EstadoCompra).optional(),
  tipo: z.nativeEnum(TipoCompra).optional(),
  proveedorId: z.number().int().positive().optional(),
  soloUrgentes: z.boolean().default(false),
  page: z.number().int().positive().default(1),
  limit: z.number().int().positive().max(100).default(20),
  ordenar: z.enum(['recientes', 'urgentes']).default('recientes'),
});

export type FiltroComprasInput = z.infer<typeof filtroComprasSchema>;

export const enviarAdministracionSchema = z.object({
  compraRequisicionId: z.number().int().positive('Compra inválida'),
  observaciones: z.string().max(1000).optional(),
});

export type EnviarAdministracionInput = z.infer<typeof enviarAdministracionSchema>;

export const aprobarAdministracionSchema = z.object({
  compraRequisicionId: z.number().int().positive('Compra inválida'),
  observacionesVoBo: z.string().max(1000).optional(),
});

export type AprobarAdministracionInput = z.infer<typeof aprobarAdministracionSchema>;

export const devolverAComprasSchema = z.object({
  compraRequisicionId: z.number().int().positive('Compra inválida'),
  motivoRechazo: z.string().min(10, 'Motivo debe tener al menos 10 caracteres').max(1000),
  observacionesVoBo: z.string().max(1000).optional(),
});

export type DevolverAComprasInput = z.infer<typeof devolverAComprasSchema>;

export const autorizarDireccionSchema = z.object({
  compraRequisicionId: z.number().int().positive('Compra inválida'),
  observaciones: z.string().max(1000).optional(),
});

export type AutorizarDireccionInput = z.infer<typeof autorizarDireccionSchema>;

export const rechazarDireccionSchema = z.object({
  compraRequisicionId: z.number().int().positive('Compra inválida'),
  motivoRechazo: z.string().min(10, 'Motivo debe tener al menos 10 caracteres').max(1000),
});

export type RechazarDireccionInput = z.infer<typeof rechazarDireccionSchema>;
