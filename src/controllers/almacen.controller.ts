import { Request, Response } from 'express';
import { prisma } from '../utils/prisma';
import { AppError } from '../middlewares/errorHandler';
import { crearNotificacion } from '../utils/notificaciones';

// ============================================================
// PRODUCTOS
// ============================================================

export const createProducto = async (req: Request, res: Response) => {
  const data = req.body;

  const prefixMap: Record<string, string> = {
    MEDICAMENTO:  'MED',
    INSUMO_MEDICO:'INS',
    ALIMENTO:     'ALI',
    LIMPIEZA:     'LIM',
    PAPELERIA:    'PAP',
    MOBILIARIO:   'MOB',
    OTRO:         'OTR',
  };

  let codigo = data.codigo as string | undefined;

  if (!codigo) {
    const categoria = data.categoria || 'OTRO';
    const prefix = prefixMap[categoria] ?? 'OTR';
    const count = await prisma.almacenProducto.count({ where: { categoria } });
    let attempt = count + 1;
    codigo = `${prefix}-${String(attempt).padStart(3, '0')}`;
    let existente = await prisma.almacenProducto.findUnique({ where: { codigo } });
    while (existente) {
      attempt++;
      codigo = `${prefix}-${String(attempt).padStart(3, '0')}`;
      existente = await prisma.almacenProducto.findUnique({ where: { codigo } });
    }
  } else {
    const existente = await prisma.almacenProducto.findUnique({ where: { codigo } });
    if (existente) {
      throw new AppError(400, 'Ya existe un producto con este código.');
    }
  }

  const producto = await prisma.almacenProducto.create({
    data: {
      codigo,
      nombre: data.nombre,
      descripcion: data.descripcion,
      categoria: data.categoria || 'OTRO',
      unidad: data.unidad || 'PIEZAS',
      stockMinimo: data.stockMinimo || 5,
      stockActual: 0,
      estadoStock: 'NORMAL',
      ubicacion: data.ubicacion || null
    }
  });

  res.status(201).json({
    success: true,
    data: producto
  });
};

export const getProductos = async (_req: Request, res: Response) => {
  const productos = await prisma.almacenProducto.findMany({
    orderBy: { nombre: 'asc' }
  });

  res.json({
    success: true,
    data: productos
  });
};

export const getProductoById = async (req: Request, res: Response) => {
  const id = parseInt(req.params.id as string, 10);

  if (isNaN(id) || id <= 0) {
    throw new AppError(400, 'Debes seleccionar un producto válido');
  }

  const producto = await prisma.almacenProducto.findUnique({
    where: { id }
  });

  if (!producto) {
    throw new AppError(404, 'Producto no encontrado');
  }

  res.json({
    success: true,
    data: producto
  });
};

export const updateProducto = async (req: Request, res: Response) => {
  const id = parseInt(req.params.id as string, 10);

  const data = req.body;

  const producto = await prisma.almacenProducto.update({
    where: { id },
    data: {
      nombre: data.nombre,
      descripcion: data.descripcion,
      categoria: data.categoria,
      unidad: data.unidad,
      stockMinimo: data.stockMinimo,
      ubicacion: data.ubicacion
    }
  });

  const estadoStock =
    producto.stockActual <= 0
      ? 'CRITICO'
      : (
          producto.stockActual <= producto.stockMinimo
            ? 'BAJO'
            : 'NORMAL'
        );

  if (producto.estadoStock !== estadoStock) {
    await prisma.almacenProducto.update({
      where: { id: producto.id },
      data: { estadoStock }
    });
  }

  res.json({
    success: true,
    data: producto
  });
};

// ============================================================
// MOVIMIENTOS
// ============================================================

