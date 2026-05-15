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
      estadoStock: 'CRITICO',
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

    const requisicion = await prisma.requisicion.findUnique({
      where: { id: requisicionIdNum },
    });

    if (!requisicion) {
      throw new AppError(404, 'Requisición no encontrada');
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

// ============================================================
// ELIMINAR PRODUCTO (hard delete — sin campo deletedAt en schema)
// ============================================================

export const deleteProducto = async (req: Request, res: Response) => {
  const id = parseInt(req.params.id as string, 10);

  const producto = await prisma.almacenProducto.findUnique({ where: { id } });
  if (!producto) throw new AppError(404, 'Producto no encontrado');

  const tieneMovimientos = await prisma.almacenMovimiento.count({ where: { productoId: id } });
  if (tieneMovimientos > 0) {
    throw new AppError(
      400,
      'No se puede eliminar un producto con movimientos registrados'
    );
  }

  await prisma.almacenLote.deleteMany({ where: { productoId: id } });
  await prisma.almacenProducto.delete({ where: { id } });

  res.json({ success: true, message: 'Producto eliminado correctamente' });
};

// ============================================================
// LOTES
// ============================================================

export const getLotes = async (req: Request, res: Response) => {
  const { productoId, vencidos, proximosVencer } = req.query;

  const where: any = {};
  if (productoId) where.productoId = parseInt(productoId as string, 10);

  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);

  if (vencidos === 'true') {
    where.fechaCaducidad = { lt: hoy };
  } else if (proximosVencer === 'true') {
    const limite = new Date(hoy);
    limite.setDate(limite.getDate() + 30);
    where.fechaCaducidad = { gte: hoy, lte: limite };
  }

  const lotes = await prisma.almacenLote.findMany({
    where,
    include: {
      producto: { select: { id: true, codigo: true, nombre: true, unidad: true } },
    },
    orderBy: { fechaCaducidad: 'asc' },
  });

  res.json({ success: true, data: lotes });
};

export const createLote = async (req: Request, res: Response) => {
  const { productoId, numeroLote, cantidad, fechaCaducidad } = req.body;

  if (!productoId || !cantidad || !fechaCaducidad) {
    throw new AppError(400, 'productoId, cantidad y fechaCaducidad son requeridos');
  }

  const prodIdNum = parseInt(String(productoId), 10);
  const producto  = await prisma.almacenProducto.findUnique({ where: { id: prodIdNum } });
  if (!producto) throw new AppError(404, 'Producto no encontrado');

  const fechaDate = new Date(fechaCaducidad);
  if (isNaN(fechaDate.getTime())) throw new AppError(400, 'Fecha de caducidad inválida');

  const lote = await prisma.almacenLote.create({
    data: {
      productoId:    prodIdNum,
      numeroLote:    numeroLote ?? `LOTE-${Date.now()}`,
      cantidad:      parseInt(String(cantidad), 10),
      fechaCaducidad: fechaDate,
    },
    include: {
      producto: { select: { id: true, codigo: true, nombre: true } },
    },
  });

  res.status(201).json({ success: true, data: lote });
};

// ============================================================
// REQUISICIONES DE ALMACÉN
// ============================================================

export const createRequisicion = async (req: Request, res: Response) => {
  const usuarioId = req.usuario!.id;
  const { areaSolicitante, justificacion, descripcion, detalles } = req.body;

  if (!areaSolicitante) throw new AppError(400, 'areaSolicitante es requerido');
  if (!justificacion)   throw new AppError(400, 'justificacion es requerida');
  if (!Array.isArray(detalles) || detalles.length === 0) {
    throw new AppError(400, 'Debe incluir al menos un detalle');
  }

  // Validar que todos los productos existan
  for (const d of detalles) {
    const prodIdNum = parseInt(String(d.productoId), 10);
    if (!prodIdNum || isNaN(prodIdNum) || prodIdNum <= 0) {
      throw new AppError(400, `productoId inválido en detalles`);
    }
    const prod = await prisma.almacenProducto.findUnique({ where: { id: prodIdNum } });
    if (!prod) throw new AppError(404, `Producto ${prodIdNum} no encontrado`);
  }

  // Generar folio
  const año     = new Date().getFullYear();
  const ultimo  = await prisma.requisicion.findFirst({
    where:   { folio: { startsWith: `REQ-${año}-` } },
    orderBy: { id: 'desc' },
    select:  { folio: true },
  });
  let num = 1;
  if (ultimo) {
    const partes = ultimo.folio.split('-');
    num = parseInt(partes[2], 10) + 1;
  }
  const folio = `REQ-${año}-${String(num).padStart(5, '0')}`;

  const requisicion = await prisma.$transaction(async (tx) => {
    const nueva = await tx.requisicion.create({
      data: {
        folio,
        usuarioSolicitaId: usuarioId,
        areaSolicitante,
        justificacion,
        descripcion:       descripcion ?? null,
        estado:            'CREADA',
        detalles: {
          create: detalles.map((d: any) => ({
            productoId:        parseInt(String(d.productoId), 10),
            cantidadSolicitada: parseInt(String(d.cantidadSolicitada), 10),
            observaciones:      d.observaciones ?? null,
          })),
        },
      },
      include: {
        detalles: {
          include: { producto: { select: { id: true, codigo: true, nombre: true, unidad: true } } },
        },
      },
    });

    await tx.requisicionHistorial.create({
      data: { requisicionId: nueva.id, usuarioId, estado: 'CREADA', comentario: 'Requisición creada' },
    });

    return nueva;
  });

  await crearNotificacion({
    titulo: 'Nueva Requisición',
    mensaje: `Requisición ${folio} del área ${areaSolicitante} pendiente de revisión.`,
    tipo: 'INFO',
    rol: 'ALMACEN',
    link: '/almacen/requisiciones',
  });

  res.status(201).json({ success: true, data: requisicion });
};

