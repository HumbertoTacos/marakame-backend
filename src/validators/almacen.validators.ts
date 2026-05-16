import { z } from 'zod';
import { CategoriaProducto, TipoMovimiento, EstadoRecepcion, EstadoSalida } from '@prisma/client';

// ============================================================
// PRODUCTOS
// ============================================================

export const createProductoSchema = z.object({
  codigo: z.string().min(1, 'Código requerido').max(50, 'Código muy largo'),
  nombre: z.string().min(2, 'Nombre muy corto').max(200, 'Nombre muy largo'),
  descripcion: z.string().max(500, 'Descripción muy larga').optional(),
  categoria: z.nativeEnum(CategoriaProducto, {
    errorMap: () => ({ message: 'Categoría inválida' })
  }),
  unidad: z.string().min(1, 'Unidad requerida').max(50, 'Unidad muy larga').default('PIEZAS'),
  stockMinimo: z.number().int().nonnegative('Stock mínimo no puede ser negativo').default(5),
  ubicacion: z.string().max(100, 'Ubicación muy larga').optional(),
});

export type CreateProductoInput = z.infer<typeof createProductoSchema>;

export const updateProductoSchema = z.object({
  nombre: z.string().min(2, 'Nombre muy corto').max(200, 'Nombre muy largo').optional(),
  descripcion: z.string().max(500, 'Descripción muy larga').optional(),
  categoria: z.nativeEnum(CategoriaProducto).optional(),
  unidad: z.string().min(1).max(50).optional(),
  stockMinimo: z.number().int().nonnegative().optional(),
  ubicacion: z.string().max(100).optional(),
});

export type UpdateProductoInput = z.infer<typeof updateProductoSchema>;

// ============================================================
// MOVIMIENTOS
// ============================================================

export const registerMovimientoSchema = z.object({
  productoId: z.number().int().positive('Producto inválido'),
  tipo: z.nativeEnum(TipoMovimiento, {
    errorMap: () => ({ message: 'Tipo debe ser ENTRADA o SALIDA' })
  }),
  cantidad: z.number().int().positive('Cantidad debe ser mayor a 0'),
  requisicionId: z.number().int().positive().optional(),
  proveedor: z.string().max(200, 'Proveedor muy largo').optional(),
  numeroFactura: z.string().max(100, 'Número factura muy largo').optional(),
  importeFactura: z.number().positive('Importe debe ser mayor a 0').optional(),
  areaSolicitante: z.string().max(100, 'Área muy larga').optional(),
  motivo: z.string().max(500, 'Motivo muy largo').optional(),
  nombreRecibe: z.string().max(100, 'Nombre muy largo').optional(),
  observaciones: z.string().max(500, 'Observaciones muy largas').optional(),
  fechaCaducidad: z.date().optional(),
});

export type RegisterMovimientoInput = z.infer<typeof registerMovimientoSchema>;

export const aceptarRecepcionSchema = z.object({
  movimientoId: z.number().int().positive('Movimiento inválido'),
  empaqueCorrecto: z.boolean({ invalid_type_error: 'Empaque correcto requerido' }),
  cantidadCorrecta: z.boolean({ invalid_type_error: 'Cantidad correcta requerida' }),
  presentacionCorrecta: z.boolean({ invalid_type_error: 'Presentación correcta requerida' }),
  observaciones: z.string().max(500, 'Observaciones muy largas').optional(),
});

export type AceptarRecepcionInput = z.infer<typeof aceptarRecepcionSchema>;

export const rechazarRecepcionSchema = z.object({
  movimientoId: z.number().int().positive('Movimiento inválido'),
  motivoRechazo: z.string().min(5, 'Motivo muy corto').max(500, 'Motivo muy largo'),
});

export type RechazarRecepcionInput = z.infer<typeof rechazarRecepcionSchema>;

export const autorizarSalidaSchema = z.object({
  movimientoId: z.number().int().positive('Movimiento inválido'),
  observaciones: z.string().max(500, 'Observaciones muy largas').optional(),
});

export type AutorizarSalidaInput = z.infer<typeof autorizarSalidaSchema>;

export const entregarSalidaSchema = z.object({
  movimientoId: z.number().int().positive('Movimiento inválido'),
  nombreRecibe: z.string().min(2, 'Nombre muy corto').max(100, 'Nombre muy largo'),
  confirmadoRecibido: z.boolean().default(true),
  observaciones: z.string().max(500, 'Observaciones muy largas').optional(),
});

export type EntregarSalidaInput = z.infer<typeof entregarSalidaSchema>;

// ============================================================
// LOTES
// ============================================================

export const crearLoteSchema = z.object({
  productoId: z.number().int().positive('Producto inválido'),
  numeroLote: z.string().min(1, 'Número lote requerido').max(50, 'Número lote muy largo'),
  cantidad: z.number().int().positive('Cantidad debe ser mayor a 0'),
  fechaCaducidad: z.date({ required_error: 'Fecha caducidad requerida' }),
});

export type CrearLoteInput = z.infer<typeof crearLoteSchema>;

// ============================================================
// REQUISICIONES
// ============================================================

export const crearRequisicionSchema = z.object({
  areaSolicitante: z.string().min(2, 'Área muy corta').max(100, 'Área muy larga'),
  justificacion: z.string().min(10, 'Justificación muy corta').max(1000, 'Justificación muy larga'),
  detalles: z.array(
    z.object({
      productoId: z.number().int().positive('Producto inválido'),
      cantidadSolicitada: z.number().int().positive('Cantidad debe ser mayor a 0'),
      observaciones: z.string().max(500).optional(),
    }),
    { errorMap: () => ({ message: 'Detalles de requisición inválidos' }) }
  ).min(1, 'Debe tener al menos 1 detalle'),
});

export type CrearRequisicionInput = z.infer<typeof crearRequisicionSchema>;

export const revisarRequisicionSchema = z.object({
  requisicionId: z.number().int().positive('Requisición inválida'),
  observaciones: z.string().max(500, 'Observaciones muy largas').optional(),
});

export type RevisarRequisicionInput = z.infer<typeof revisarRequisicionSchema>;

// ============================================================
// FILTROS Y BÚSQUEDAS
// ============================================================

export const filtroProductosSchema = z.object({
  categoria: z.nativeEnum(CategoriaProducto).optional(),
  soloCriticos: z.boolean().default(false),
  soloBajos: z.boolean().default(false),
  page: z.number().int().positive().default(1),
  limit: z.number().int().positive().max(100).default(20),
});

export type FiltroProductosInput = z.infer<typeof filtroProductosSchema>;

export const filtroMovimientosSchema = z.object({
  productoId: z.number().int().positive().optional(),
  tipo: z.nativeEnum(TipoMovimiento).optional(),
  estado: z.enum(['PENDIENTE', 'ACEPTADO', 'RECHAZADO', 'AUTORIZADA', 'ENTREGADA', 'CANCELADA']).optional(),
  requisicionId: z.number().int().positive().optional(),
  fechaDesde: z.date().optional(),
  fechaHasta: z.date().optional(),
  page: z.number().int().positive().default(1),
  limit: z.number().int().positive().max(100).default(20),
});

export type FiltroMovimientosInput = z.infer<typeof filtroMovimientosSchema>;

export const filtroProximosVencerSchema = z.object({
  diasAnticipacion: z.number().int().positive().default(30),
  page: z.number().int().positive().default(1),
  limit: z.number().int().positive().max(100).default(20),
});

export type FiltroProximosVencerInput = z.infer<typeof filtroProximosVencerSchema>;