export const registerMovimiento = async (req: Request, res: Response) => {

  const {
    productoId,
    tipo,
    cantidad,
    requisicionId,
    proveedor,
    numeroFactura,
    importeFactura,
    fechaCaducidad,
    empaqueCorrecto,
    cantidadCorrecta,
    presentacionCorrecta,
    estadoRecepcion,
    areaSolicitante,
    motivo,
    nombreRecibe,
    observaciones,
  } = req.body;

  const usuarioId = req.usuario!.id;

  // ============================================================
  // 1. VALIDAR tipo
  // ============================================================

  if (!tipo || (tipo !== 'ENTRADA' && tipo !== 'SALIDA')) {
    throw new AppError(400, 'El campo tipo es obligatorio y debe ser ENTRADA o SALIDA');
  }

  // ============================================================
  // 2. VALIDAR productoId
  // ============================================================

  const productoIdNum = parseInt(String(productoId), 10);
  if (!productoId || isNaN(productoIdNum) || productoIdNum <= 0) {
    throw new AppError(400, 'Debes seleccionar un producto válido');
  }

  // ============================================================
  // 3. VALIDAR cantidad
  // ============================================================

  const cantidadNumero = Math.round(Number(cantidad));
  if (!cantidad || isNaN(cantidadNumero) || cantidadNumero <= 0) {
    throw new AppError(400, 'La cantidad debe ser un número entero mayor a 0');
  }

  // ============================================================
  // 4. VERIFICAR EXISTENCIA DEL PRODUCTO
  // ============================================================

  const producto = await prisma.almacenProducto.findUnique({
    where: { id: productoIdNum },
  });

  if (!producto) {
    throw new AppError(404, 'Producto no encontrado');
  }

  // ============================================================
  // 5. VALIDAR REQUISICIÓN (si se proporciona)
  // ============================================================

  let requisicionIdNum: number | undefined;

  if (requisicionId !== undefined && requisicionId !== null && requisicionId !== '') {
    requisicionIdNum = parseInt(String(requisicionId), 10);

    if (isNaN(requisicionIdNum) || requisicionIdNum <= 0) {
      throw new AppError(400, 'El requisicionId proporcionado no es válido');
    }

    const requisicion = await prisma.compraRequisicion.findUnique({
      where: { id: requisicionIdNum },
      include: { detalles: true },
    });

    if (!requisicion) {
      throw new AppError(404, 'Requisición no encontrada');
    }

    // Verificar que el producto pertenezca a la requisición (coincidencia por nombre)
    const perteneceARequisicion = requisicion.detalles.some(
      (d) => d.producto.toLowerCase().includes(producto.nombre.toLowerCase()) ||
             producto.nombre.toLowerCase().includes(d.producto.toLowerCase())
    );

    if (!perteneceARequisicion) {
      throw new AppError(
        400,
        `El producto "${producto.nombre}" no está en la requisición ${requisicion.folio}`
      );
    }
  }

  // ============================================================
  // 6. VALIDAR CADUCIDAD (MEDICAMENTO / ALIMENTO)
  // ============================================================

  let fechaCaducidadDate: Date | null = null;

  if (fechaCaducidad) {
    const parsedDate = new Date(fechaCaducidad);
    if (isNaN(parsedDate.getTime())) {
      throw new AppError(400, 'La fecha de caducidad no es válida');
    }
    fechaCaducidadDate = parsedDate;
  }

  if (
    tipo === 'ENTRADA' &&
    (producto.categoria === 'MEDICAMENTO' || producto.categoria === 'ALIMENTO')
  ) {
    if (!fechaCaducidadDate) {
      throw new AppError(
        400,
        `Los productos de categoría ${producto.categoria} requieren fecha de caducidad`
      );
    }

    const hoy = new Date();
    const mesesDif =
      (fechaCaducidadDate.getFullYear() - hoy.getFullYear()) * 12 +
      (fechaCaducidadDate.getMonth() - hoy.getMonth());

    if (mesesDif < 6) {
      throw new AppError(400, 'El producto debe tener mínimo 6 meses de vigencia');
    }
  }

  // ============================================================
  // 7. VALIDAR INSPECCIÓN VISUAL
  // ============================================================

  if (tipo === 'ENTRADA') {
    const falloEmpaque      = empaqueCorrecto      === false || empaqueCorrecto      === 'false';
    const falloCantidad     = cantidadCorrecta     === false || cantidadCorrecta     === 'false';
    const falloPresentacion = presentacionCorrecta === false || presentacionCorrecta === 'false';

    if (falloEmpaque || falloCantidad || falloPresentacion) {
      throw new AppError(400, 'La mercancía no pasó la inspección visual');
    }
  }

  // ============================================================
  // 8. VALIDAR STOCK EN SALIDAS
  // ============================================================

  if (tipo === 'SALIDA' && producto.stockActual < cantidadNumero) {
    throw new AppError(
      400,
      `Stock insuficiente. Disponible: ${producto.stockActual}, solicitado: ${cantidadNumero}`
    );
  }

  // ============================================================
  // 9. NORMALIZAR BOOLEANOS DE INSPECCIÓN
  // ============================================================

  const toBoolean = (val: unknown): boolean | null => {
    if (val === true  || val === 'true')  return true;
    if (val === false || val === 'false') return false;
    return null;
  };

  // ============================================================
  // 10. CREAR MOVIMIENTO
  // ============================================================
  // estadoRecepcion no es nullable en el schema: para SALIDA se omite → usa default PENDIENTE

  const movimiento = await prisma.almacenMovimiento.create({
    data: {
      productoId:   productoIdNum,
      usuarioId,
      tipo,
      cantidad:     cantidadNumero,
      requisicionId: requisicionIdNum,

      // ENTRADAS
      proveedor:            proveedor      || null,
      numeroFactura:        numeroFactura  || null,
      importeFactura:       importeFactura ? Number(importeFactura) : null,
      fechaCaducidad:       fechaCaducidadDate,
      empaqueCorrecto:      toBoolean(empaqueCorrecto),
      cantidadCorrecta:     toBoolean(cantidadCorrecta),
      presentacionCorrecta: toBoolean(presentacionCorrecta),
      ...(tipo === 'ENTRADA' && {
        estadoRecepcion: estadoRecepcion || 'ACEPTADO',
      }),

      // SALIDAS
      areaSolicitante:    areaSolicitante || null,
      motivo:             motivo          || null,
      nombreRecibe:       nombreRecibe    || null,
      confirmadoRecibido: false,
      estadoSalida:       tipo === 'SALIDA' ? 'PENDIENTE' : null,

      // GENERALES
      observaciones: observaciones || null,
    },
  });

  // ============================================================
  // 11. ACTUALIZAR STOCK
  // ============================================================

  const puedeActualizarStock =
    (tipo === 'ENTRADA' && movimiento.estadoRecepcion === 'ACEPTADO') ||
    tipo === 'SALIDA';

  if (puedeActualizarStock) {
    const nuevoStock =
      tipo === 'ENTRADA'
        ? producto.stockActual + cantidadNumero
        : producto.stockActual - cantidadNumero;

    const estadoStock =
      nuevoStock <= 0
        ? 'CRITICO'
        : nuevoStock <= producto.stockMinimo
        ? 'BAJO'
        : 'NORMAL';

    await prisma.almacenProducto.update({
      where: { id: productoIdNum },
      data: { stockActual: nuevoStock, estadoStock },
    });
  }

  // ============================================================
  // 12. CREAR LOTE AUTOMÁTICO
  // ============================================================

  if (tipo === 'ENTRADA' && fechaCaducidadDate && movimiento.estadoRecepcion === 'ACEPTADO') {
    await prisma.almacenLote.create({
      data: {
        productoId:     productoIdNum,
        numeroLote:     `LOTE-${Date.now()}`,
        fechaCaducidad: fechaCaducidadDate,
        cantidad:       cantidadNumero,
      },
    });
  }

  // ============================================================
  // 13. RESPUESTA
  // ============================================================

  const auditBody = { ...req.body };
  delete auditBody.productoId;
  auditBody.producto = producto.nombre;
  res.locals.auditBodyOverride = auditBody;

  res.status(201).json({
    success: true,
    message: tipo === 'ENTRADA'
      ? 'Entrada registrada correctamente'
      : 'Salida registrada correctamente',
    data: movimiento,
  });
};