export const getRequisiciones = async (req: Request, res: Response) => {
  const { estado, areaSolicitante } = req.query;

  const where: any = {};
  if (estado)          where.estado          = estado;
  if (areaSolicitante) where.areaSolicitante = { contains: areaSolicitante as string, mode: 'insensitive' };

  const requisiciones = await prisma.requisicion.findMany({
    where,
    include: {
      usuarioSolicita: { select: { id: true, nombre: true, apellidos: true } },
      detalles: {
        include: { producto: { select: { id: true, codigo: true, nombre: true, unidad: true } } },
      },
      historial: { orderBy: { fecha: 'desc' }, take: 1 },
    },
    orderBy: { createdAt: 'desc' },
  });

  res.json({ success: true, data: requisiciones });
};

export const getRequisicionById = async (req: Request, res: Response) => {
  const id = parseInt(req.params.id as string, 10);

  const requisicion = await prisma.requisicion.findUnique({
    where: { id },
    include: {
      usuarioSolicita:              { select: { id: true, nombre: true, apellidos: true } },
      revisadoAlmacenPor:           { select: { id: true, nombre: true, apellidos: true } },
      autorizadoPor:                { select: { id: true, nombre: true, apellidos: true } },
      revisadoAdministracionPor:    { select: { id: true, nombre: true, apellidos: true } },
      detalles: {
        include: { producto: { select: { id: true, codigo: true, nombre: true, unidad: true, stockActual: true } } },
      },
      historial: { include: { usuario: { select: { nombre: true, apellidos: true } } }, orderBy: { fecha: 'desc' } },
      compraRequisicion: true,
    },
  });

  if (!requisicion) throw new AppError(404, 'Requisición no encontrada');

  res.json({ success: true, data: requisicion });
};

