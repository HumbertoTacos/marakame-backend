import { z } from 'zod';
import { EstadoContraRecibo } from '@prisma/client';

// ============================================================
// CREAR CONTRA RECIBO
// ============================================================

export const createContraReciboSchema = z.object({
  movimientoId: z.number().int().positive('Movimiento inválido'),
  proveedorId: z.number().int().positive('Proveedor inválido'),
  numeroFactura: z.string().min(1, 'Número factura requerido').max(100, 'Número factura muy largo'),
  importe: z.number().positive('Importe debe ser mayor a 0'),
  fechaPagoProgramado: z.date({ invalid_type_error: 'Fecha de pago programado inválida' }).optional(),
});

export type CreateContraReciboInput = z.infer<typeof createContraReciboSchema>;

// ============================================================
// CAMBIAR ESTADO
// ============================================================

export const cambiarEstadoSchema = z.object({
  contraReciboId: z.number().int().positive('Contra-recibo inválido'),
  estado: z.nativeEnum(EstadoContraRecibo, {
    errorMap: () => ({ message: 'Estado de contra-recibo inválido' })
  }),
});

export type CambiarEstadoInput = z.infer<typeof cambiarEstadoSchema>;

// ============================================================
// PROGRAMAR PAGO
// ============================================================

export const programarPagoSchema = z.object({
  contraReciboId: z.number().int().positive('Contra-recibo inválido'),
  fechaPagoProgramado: z.date({ invalid_type_error: 'Fecha de pago inválida' }),
});

export type ProgramarPagoInput = z.infer<typeof programarPagoSchema>;

// ============================================================
// MARCAR PAGADO
// ============================================================

export const marcarPagadoSchema = z.object({
  contraReciboId: z.number().int().positive('Contra-recibo inválido'),
  fechaPago: z.date({ invalid_type_error: 'Fecha de pago inválida' }).optional(),
});

export type MarcarPagadoInput = z.infer<typeof marcarPagadoSchema>;

// ============================================================
// CANCELAR CONTRA RECIBO
// ============================================================

export const cancelarContraReciboSchema = z.object({
  contraReciboId: z.number().int().positive('Contra-recibo inválido'),
  motivo: z.string().min(5, 'Motivo muy corto').max(500, 'Motivo muy largo'),
});

export type CancelarContraReciboInput = z.infer<typeof cancelarContraReciboSchema>;

// ============================================================
// GENERAR PDF
// ============================================================

export const generarPdfSchema = z.object({
  contraReciboId: z.number().int().positive('Contra-recibo inválido'),
});

export type GenerarPdfInput = z.infer<typeof generarPdfSchema>;

// ============================================================
// FILTROS Y BÚSQUEDAS
// ============================================================

export const filtroContraRecibosSchema = z.object({
  estado: z.nativeEnum(EstadoContraRecibo).optional(),
  proveedorId: z.number().int().positive().optional(),
  fechaDesde: z.date().optional(),
  fechaHasta: z.date().optional(),
  soloVencidos: z.boolean().default(false),
  soloProximosVencer: z.boolean().default(false),
  page: z.number().int().positive().default(1),
  limit: z.number().int().positive().max(100).default(20),
  ordenar: z.enum(['vencidos-primero', 'proximos-vencer']).default('vencidos-primero'),
});

export type FiltroContraRecibosInput = z.infer<typeof filtroContraRecibosSchema>;

export const dashboardSchema = z.object({
  diasProximosVencer: z.number().int().positive().default(7),
});

export type DashboardInput = z.infer<typeof dashboardSchema>;