// ============================================================
// OBTENER MOVIMIENTOS
// ============================================================

export const getMovimientos = async (req: Request, res: Response) => {

  const {
    productoId,
    tipo
  } = req.query;

  const whereArgs: any = {};

  if (productoId) {
    whereArgs.productoId = parseInt(productoId as string, 10);
  }

  if (tipo) {
    whereArgs.tipo = tipo as string;
  }

  const movimientos = await prisma.almacenMovimiento.findMany({
    where: whereArgs,
    include: {

      producto: {
        select: {
          codigo: true,
          nombre: true,
          unidad: true
        }
      },

      usuario: {
        select: {
          nombre: true,
          apellidos: true
        }
      },

      contraRecibo: true
    },
    orderBy: {
      createdAt: 'desc'
    },
    take: 100
  });

  res.json({
    success: true,
    data: movimientos
  });
};

// ============================================================
// ACEPTAR RECEPCIÓN
// ============================================================

export const aceptarRecepcion = async (
  req: Request,
  res: Response
) => {

  const id = parseInt(req.params.id as string, 10);

  const movimiento = await prisma.almacenMovimiento.findUnique({
    where: { id },
    include: {
      producto: true
    }
  });

  if (!movimiento) {
    throw new AppError(404, 'Movimiento no encontrado');
  }

  if (movimiento.tipo !== 'ENTRADA') {
    throw new AppError(400, 'Solo aplica a entradas');
  }

  if (movimiento.estadoRecepcion === 'ACEPTADO') {
    throw new AppError(400, 'La recepción ya fue aceptada');
  }

  const nuevoStock =
    movimiento.producto.stockActual + movimiento.cantidad;

  const estadoStock =
    nuevoStock <= 0
      ? 'CRITICO'
      : (
          nuevoStock <= movimiento.producto.stockMinimo
            ? 'BAJO'
            : 'NORMAL'
        );

  await prisma.almacenMovimiento.update({
    where: { id },
    data: {
      estadoRecepcion: 'ACEPTADO'
    }
  });

  await prisma.almacenProducto.update({
    where: {
      id: movimiento.productoId
    },
    data: {
      stockActual: nuevoStock,
      estadoStock
    }
  });

  // Generar notificación si el stock es bajo o crítico
  if (estadoStock === 'CRITICO' || estadoStock === 'BAJO') {
    await crearNotificacion({
      titulo: `Stock ${estadoStock}: ${movimiento.producto.nombre}`,
      mensaje:
        `El producto ${movimiento.producto.nombre} ` +
        `(${movimiento.producto.codigo}) ha alcanzado un nivel ` +
        `${estadoStock.toLowerCase()}. ` +
        `Stock actual: ${nuevoStock} ${movimiento.producto.unidad}.`,
      tipo: estadoStock === 'CRITICO' ? 'ERROR' : 'ALERTA',
      rol: 'ALMACEN',
      link: '/almacen'
    });
  }

  res.json({
    success: true,
    message: 'Recepción aceptada correctamente'
  });
};