export const revisarRequisicion = async (req: Request, res: Response) => {
  const usuarioId = req.usuario!.id;
  const id        = parseInt(req.params.id as string, 10);
  const { observaciones, tipoCompra } = req.body;

  const requisicion = await prisma.requisicion.findUnique({
    where: { id },
    include: {
      detalles: { include: { producto: true } },
    },
  });

  if (!requisicion) throw new AppError(404, 'Requisición no encontrada');

  if (requisicion.estado !== 'CREADA' && requisicion.estado !== 'EN_REVISION_ALMACEN') {
    throw new AppError(400, `No se puede revisar en estado ${requisicion.estado}`);
  }

  // Determinar estado según existencias
  let itemsConStock  = 0;
  let itemsSinStock  = 0;

  for (const detalle of requisicion.detalles) {
    if (detalle.producto && detalle.producto.stockActual >= detalle.cantidadSolicitada) {
      itemsConStock++;
    } else {
      itemsSinStock++;
    }
  }

  let nuevoEstado: string;
  if (itemsSinStock === 0) {
    nuevoEstado = 'SURTIDA';
  } else if (itemsConStock > 0) {
    nuevoEstado = 'PARCIAL';
  } else {
    nuevoEstado = 'SIN_EXISTENCIA';
  }

  await prisma.$transaction(async (tx) => {
    await tx.requisicion.update({
      where: { id },
      data: {
        estado:                  nuevoEstado as any,
        revisadoAlmacenPorId:    usuarioId,
        fechaRevisionAlmacen:    new Date(),
        tieneExistencia:         nuevoEstado === 'SURTIDA',
        observaciones:           observaciones ?? null,
      },
    });

    await tx.requisicionHistorial.create({
      data: {
        requisicionId: id,
        usuarioId,
        estado:        nuevoEstado as any,
        comentario:    observaciones ?? `Revisado: ${nuevoEstado}`,
      },
    });

    // Si no hay existencia o es parcial, crear compra automáticamente
    if (nuevoEstado === 'SIN_EXISTENCIA' || nuevoEstado === 'PARCIAL') {
      const existeCompra = await tx.compraRequisicion.findUnique({
        where: { requisicionId: id },
      });

      if (!existeCompra) {
        const año    = new Date().getFullYear();
        const ultimo = await tx.compraRequisicion.findFirst({
          where:   { folio: { startsWith: `COM-${año}-` } },
          orderBy: { id: 'desc' },
          select:  { folio: true },
        });
        let num = 1;
        if (ultimo) {
          const partes = ultimo.folio.split('-');
          num = parseInt(partes[2], 10) + 1;
        }
        const folioCompra  = `COM-${año}-${String(num).padStart(5, '0')}`;
        const esCompraMayor = false;

        const nuevaCompra = await tx.compraRequisicion.create({
          data: {
            folio:                       folioCompra,
            requisicionId:               id,
            usuarioId,
            tipo:                        (tipoCompra as any) ?? 'ORDINARIA',
            estado:                      'EN_COMPRAS',
            esCompraMayor,
            numeroCotizacionesRequeridas: esCompraMayor ? 3 : 1,
            detalles: {
              create: requisicion.detalles
                .filter((d) => d.productoId !== null && d.producto !== null && d.producto.stockActual < d.cantidadSolicitada)
                .map((d, i) => ({
                  numero:     i + 1,
                  productoId: d.productoId!,
                  unidad:     d.producto!.unidad,
                  cantidad:   d.cantidadSolicitada - d.producto!.stockActual,
                })),
            },
          },
        });

        await tx.compraHistorial.create({
          data: {
            requisicionId: nuevaCompra.id,
            estado:        'EN_COMPRAS',
            usuarioId,
            comentario:    `Compra creada automáticamente por revisión de requisición ${requisicion.folio}`,
          },
        });
      }
    }
  });

  if (nuevoEstado === 'SIN_EXISTENCIA' || nuevoEstado === 'PARCIAL') {
    await crearNotificacion({
      titulo: 'Nueva Compra Automática',
      mensaje: `Se generó compra automática por requisición ${requisicion.folio} (${nuevoEstado}).`,
      tipo: 'ALERTA',
      rol: 'ALMACEN',
      link: '/compras',
    });
  }

  res.json({
    success: true,
    message: `Requisición revisada: ${nuevoEstado}`,
    data: { estado: nuevoEstado, itemsConStock, itemsSinStock },
  });
};

// ============================================================
// DASHBOARD ALMACÉN
// ============================================================

export const dashboardAlmacen = async (_req: Request, res: Response) => {
  const hoy    = new Date();
  hoy.setHours(0, 0, 0, 0);
  const en30   = new Date(hoy);
  en30.setDate(en30.getDate() + 30);

  const [
    totalProductos,
    criticos,
    bajos,
    proximosVencer,
    entradas,
    salidas,
    requisicionesPendientes,
  ] = await Promise.all([
    prisma.almacenProducto.count(),
    prisma.almacenProducto.count({ where: { estadoStock: 'CRITICO' } }),
    prisma.almacenProducto.count({ where: { estadoStock: 'BAJO' } }),
    prisma.almacenLote.count({ where: { fechaCaducidad: { gte: hoy, lte: en30 } } }),
    prisma.almacenMovimiento.count({
      where: { tipo: 'ENTRADA', createdAt: { gte: new Date(hoy.getFullYear(), hoy.getMonth(), 1) } },
    }),
    prisma.almacenMovimiento.count({
      where: { tipo: 'SALIDA', createdAt: { gte: new Date(hoy.getFullYear(), hoy.getMonth(), 1) } },
    }),
    prisma.requisicion.count({ where: { estado: { in: ['CREADA', 'EN_REVISION_ALMACEN'] } } }),
  ]);

  const productosCriticos = await prisma.almacenProducto.findMany({
    where:   { estadoStock: 'CRITICO' },
    orderBy: { stockActual: 'asc' },
    take:    10,
  });

  const movimientosRecientes = await prisma.almacenMovimiento.findMany({
    include: {
      producto: { select: { id: true, codigo: true, nombre: true } },
      usuario:  { select: { nombre: true, apellidos: true } },
    },
    orderBy: { createdAt: 'desc' },
    take:    10,
  });

  res.json({
    success: true,
    data: {
      resumen: {
        totalProductos,
        criticos,
        bajos,
        proximosVencer,
        entradas,
        salidas,
        requisicionesPendientes,
      },
      productosCriticos,
      movimientosRecientes,
    },
  });
};