// ============================================================
// RECHAZAR RECEPCIÓN
// ============================================================

export const rechazarRecepcion = async (
  req: Request,
  res: Response
) => {

  const id = parseInt(req.params.id as string, 10);

  const {
    motivoRechazo
  } = req.body;

  const movimiento = await prisma.almacenMovimiento.findUnique({
    where: { id }
  });

  if (!movimiento) {
    throw new AppError(404, 'Movimiento no encontrado');
  }

  await prisma.almacenMovimiento.update({
    where: { id },
    data: {
      estadoRecepcion: 'RECHAZADO',
      motivoRechazo
    }
  });

  res.json({
    success: true,
    message: 'Recepción rechazada correctamente'
  });
};

// ============================================================
// AUTORIZAR SALIDA
// ============================================================

export const autorizarSalida = async (
  req: Request,
  res: Response
) => {

  const id = parseInt(req.params.id as string, 10);

  const movimiento = await prisma.almacenMovimiento.findUnique({
    where: { id }
  });

  if (!movimiento) {
    throw new AppError(404, 'Movimiento no encontrado');
  }

  if (movimiento.tipo !== 'SALIDA') {
    throw new AppError(400, 'Solo aplica a salidas');
  }

  await prisma.almacenMovimiento.update({
    where: { id },
    data: {
      estadoSalida: 'AUTORIZADA'
    }
  });

  res.json({
    success: true,
    message: 'Salida autorizada'
  });
};

// ============================================================
// ENTREGAR SALIDA
// ============================================================

export const entregarSalida = async (
  req: Request,
  res: Response
) => {

  const id = parseInt(req.params.id as string, 10);

  const movimiento = await prisma.almacenMovimiento.findUnique({
    where: { id }
  });

  if (!movimiento) {
    throw new AppError(404, 'Movimiento no encontrado');
  }

  await prisma.almacenMovimiento.update({
    where: { id },
    data: {
      estadoSalida: 'ENTREGADA',
      confirmadoRecibido: true,
      fechaEntrega: new Date()
    }
  });

  res.json({
    success: true,
    message: 'Salida entregada correctamente'
  });
};