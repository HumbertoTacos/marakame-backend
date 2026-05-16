import { Request, Response } from 'express';
import { prisma } from '../utils/prisma';
import { AppError } from '../middlewares/errorHandler';
import { EstadoCompra, EstadoRequisicion, TipoCompra } from '@prisma/client';
import { crearNotificacion } from '../utils/notificaciones';
import { registrarBitacora } from '../utils/auditoria';
import { validarTransicionCompra } from '../utils/stateMachines';
import {
  generateFolioCompra,
  generateFolioOrden,
  generateFolioOrdenPago,
} from '../utils/folioGenerators';
import multer from 'multer';

// ============================================================
// HELPERS
// ============================================================

const getUsuarioId = (req: Request): number => {
  if (!req.usuario) throw new AppError(401, 'No autenticado');
  return req.usuario.id;
};

const getParamId = (val: string | string[] | undefined, name = 'id'): number => {
  const str = Array.isArray(val) ? val[0] : val;
  const n   = parseInt(str as string, 10);
  if (!str || isNaN(n) || n <= 0) throw new AppError(400, `${name} inválido`);
  return n;
};

const registrarHistorial = async (
  tx: any,
  requisicionId: number,
  estado: EstadoCompra,
  usuarioId: number,
  comentario?: string | null,
) => {
  await tx.compraHistorial.create({
    data: { requisicionId, estado, usuarioId, comentario: comentario ?? null },
  });
};

const INCLUDE_COMPRA = {
  requisicion: {
    include: {
      usuarioSolicita: { select: { id: true, nombre: true, apellidos: true } },
      detalles: {
        include: {
          producto: { select: { id: true, codigo: true, nombre: true, unidad: true } },
        },
      },
    },
  },
  usuario: { select: { id: true, nombre: true, apellidos: true, rol: true } },
  proveedorSeleccionado: {
    select: { id: true, nombre: true, rfc: true, telefono: true, correo: true },
  },
  cotizaciones: {
    include: { proveedor: { select: { id: true, nombre: true } } },
    orderBy: { precio: 'asc' as const },
  },
  historial: {
    include: { usuario: { select: { nombre: true, apellidos: true } } },
    orderBy: { fecha: 'desc' as const },
  },
  detalles: {
    include: {
      producto: { select: { id: true, codigo: true, nombre: true, unidad: true } },
    },
  },
  ordenes: {
    include: {
      proveedor: { select: { id: true, nombre: true } },
      elaboradoPor: { select: { nombre: true, apellidos: true } },
      revisadoPor:  { select: { nombre: true, apellidos: true } },
      autorizadoPor: { select: { nombre: true, apellidos: true } },
    },
  },
  facturas: {
    include: { proveedor: { select: { id: true, nombre: true } } },
  },
  ordenPago: {
    include: {
      elaboradoPor:  { select: { nombre: true, apellidos: true } },
      revisadoPor:   { select: { nombre: true, apellidos: true } },
      autorizadoPor: { select: { nombre: true, apellidos: true } },
      detalles: {
        include: { proveedor: { select: { id: true, nombre: true } } },
      },
    },
  },
  revisadoAdministracionPor: { select: { id: true, nombre: true, apellidos: true } },
  usuarioAutoriza: { select: { id: true, nombre: true, apellidos: true } },
} as const;

// ============================================================
// 1. LISTAR COMPRAS
// ============================================================

export const getCompras = async (req: Request, res: Response): Promise<void> => {
  const { estado, tipo, proveedorId, urgente, page = '1', limit = '20' } = req.query;

  const where: any = {};
  if (estado) where.estado = estado as EstadoCompra;
  if (tipo)   where.tipo = tipo as TipoCompra;
  if (proveedorId) where.proveedorSeleccionadoId = parseInt(proveedorId as string, 10);
  if (urgente === 'true') where.esUrgente = true;

  const pageNum  = Math.max(1, parseInt(page as string, 10));
  const limitNum = Math.min(100, Math.max(1, parseInt(limit as string, 10)));
  const skip     = (pageNum - 1) * limitNum;

  const [total, compras] = await Promise.all([
    prisma.compraRequisicion.count({ where }),
    prisma.compraRequisicion.findMany({
      where,
      include: INCLUDE_COMPRA,
      orderBy: [{ esUrgente: 'desc' }, { createdAt: 'desc' }],
      skip,
      take: limitNum,
    }),
  ]);

  res.json({
    success: true,
    data: compras,
    meta: { total, page: pageNum, limit: limitNum, totalPages: Math.ceil(total / limitNum) },
  });
};

// ============================================================
// 2. OBTENER COMPRA POR ID
// ============================================================

export const getCompraById = async (req: Request, res: Response): Promise<void> => {
  const id = getParamId(req.params.id);

  const compra = await prisma.compraRequisicion.findUnique({
    where: { id },
    include: INCLUDE_COMPRA,
  });

  if (!compra) throw new AppError(404, 'Compra no encontrada');

  res.json({ success: true, data: compra });
};

// ============================================================
// 3. CREAR COMPRA DESDE REQUISICIÓN
// ============================================================

export const createCompra = async (req: Request, res: Response): Promise<void> => {
  const usuarioId = getUsuarioId(req);
  const { requisicionId, tipo, presupuestoEstimado, esUrgente, observaciones } = req.body;

  if (!requisicionId) throw new AppError(400, 'requisicionId es requerido');

  const tipoEnum = tipo as TipoCompra;
  if (!tipoEnum || !Object.values(TipoCompra).includes(tipoEnum)) {
    throw new AppError(400, 'tipo debe ser ORDINARIA o EXTRAORDINARIA');
  }

  const reqIdNum = parseInt(String(requisicionId), 10);
  if (isNaN(reqIdNum) || reqIdNum <= 0) throw new AppError(400, 'requisicionId inválido');

  const requisicion = await prisma.requisicion.findUnique({
    where: { id: reqIdNum },
    include: { detalles: { include: { producto: true } } },
  });
  if (!requisicion) throw new AppError(404, 'Requisición no encontrada');

  const existeCompra = await prisma.compraRequisicion.findUnique({
    where: { requisicionId: reqIdNum },
  });
  if (existeCompra) throw new AppError(400, 'Esta requisición ya tiene una compra asociada');

  const presupuesto     = presupuestoEstimado ? parseFloat(presupuestoEstimado) : null;
  const esCompraMayor   = presupuesto !== null && presupuesto > 50000;
  const numCotizaciones = esCompraMayor ? 3 : 1;
  const folio           = await generateFolioCompra();

  const compra = await prisma.$transaction(async (tx) => {
    const nueva = await tx.compraRequisicion.create({
      data: {
        folio,
        requisicionId: reqIdNum,
        usuarioId,
        tipo: tipoEnum,
        estado: EstadoCompra.EN_COMPRAS,
        presupuestoEstimado: presupuesto,
        esCompraMayor,
        numeroCotizacionesRequeridas: numCotizaciones,
        esUrgente: esUrgente === true || esUrgente === 'true',
        detalles: {
          create: requisicion.detalles
            .filter(d => d.productoId !== null && d.producto !== null)
            .map((d, i) => ({
              numero:    i + 1,
              productoId: d.productoId!,
              unidad:    d.producto!.unidad,
              cantidad:  d.cantidadSolicitada,
            })),
        },
      },
    });

    await registrarHistorial(
      tx,
      nueva.id,
      EstadoCompra.EN_COMPRAS,
      usuarioId,
      observaciones ?? 'Compra creada desde requisición',
    );

    return nueva;
  });

  await crearNotificacion({
    titulo: 'Nueva Compra Registrada',
    mensaje: `Compra ${folio} creada desde requisición ${requisicion.folio}. Requiere ${numCotizaciones} cotización(es).`,
    tipo: 'INFO',
    rol: 'ALMACEN',
    link: `/compras/${compra.id}`,
  });

  await registrarBitacora(usuarioId, 'CREAR_COMPRA', 'compras', {
    compraId: compra.id,
    folio,
    requisicionId: reqIdNum,
  });

  res.status(201).json({ success: true, data: compra });
};

// ============================================================
// 4. REGISTRAR COTIZACIÓN
// ============================================================

export const registrarCotizacion = async (req: Request, res: Response): Promise<void> => {
  const usuarioId = getUsuarioId(req);
  const id = getParamId(req.params.id, 'compraId');
  const { proveedorId, precio, tiempoEntrega, formaPago, tipoCredito, documentoUrl } = req.body;

  if (!proveedorId) throw new AppError(400, 'proveedorId es requerido');
  const precioNum = parseFloat(precio);
  if (isNaN(precioNum) || precioNum <= 0) throw new AppError(400, 'precio debe ser mayor a 0');

  const compra = await prisma.compraRequisicion.findUnique({
    where: { id },
    include: { cotizaciones: true },
  });
  if (!compra) throw new AppError(404, 'Compra no encontrada');

  const estadosPermitidos: EstadoCompra[] = [
    EstadoCompra.EN_COMPRAS,
    EstadoCompra.COTIZACIONES_CARGADAS,
    EstadoCompra.DEVUELTA_A_COMPRAS,
  ];
  if (!estadosPermitidos.includes(compra.estado)) {
    throw new AppError(400, `No se pueden agregar cotizaciones en estado ${compra.estado}`);
  }

  const provIdNum = parseInt(String(proveedorId), 10);
  const proveedor = await prisma.proveedor.findUnique({ where: { id: provIdNum } });
  if (!proveedor) throw new AppError(404, 'Proveedor no encontrado');

  const duplicada = compra.cotizaciones.find((c) => c.proveedorId === provIdNum);
  if (duplicada) throw new AppError(400, 'Ya existe cotización de este proveedor para esta compra');

  const menorPrecio =
    compra.cotizaciones.length > 0
      ? Math.min(...compra.cotizaciones.map((c) => Number(c.precio)))
      : null;
  const esMejorOpcion = menorPrecio === null || precioNum <= menorPrecio;

  const cotizacion = await prisma.$transaction(async (tx) => {
    if (esMejorOpcion && compra.cotizaciones.length > 0) {
      await tx.compraCotizacion.updateMany({
        where: { requisicionId: id, esMejorOpcion: true },
        data:  { esMejorOpcion: false },
      });
    }

    const nueva = await tx.compraCotizacion.create({
      data: {
        requisicionId: id,
        proveedorId:   provIdNum,
        precio:        precioNum,
        tiempoEntrega: tiempoEntrega ?? null,
        formaPago:     formaPago ?? null,
        tipoCredito:   tipoCredito ?? null,
        documentoUrl:  documentoUrl ?? null,
        esMejorOpcion,
      },
      include: { proveedor: { select: { id: true, nombre: true } } },
    });

    const totalCotizaciones = compra.cotizaciones.length + 1;
    const debeAvanzar =
      totalCotizaciones >= compra.numeroCotizacionesRequeridas &&
      (compra.estado === EstadoCompra.EN_COMPRAS ||
       compra.estado === EstadoCompra.DEVUELTA_A_COMPRAS);

    if (debeAvanzar) {
      await tx.compraRequisicion.update({
        where: { id },
        data:  { estado: EstadoCompra.COTIZACIONES_CARGADAS },
      });
      await registrarHistorial(
        tx,
        id,
        EstadoCompra.COTIZACIONES_CARGADAS,
        usuarioId,
        `${totalCotizaciones} cotizaciones registradas`,
      );
    }

    return nueva;
  });

  res.status(201).json({ success: true, data: cotizacion });
};

// ============================================================
// 4a-bis. REGISTRAR COTIZACIONES POR PRODUCTO (BULK)
// ============================================================

export const registrarCotizacionesBulk = async (req: Request, res: Response): Promise<void> => {
  const usuarioId = getUsuarioId(req);
  const id        = getParamId(req.params.id, 'compraId');
  const { items } = req.body as {
    items: {
      requisicionDetalleId: number;
      proveedorId: number;
      precioUnitario: number;
      tiempoEntrega?: string;
      formaPago?: string;
    }[];
  };

  if (!Array.isArray(items) || items.length === 0) {
    throw new AppError(400, 'Se requiere al menos un artículo con cotización');
  }

  const compra = await prisma.compraRequisicion.findUnique({
    where:   { id },
    include: { requisicion: { include: { detalles: true } } },
  });
  if (!compra) throw new AppError(404, 'Compra no encontrada');

  const estadosPermitidos: EstadoCompra[] = [
    EstadoCompra.EN_COMPRAS,
    EstadoCompra.COTIZACIONES_CARGADAS,
    EstadoCompra.DEVUELTA_A_COMPRAS,
  ];
  if (!estadosPermitidos.includes(compra.estado)) {
    throw new AppError(400, `No se pueden registrar cotizaciones en estado ${compra.estado}`);
  }

  const detallesValidos = compra.requisicion?.detalles ?? [];
  const detalleIds = new Set(detallesValidos.map(d => d.id));

  for (const item of items) {
    if (!item.requisicionDetalleId) throw new AppError(400, 'Cada artículo requiere requisicionDetalleId');
    if (!item.proveedorId)          throw new AppError(400, 'Cada artículo requiere proveedorId');
    const precio = parseFloat(String(item.precioUnitario));
    if (isNaN(precio) || precio <= 0) throw new AppError(400, 'El precio unitario debe ser mayor a 0');
    if (!detalleIds.has(Number(item.requisicionDetalleId))) {
      throw new AppError(400, `El artículo ${item.requisicionDetalleId} no pertenece a esta requisición`);
    }
  }

  const provIds = [...new Set(items.map(i => Number(i.proveedorId)))];
  const provs   = await prisma.proveedor.findMany({ where: { id: { in: provIds } } });
  if (provs.length !== provIds.length) throw new AppError(400, 'Uno o más proveedores no encontrados');

  const detalleMap = Object.fromEntries(detallesValidos.map(d => [d.id, d]));

  let subtotal = 0;
  for (const item of items) {
    const det = detalleMap[Number(item.requisicionDetalleId)];
    subtotal += parseFloat(String(item.precioUnitario)) * (det?.cantidadSolicitada ?? 1);
  }
  const totalFinal = subtotal * 1.16;

  const cotizaciones = await prisma.$transaction(async (tx) => {
    await tx.compraCotizacion.deleteMany({ where: { requisicionId: id } });

    const nuevas = await Promise.all(
      items.map(item => {
        const det      = detalleMap[Number(item.requisicionDetalleId)];
        const unitario = parseFloat(String(item.precioUnitario));
        return tx.compraCotizacion.create({
          data: {
            requisicionId:        id,
            requisicionDetalleId: Number(item.requisicionDetalleId),
            proveedorId:          Number(item.proveedorId),
            precio:               unitario * (det?.cantidadSolicitada ?? 1),
            precioUnitario:       unitario,
            tiempoEntrega:        item.tiempoEntrega ?? null,
            formaPago:            item.formaPago     ?? null,
            esMejorOpcion:        true,
          },
          include: { proveedor: { select: { id: true, nombre: true } } },
        });
      })
    );

    await tx.compraRequisicion.update({
      where: { id },
      data: {
        totalFinal,
        estado: EstadoCompra.COTIZACIONES_CARGADAS,
      },
    });

    await registrarHistorial(
      tx, id, EstadoCompra.COTIZACIONES_CARGADAS, usuarioId,
      `${items.length} cotizaciones por producto registradas`,
    );

    return nuevas;
  });

  res.status(201).json({ success: true, data: cotizaciones });
};

// ============================================================
// 4b. ELIMINAR COTIZACIÓN
// ============================================================

export const eliminarCotizacion = async (req: Request, res: Response): Promise<void> => {
  const id           = getParamId(req.params.id, 'compraId');
  const cotizacionId = getParamId(req.params.cotizacionId, 'cotizacionId');

  const compra = await prisma.compraRequisicion.findUnique({
    where: { id },
    include: { cotizaciones: true },
  });
  if (!compra) throw new AppError(404, 'Compra no encontrada');

  const estadosPermitidos: EstadoCompra[] = [
    EstadoCompra.EN_COMPRAS,
    EstadoCompra.COTIZACIONES_CARGADAS,
    EstadoCompra.DEVUELTA_A_COMPRAS,
  ];
  if (!estadosPermitidos.includes(compra.estado)) {
    throw new AppError(400, `No se pueden eliminar cotizaciones en estado ${compra.estado}`);
  }

  const cotizacion = compra.cotizaciones.find((c) => c.id === cotizacionId);
  if (!cotizacion) throw new AppError(404, 'Cotización no encontrada en esta compra');

  await prisma.$transaction(async (tx) => {
    await tx.compraCotizacion.delete({ where: { id: cotizacionId } });

    const restantes = compra.cotizaciones.filter((c) => c.id !== cotizacionId);
    if (restantes.length > 0) {
      const menorPrecio = Math.min(...restantes.map((c) => Number(c.precio)));
      const mejorId     = restantes.find((c) => Number(c.precio) === menorPrecio)!.id;
      await tx.compraCotizacion.updateMany({
        where: { requisicionId: id },
        data:  { esMejorOpcion: false },
      });
      await tx.compraCotizacion.update({
        where: { id: mejorId },
        data:  { esMejorOpcion: true },
      });
    }
  });

  res.status(200).json({ success: true, message: 'Cotización eliminada' });
};

// ============================================================
// 4c. AGREGAR COTIZACIÓN POR PRODUCTO (individual, no reemplaza)
// ============================================================

export const agregarCotizacionProducto = async (req: Request, res: Response): Promise<void> => {
  const id = getParamId(req.params.id, 'compraId');
  const {
    requisicionDetalleId, proveedorId, precioUnitario,
    tiempoEntrega, formaPago, condicionesPago,
    garantia, marca, modelo, observaciones,
  } = req.body as {
    requisicionDetalleId: number;
    proveedorId: number;
    precioUnitario: number;
    tiempoEntrega?: string;
    formaPago?: string;
    condicionesPago?: string;
    garantia?: string;
    marca?: string;
    modelo?: string;
    observaciones?: string;
  };

  if (!requisicionDetalleId) throw new AppError(400, 'requisicionDetalleId es requerido');
  if (!proveedorId) throw new AppError(400, 'proveedorId es requerido');
  const precioNum = parseFloat(String(precioUnitario));
  if (isNaN(precioNum) || precioNum <= 0) throw new AppError(400, 'precioUnitario debe ser mayor a 0');

  const compra = await prisma.compraRequisicion.findUnique({
    where: { id },
    include: {
      requisicion: { include: { detalles: true } },
      cotizaciones: true,
    },
  });
  if (!compra) throw new AppError(404, 'Compra no encontrada');

  const estadosPermitidos: EstadoCompra[] = [
    EstadoCompra.EN_COMPRAS,
    EstadoCompra.COTIZACIONES_CARGADAS,
    EstadoCompra.DEVUELTA_A_COMPRAS,
  ];
  if (!estadosPermitidos.includes(compra.estado)) {
    throw new AppError(400, `No se pueden agregar cotizaciones en estado ${compra.estado}`);
  }

  const detalleId = Number(requisicionDetalleId);
  const detalles = compra.requisicion?.detalles ?? [];
  const detalle = detalles.find(d => d.id === detalleId);
  if (!detalle) throw new AppError(400, 'El artículo no pertenece a esta compra');

  const provIdNum = Number(proveedorId);
  const proveedor = await prisma.proveedor.findUnique({ where: { id: provIdNum } });
  if (!proveedor) throw new AppError(404, 'Proveedor no encontrado');

  // Verificar que el mismo proveedor no cotice el mismo artículo dos veces
  const duplicada = compra.cotizaciones.find(
    c => c.requisicionDetalleId === detalleId && c.proveedorId === provIdNum
  );
  if (duplicada) throw new AppError(400, 'Este proveedor ya tiene cotización para este artículo');

  const nueva = await prisma.$transaction(async (tx) => {
    const cot = await tx.compraCotizacion.create({
      data: {
        requisicionId:        id,
        requisicionDetalleId: detalleId,
        proveedorId:          provIdNum,
        precio:               precioNum * detalle.cantidadSolicitada,
        precioUnitario:       precioNum,
        tiempoEntrega:        tiempoEntrega        ?? null,
        formaPago:            formaPago             ?? null,
        condicionesPago:      condicionesPago       ?? null,
        garantia:             garantia              ?? null,
        marca:                marca                 ?? null,
        modelo:               modelo                ?? null,
        observaciones:        observaciones         ?? null,
        esMejorOpcion:        false,
      } as Parameters<typeof tx.compraCotizacion.create>[0]['data'],
      include: { proveedor: { select: { id: true, nombre: true } } },
    });

    // Avanzar a COTIZACIONES_CARGADAS si todos los artículos tienen al menos 1 cotización
    if (compra.estado === EstadoCompra.EN_COMPRAS || compra.estado === EstadoCompra.DEVUELTA_A_COMPRAS) {
      const todasCots = [...compra.cotizaciones, cot];
      const todosTienenCot = detalles.every(d =>
        todasCots.some(c => c.requisicionDetalleId === d.id)
      );
      if (todosTienenCot) {
        await tx.compraRequisicion.update({
          where: { id },
          data: { estado: EstadoCompra.COTIZACIONES_CARGADAS },
        });
      }
    }

    return cot;
  });

  res.status(201).json({ success: true, data: nueva });
};

// ============================================================
// 4d. SELECCIONAR COTIZACIÓN GANADORA POR PRODUCTO
// ============================================================

export const seleccionarCotizacionProducto = async (req: Request, res: Response): Promise<void> => {
  const id           = getParamId(req.params.id, 'compraId');
  const cotizacionId = getParamId(req.params.cotizacionId, 'cotizacionId');

  const compra = await prisma.compraRequisicion.findUnique({
    where: { id },
    include: {
      cotizaciones: true,
      requisicion: { include: { detalles: true } },
    },
  });
  if (!compra) throw new AppError(404, 'Compra no encontrada');

  const cotizacion = compra.cotizaciones.find(c => c.id === cotizacionId);
  if (!cotizacion) throw new AppError(404, 'Cotización no encontrada en esta compra');

  const detalleId = cotizacion.requisicionDetalleId;

  await prisma.$transaction(async (tx) => {
    // Desmarcar todas las cotizaciones del mismo artículo
    if (detalleId) {
      await tx.compraCotizacion.updateMany({
        where: { requisicionId: id, requisicionDetalleId: detalleId },
        data:  { esMejorOpcion: false },
      });
    } else {
      // Cotizaciones legacy (sin artículo específico)
      await tx.compraCotizacion.updateMany({
        where: { requisicionId: id, requisicionDetalleId: null },
        data:  { esMejorOpcion: false },
      });
    }
    // Marcar la seleccionada
    await tx.compraCotizacion.update({
      where: { id: cotizacionId },
      data:  { esMejorOpcion: true },
    });

    // Recalcular totalFinal: suma de cotizaciones ganadoras por artículo
    const todasCots = compra.cotizaciones.map(c =>
      c.id === cotizacionId ? { ...c, esMejorOpcion: true } : (
        (detalleId ? c.requisicionDetalleId === detalleId : c.requisicionDetalleId === null)
          ? { ...c, esMejorOpcion: false }
          : c
      )
    );
    const subtotal = todasCots
      .filter(c => c.esMejorOpcion)
      .reduce((sum, c) => sum + Number(c.precio), 0);
    const totalFinal = subtotal * 1.16;

    await tx.compraRequisicion.update({
      where: { id },
      data:  { totalFinal },
    });
  });

  const actualizada = await prisma.compraRequisicion.findUnique({
    where: { id },
    include: INCLUDE_COMPRA,
  });
  res.json({ success: true, data: actualizada });
};

// ============================================================
// 5. SELECCIONAR PROVEEDOR GANADOR
// ============================================================

export const seleccionarProveedor = async (req: Request, res: Response): Promise<void> => {
  const usuarioId = getUsuarioId(req);
  const id = getParamId(req.params.id, 'compraId');
  const { proveedorSeleccionadoId, totalFinal, formaPago, tipoCredito, observaciones } = req.body;

  if (!proveedorSeleccionadoId) throw new AppError(400, 'proveedorSeleccionadoId es requerido');
  const totalNum = parseFloat(totalFinal);
  if (isNaN(totalNum) || totalNum <= 0) throw new AppError(400, 'totalFinal debe ser mayor a 0');

  const compra = await prisma.compraRequisicion.findUnique({ where: { id } });
  if (!compra) throw new AppError(404, 'Compra no encontrada');
  if (compra.estado !== EstadoCompra.COTIZACIONES_CARGADAS) {
    throw new AppError(400, 'Solo se puede seleccionar proveedor en estado COTIZACIONES_CARGADAS');
  }

  const provIdNum = parseInt(String(proveedorSeleccionadoId), 10);
  const proveedor = await prisma.proveedor.findUnique({ where: { id: provIdNum } });
  if (!proveedor) throw new AppError(404, 'Proveedor no encontrado');

  const cotizacion = await prisma.compraCotizacion.findFirst({
    where: { requisicionId: id, proveedorId: provIdNum },
  });
  if (!cotizacion) {
    throw new AppError(400, 'El proveedor no tiene cotización registrada para esta compra');
  }

  await prisma.$transaction(async (tx) => {
    await tx.compraCotizacion.updateMany({
      where: { requisicionId: id },
      data:  { esMejorOpcion: false },
    });
    await tx.compraCotizacion.update({
      where: { id: cotizacion.id },
      data:  { esMejorOpcion: true },
    });
    await tx.compraRequisicion.update({
      where: { id },
      data: {
        proveedorSeleccionadoId: provIdNum,
        totalFinal:   totalNum,
        formaPago:    formaPago ?? null,
        tipoCredito:  tipoCredito ?? null,
        observacionesVoBo: observaciones ?? null,
      },
    });
    await registrarHistorial(
      tx, id, EstadoCompra.COTIZACIONES_CARGADAS, usuarioId,
      `Proveedor seleccionado: ${proveedor.nombre} | Total: $${totalNum}`,
    );
  });

  const actualizada = await prisma.compraRequisicion.findUnique({
    where: { id },
    include: INCLUDE_COMPRA,
  });
  res.json({ success: true, data: actualizada });
};

// ============================================================
// 6. ENVIAR A ADMINISTRACIÓN
// ============================================================

export const enviarAAdministracion = async (req: Request, res: Response): Promise<void> => {
  const usuarioId = getUsuarioId(req);
  const id = getParamId(req.params.id, 'compraId');
  const { observaciones } = req.body;

  const compra = await prisma.compraRequisicion.findUnique({
    where: { id },
    include: {
      cotizaciones: true,
      requisicion: { include: { detalles: true } },
    },
  });
  if (!compra) throw new AppError(404, 'Compra no encontrada');

  validarTransicionCompra(compra.estado, EstadoCompra.EN_REVISION_ADMINISTRACION);

  // Validar que cada artículo tenga el mínimo de cotizaciones requeridas
  const detalles = compra.requisicion?.detalles ?? [];
  if (detalles.length > 0) {
    const minCots = compra.esCompraMayor ? 3 : 1;
    for (const detalle of detalles) {
      const cotsDet = compra.cotizaciones.filter(c => c.requisicionDetalleId === detalle.id);
      if (cotsDet.length < minCots) {
        throw new AppError(
          400,
          `El artículo "${detalle.productoNombre}" requiere mínimo ${minCots} cotización${minCots > 1 ? 'es' : ''} (tiene ${cotsDet.length})`
        );
      }
    }
  }

  await prisma.$transaction(async (tx) => {
    await tx.compraRequisicion.update({
      where: { id },
      data: {
        estado: EstadoCompra.EN_REVISION_ADMINISTRACION,
        revisadoAdministracionPorId: null,
        fechaRevisionAdministracion: null,
      },
    });
    await registrarHistorial(
      tx, id, EstadoCompra.EN_REVISION_ADMINISTRACION, usuarioId,
      observaciones ?? 'Enviado a revisión administrativa',
    );
  });

  await crearNotificacion({
    titulo: 'Compra en Revisión Administración',
    mensaje: `Compra ${compra.folio} requiere revisión administrativa.`,
    tipo: 'INFO',
    rol: 'RRHH_FINANZAS',
    link: `/compras/${id}`,
  });

  res.json({ success: true, message: 'Compra enviada a administración' });
};

// ============================================================
// 7. APROBAR ADMINISTRACIÓN → EN_REVISION_DIRECCION
// ============================================================

export const aprobarAdministracion = async (req: Request, res: Response): Promise<void> => {
  const usuarioId   = getUsuarioId(req);
  const rolUsuario  = req.usuario?.rol;
  const id          = getParamId(req.params.id, 'compraId');
  const { observaciones } = req.body;

  if (rolUsuario !== 'RRHH_FINANZAS' && rolUsuario !== 'ADMIN_GENERAL' && rolUsuario !== 'JEFE_ADMINISTRATIVO') {
    throw new AppError(403, 'Solo administración puede aprobar en esta etapa');
  }

  const compra = await prisma.compraRequisicion.findUnique({
    where: { id },
    include: {
      cotizaciones: true,
      requisicion: { include: { detalles: true } },
    },
  });
  if (!compra) throw new AppError(404, 'Compra no encontrada');

  validarTransicionCompra(compra.estado, EstadoCompra.EN_REVISION_DIRECCION);

  // Validar que cada artículo tenga un ganador seleccionado
  const detallesAdm = compra.requisicion?.detalles ?? [];
  for (const detalle of detallesAdm) {
    const tieneGanador = compra.cotizaciones.some(
      c => c.requisicionDetalleId === detalle.id && c.esMejorOpcion
    );
    if (!tieneGanador) {
      throw new AppError(
        400,
        `Selecciona el proveedor ganador para "${detalle.productoNombre}" antes de enviar a Dirección`
      );
    }
  }

  await prisma.$transaction(async (tx) => {
    await tx.compraRequisicion.update({
      where: { id },
      data: {
        estado: EstadoCompra.EN_REVISION_DIRECCION,
        revisadoAdministracionPorId: usuarioId,
        fechaRevisionAdministracion: new Date(),
      },
    });
    await registrarHistorial(
      tx, id, EstadoCompra.EN_REVISION_DIRECCION, usuarioId,
      observaciones ?? 'Aprobado por administración, enviado a dirección',
    );
  });

  await crearNotificacion({
    titulo: 'Compra en Revisión Dirección',
    mensaje: `Compra ${compra.folio} requiere autorización de dirección general.`,
    tipo: 'INFO',
    rol: 'ADMIN_GENERAL',
    link: `/compras/${id}`,
  });

  res.json({ success: true, message: 'Compra enviada a dirección general' });
};

// ============================================================
// 8. DEVOLVER A COMPRAS
// ============================================================

export const devolverACompras = async (req: Request, res: Response): Promise<void> => {
  const usuarioId  = getUsuarioId(req);
  const rolUsuario = req.usuario?.rol;
  const id         = getParamId(req.params.id, 'compraId');
  const { motivoRechazo, observaciones } = req.body;

  if (rolUsuario !== 'RRHH_FINANZAS' && rolUsuario !== 'ADMIN_GENERAL' && rolUsuario !== 'JEFE_ADMINISTRATIVO') {
    throw new AppError(403, 'Solo administración puede devolver compras');
  }
  if (!motivoRechazo) throw new AppError(400, 'motivoRechazo es requerido');

  const compra = await prisma.compraRequisicion.findUnique({ where: { id } });
  if (!compra) throw new AppError(404, 'Compra no encontrada');

  validarTransicionCompra(compra.estado, EstadoCompra.DEVUELTA_A_COMPRAS);

  await prisma.$transaction(async (tx) => {
    await tx.compraRequisicion.update({
      where: { id },
      data: {
        estado: EstadoCompra.DEVUELTA_A_COMPRAS,
        motivoRechazo,
        observacionesVoBo:          observaciones ?? null,
        devueltaPorAdministracion:  true,
        revisadoAdministracionPorId: usuarioId,
        fechaRevisionAdministracion: new Date(),
      },
    });
    await registrarHistorial(
      tx, id, EstadoCompra.DEVUELTA_A_COMPRAS, usuarioId,
      `Devuelta. Motivo: ${motivoRechazo}`,
    );
  });

  await crearNotificacion({
    titulo: 'Compra Devuelta a Compras',
    mensaje: `Compra ${compra.folio} fue devuelta. Motivo: ${motivoRechazo}`,
    tipo: 'ALERTA',
    rol: 'ALMACEN',
    link: `/compras/${id}`,
  });

  res.json({ success: true, message: 'Compra devuelta a compras' });
};

// ============================================================
// 9. AUTORIZAR DIRECCIÓN GENERAL
// ============================================================

export const autorizarDireccion = async (req: Request, res: Response): Promise<void> => {
  const usuarioId  = getUsuarioId(req);
  const rolUsuario = req.usuario?.rol;
  const id         = getParamId(req.params.id, 'compraId');
  const { observaciones } = req.body;

  if (rolUsuario !== 'ADMIN_GENERAL') {
    throw new AppError(403, 'Solo la dirección general puede autorizar');
  }

  const compra = await prisma.compraRequisicion.findUnique({ where: { id } });
  if (!compra) throw new AppError(404, 'Compra no encontrada');

  // Idempotente: si ya fue autorizada devuelve éxito en lugar de 400
  if (compra.usuarioAutorizaId) {
    res.json({ success: true, message: 'Compra ya estaba autorizada' });
    return;
  }

  validarTransicionCompra(compra.estado, EstadoCompra.AUTORIZADA);

  await prisma.$transaction(async (tx) => {
    await tx.compraRequisicion.update({
      where: { id },
      data: {
        estado: EstadoCompra.AUTORIZADA,
        usuarioAutorizaId: usuarioId,
        fechaAutorizacion: new Date(),
      },
    });
    await registrarHistorial(
      tx, id, EstadoCompra.AUTORIZADA, usuarioId,
      observaciones ?? 'Autorizada por dirección general',
    );
  });

  await crearNotificacion({
    titulo: 'Compra Autorizada',
    mensaje: `Compra ${compra.folio} fue autorizada por dirección general.`,
    tipo: 'EXITO',
    rol: 'ALMACEN',
    link: `/compras/${id}`,
  });

  await registrarBitacora(usuarioId, 'AUTORIZAR_COMPRA', 'compras', {
    compraId: id,
    folio: compra.folio,
  });

  res.json({ success: true, message: 'Compra autorizada por dirección' });
};

// ============================================================
// 10. RECHAZAR DIRECCIÓN GENERAL
// ============================================================

export const rechazarDireccion = async (req: Request, res: Response): Promise<void> => {
  const usuarioId  = getUsuarioId(req);
  const rolUsuario = req.usuario?.rol;
  const id         = getParamId(req.params.id, 'compraId');
  const { motivoRechazo } = req.body;

  if (rolUsuario !== 'ADMIN_GENERAL') {
    throw new AppError(403, 'Solo la dirección general puede rechazar');
  }
  if (!motivoRechazo) throw new AppError(400, 'motivoRechazo es requerido');

  const compra = await prisma.compraRequisicion.findUnique({ where: { id } });
  if (!compra) throw new AppError(404, 'Compra no encontrada');

  validarTransicionCompra(compra.estado, EstadoCompra.RECHAZADO);

  await prisma.$transaction(async (tx) => {
    await tx.compraRequisicion.update({
      where: { id },
      data: {
        estado: EstadoCompra.RECHAZADO,
        motivoRechazo,
        rechazadoPorDireccion: true,
        fechaRechazo: new Date(),
      },
    });
    await registrarHistorial(
      tx, id, EstadoCompra.RECHAZADO, usuarioId,
      `Rechazada por dirección. Motivo: ${motivoRechazo}`,
    );
  });

  await crearNotificacion({
    titulo: 'Compra Rechazada por Dirección',
    mensaje: `Compra ${compra.folio} fue rechazada. Motivo: ${motivoRechazo}`,
    tipo: 'ERROR',
    rol: 'ALMACEN',
    link: `/compras/${id}`,
  });

  await registrarBitacora(usuarioId, 'RECHAZAR_COMPRA', 'compras', {
    compraId: id,
    folio: compra.folio,
    motivoRechazo,
  });

  res.json({ success: true, message: 'Compra rechazada' });
};

// ============================================================
// 11. GENERAR ORDEN DE COMPRA
// ============================================================

export const generarOrden = async (req: Request, res: Response): Promise<void> => {
  const usuarioId = getUsuarioId(req);
  const id        = getParamId(req.params.id, 'compraId');

  const compra = await prisma.compraRequisicion.findUnique({
    where: { id },
    include: { proveedorSeleccionado: true },
  });
  if (!compra) throw new AppError(404, 'Compra no encontrada');

  // Idempotent: if orders already exist, return them as-is
  const existingOrdenes = await prisma.compraOrden.findMany({
    where: { requisicionId: id },
    include: {
      proveedor:    { select: { id: true, nombre: true } },
      elaboradoPor: { select: { nombre: true, apellidos: true } },
      autorizadoPor: { select: { nombre: true, apellidos: true } },
    },
  });
  if (existingOrdenes.length > 0) {
    res.json({ success: true, data: existingOrdenes });
    return;
  }

  validarTransicionCompra(compra.estado, EstadoCompra.ORDEN_GENERADA);

  // Group best cotizations by provider
  const mejoresCotizaciones = await prisma.compraCotizacion.findMany({
    where: { requisicionId: id, esMejorOpcion: true },
  });

  const gruposPorProveedor = new Map<number, typeof mejoresCotizaciones>();
  for (const cot of mejoresCotizaciones) {
    const grupo = gruposPorProveedor.get(cot.proveedorId) ?? [];
    grupo.push(cot);
    gruposPorProveedor.set(cot.proveedorId, grupo);
  }

  // Fallback to proveedorSeleccionadoId when no per-product cotizations exist
  if (gruposPorProveedor.size === 0) {
    if (!compra.proveedorSeleccionadoId) {
      throw new AppError(400, 'No hay cotización marcada como mejor opción. Verifica el proceso.');
    }
    gruposPorProveedor.set(compra.proveedorSeleccionadoId, []);
  }

  const proveedorEntries = Array.from(gruposPorProveedor.entries());

  // Generate folios — first folio uses the normal generator;
  // subsequent ones increment from the previous to avoid reading the same
  // DB state and returning duplicate folio numbers in the same batch.
  const folios: string[] = [];
  for (let i = 0; i < proveedorEntries.length; i++) {
    if (i === 0) {
      folios.push(await generateFolioOrden());
    } else {
      const prev  = folios[i - 1];
      const parts = prev.split('-');
      let nextNum  = parseInt(parts[2], 10) + 1;
      let candidato = `${parts[0]}-${parts[1]}-${String(nextNum).padStart(5, '0')}`;
      while (await prisma.compraOrden.findUnique({ where: { folio: candidato }, select: { id: true } })) {
        nextNum++;
        candidato = `${parts[0]}-${parts[1]}-${String(nextNum).padStart(5, '0')}`;
      }
      folios.push(candidato);
    }
  }

  const ordenes = await prisma.$transaction(async (tx) => {
    const nuevas = [];

    for (let i = 0; i < proveedorEntries.length; i++) {
      const [proveedorId, cots] = proveedorEntries[i];
      const folio = folios[i];

      const totalProveedor = cots.length > 0
        ? cots.reduce((sum, c) => sum + Number(c.precio), 0)
        : Number(compra.totalFinal ?? compra.presupuestoEstimado ?? 0);

      const nueva = await tx.compraOrden.create({
        data: {
          requisicionId:   id,
          folio,
          proveedorId,
          total:           totalProveedor,
          elaboradoPorId:  compra.usuarioId,
          revisadoPorId:   compra.revisadoAdministracionPorId ?? null,
          autorizadoPorId: compra.usuarioAutorizaId ?? null,
        },
        include: {
          proveedor:    { select: { id: true, nombre: true } },
          elaboradoPor: { select: { nombre: true, apellidos: true } },
          autorizadoPor: { select: { nombre: true, apellidos: true } },
        },
      });
      nuevas.push(nueva);
    }

    await tx.compraRequisicion.update({
      where: { id },
      data: {
        estado: EstadoCompra.ORDEN_GENERADA,
        fechaOrdenCompra: new Date(),
      },
    });

    const foliosList = folios.join(', ');
    await registrarHistorial(
      tx, id, EstadoCompra.ORDEN_GENERADA, usuarioId,
      `Órdenes de compra generadas: ${foliosList}`,
    );

    return nuevas;
  });

  const foliosList = folios.join(', ');
  await crearNotificacion({
    titulo: 'Órdenes de Compra Generadas',
    mensaje: `${ordenes.length > 1 ? 'Órdenes' : 'Orden'} ${foliosList} generada(s) para compra ${compra.folio}.`,
    tipo: 'INFO',
    rol: 'ALMACEN',
    link: `/compras/${id}`,
  });

  await registrarBitacora(usuarioId, 'GENERAR_ORDEN', 'compras', {
    compraId: id,
    ordenesCount: ordenes.length,
    folios: foliosList,
  });

  res.status(201).json({ success: true, data: ordenes });
};

// ============================================================
// 12. REGISTRAR FACTURA
// ============================================================

export const registrarFactura = async (req: Request, res: Response): Promise<void> => {
  const usuarioId = getUsuarioId(req);
  const id        = getParamId(req.params.id, 'compraId');
  const { numero, monto, proveedorId, documentoUrl } = req.body;

  if (!numero) throw new AppError(400, 'número de factura es requerido');
  const montoNum = parseFloat(monto);
  if (isNaN(montoNum) || montoNum <= 0) throw new AppError(400, 'monto debe ser mayor a 0');

  const compra = await prisma.compraRequisicion.findUnique({ where: { id } });
  if (!compra) throw new AppError(404, 'Compra no encontrada');

  if (
    compra.estado !== EstadoCompra.ORDEN_GENERADA &&
    compra.estado !== EstadoCompra.FACTURAS_RECIBIDAS
  ) {
    throw new AppError(400, `No se pueden registrar facturas en estado ${compra.estado}`);
  }

  const factura = await prisma.$transaction(async (tx) => {
    const nueva = await tx.compraFactura.create({
      data: {
        requisicionId: id,
        numero,
        monto:         montoNum,
        proveedorId:   proveedorId
          ? parseInt(String(proveedorId), 10)
          : (compra.proveedorSeleccionadoId ?? null),
        documentoUrl: documentoUrl ?? null,
      },
      include: { proveedor: { select: { id: true, nombre: true } } },
    });

    if (compra.estado === EstadoCompra.ORDEN_GENERADA) {
      await tx.compraRequisicion.update({
        where: { id },
        data: {
          estado: EstadoCompra.FACTURAS_RECIBIDAS,
          fechaRecepcionFacturas: new Date(),
        },
      });
      await registrarHistorial(
        tx, id, EstadoCompra.FACTURAS_RECIBIDAS, usuarioId,
        `Factura ${numero} registrada`,
      );
    }

    return nueva;
  });

  res.status(201).json({ success: true, data: factura });
};

// ============================================================
// SUBIR FACTURA (upload + registro en un paso)
// ============================================================

const storage = multer.diskStorage({
  destination: 'uploads/facturas/',
  filename: (_, file, cb) => cb(null, `${Date.now()}-${file.originalname}`),
});

export const upload = multer({ storage });

export const subirFactura = async (req: Request, res: Response): Promise<void> => {
  const usuarioId    = getUsuarioId(req);
  const rolUsuario   = req.usuario?.rol;
  const requisicionId = getParamId(req.params.id, 'compraId');
  const file         = req.file;

  if (rolUsuario !== 'RRHH_FINANZAS' && rolUsuario !== 'ADMIN_GENERAL') {
    throw new AppError(403, 'No tienes permisos para subir facturas');
  }
  if (!file) throw new AppError(400, 'No se recibió archivo');

  const compra = await prisma.compraRequisicion.findUnique({ where: { id: requisicionId } });
  if (!compra) throw new AppError(404, 'Compra no encontrada');

  if (
    compra.estado !== EstadoCompra.ORDEN_GENERADA &&
    compra.estado !== EstadoCompra.FACTURAS_RECIBIDAS
  ) {
    throw new AppError(400, `No se pueden subir facturas en estado ${compra.estado}`);
  }

  const documentoUrl = `/uploads/facturas/${file.filename}`;

  const { monto: montoBody, numero: numeroBody, proveedorId: proveedorIdBody } = req.body;
  const montoNum = parseFloat(montoBody ?? '0');
  const proveedorIdResolved = proveedorIdBody
    ? parseInt(String(proveedorIdBody), 10)
    : (compra.proveedorSeleccionadoId ?? null);

  await prisma.$transaction(async (tx) => {
    await tx.compraFactura.create({
      data: {
        requisicionId,
        numero:      numeroBody ?? file.originalname,
        monto:       montoNum,
        proveedorId: proveedorIdResolved,
        documentoUrl,
      },
    });

    if (compra.estado === EstadoCompra.ORDEN_GENERADA) {
      await tx.compraRequisicion.update({
        where: { id: requisicionId },
        data: {
          estado: EstadoCompra.FACTURAS_RECIBIDAS,
          fechaRecepcionFacturas: new Date(),
        },
      });
      await registrarHistorial(
        tx, requisicionId, EstadoCompra.FACTURAS_RECIBIDAS, usuarioId,
        `Factura subida: ${file.originalname}`,
      );
    }
  });

  res.json({ success: true, url: documentoUrl });
};

// ============================================================
// 13. GENERAR EXPEDIENTE
// ============================================================

export const generarExpediente = async (req: Request, res: Response): Promise<void> => {
  const usuarioId = getUsuarioId(req);
  const id        = getParamId(req.params.id, 'compraId');
  const { observaciones } = req.body;

  const compra = await prisma.compraRequisicion.findUnique({ where: { id } });
  if (!compra) throw new AppError(404, 'Compra no encontrada');

  validarTransicionCompra(compra.estado, EstadoCompra.EXPEDIENTE_GENERADO);

  const numFacturas = await prisma.compraFactura.count({ where: { requisicionId: id } });
  if (numFacturas === 0) {
    throw new AppError(400, 'Debe registrar al menos una factura antes de generar el expediente');
  }

  await prisma.$transaction(async (tx) => {
    await tx.compraRequisicion.update({
      where: { id },
      data: {
        estado: EstadoCompra.EXPEDIENTE_GENERADO,
        expedienteGenerado: true,
      },
    });
    await registrarHistorial(
      tx, id, EstadoCompra.EXPEDIENTE_GENERADO, usuarioId,
      observaciones ?? 'Expediente generado',
    );
  });

  res.json({ success: true, message: 'Expediente generado correctamente' });
};

// ============================================================
// 14. ENVIAR A FINANZAS
// ============================================================

export const enviarAFinanzas = async (req: Request, res: Response): Promise<void> => {
  const usuarioId  = getUsuarioId(req);
  const rolUsuario = req.usuario?.rol;
  const id         = getParamId(req.params.id, 'compraId');
  const { observaciones } = req.body;

  if (rolUsuario !== 'RRHH_FINANZAS' && rolUsuario !== 'ADMIN_GENERAL') {
    throw new AppError(403, 'Solo finanzas/administración puede enviar a finanzas');
  }

  const compra = await prisma.compraRequisicion.findUnique({ where: { id } });
  if (!compra) throw new AppError(404, 'Compra no encontrada');

  validarTransicionCompra(compra.estado, EstadoCompra.ENVIADA_A_FINANZAS);

  await prisma.$transaction(async (tx) => {
    await tx.compraRequisicion.update({
      where: { id },
      data: {
        estado: EstadoCompra.ENVIADA_A_FINANZAS,
        enviadoFinanzas: true,
        fechaEnvioFinanzas: new Date(),
      },
    });
    await registrarHistorial(
      tx, id, EstadoCompra.ENVIADA_A_FINANZAS, usuarioId,
      observaciones ?? 'Enviado a finanzas para pago',
    );
  });

  await crearNotificacion({
    titulo: 'Compra Enviada a Finanzas',
    mensaje: `Compra ${compra.folio} ha sido enviada a finanzas para pago.`,
    tipo: 'INFO',
    rol: 'RRHH_FINANZAS',
    link: `/compras/${id}`,
  });

  res.json({ success: true, message: 'Compra enviada a finanzas' });
};

// ============================================================
// 15. GENERAR ORDEN DE PAGO
// ============================================================

export const generarOrdenPago = async (req: Request, res: Response): Promise<void> => {
  const usuarioId  = getUsuarioId(req);
  const rolUsuario = req.usuario?.rol;
  const id         = getParamId(req.params.id, 'compraId');
  const { asunto, dirigidoA, observaciones } = req.body;

  if (rolUsuario !== 'RRHH_FINANZAS' && rolUsuario !== 'ADMIN_GENERAL') {
    throw new AppError(403, 'Solo finanzas puede generar órdenes de pago');
  }

  const compra = await prisma.compraRequisicion.findUnique({
    where: { id },
    include: { ordenes: true, facturas: true },
  });
  if (!compra) throw new AppError(404, 'Compra no encontrada');

  const estadosPermitidosOrdenPago: EstadoCompra[] = [
    EstadoCompra.FACTURAS_RECIBIDAS,
    EstadoCompra.EXPEDIENTE_GENERADO,
    EstadoCompra.ENVIADA_A_FINANZAS,
  ];
  if (!estadosPermitidosOrdenPago.includes(compra.estado)) {
    throw new AppError(400, `No se puede generar orden de pago en estado ${compra.estado}`);
  }
  if (compra.facturas.length === 0) {
    throw new AppError(400, 'Debe haber al menos una factura registrada');
  }

  const existe = await prisma.compraOrdenPago.findFirst({ where: { requisicionId: id } });
  if (existe) throw new AppError(400, 'Ya existe orden de pago para esta compra');

  const folio        = await generateFolioOrdenPago();
  const totalGeneral = compra.facturas.reduce((s, f) => s + Number(f.monto), 0);

  const ordenPago = await prisma.$transaction(async (tx) => {
    const nueva = await tx.compraOrdenPago.create({
      data: {
        requisicionId:  id,
        folio,
        asunto:         asunto    ?? 'Envío de facturas para pago',
        dirigidoA:      dirigidoA ?? 'Jefe del Departamento de Administración',
        totalGeneral,
        observaciones:  observaciones ?? null,
        elaboradoPorId: compra.usuarioId,
        revisadoPorId:  usuarioId,
        autorizadoPorId: compra.usuarioAutorizaId ?? null,
        detalles: {
          create: compra.facturas.map((f) => ({
            fechaOrdenCompra: compra.ordenes[0]?.fecha ?? new Date(),
            folioOrdenCompra: compra.ordenes.map(o => o.folio).join(', ') || null,
            numeroFactura:    f.numero,
            proveedorId:
              f.proveedorId ?? compra.proveedorSeleccionadoId ?? null,
            monto: Number(f.monto),
          })),
        },
      },
      include: {
        detalles: { include: { proveedor: { select: { id: true, nombre: true } } } },
        elaboradoPor:  { select: { nombre: true, apellidos: true } },
        revisadoPor:   { select: { nombre: true, apellidos: true } },
        autorizadoPor: { select: { nombre: true, apellidos: true } },
      },
    });

    await registrarHistorial(
      tx, id, EstadoCompra.ENVIADA_A_FINANZAS, usuarioId,
      `Orden de pago generada: ${folio}`,
    );

    return nueva;
  });

  await registrarBitacora(usuarioId, 'GENERAR_ORDEN_PAGO', 'compras', {
    compraId: id,
    ordenPagoId: ordenPago.id,
    folio,
  });

  res.status(201).json({ success: true, data: ordenPago });
};

// ============================================================
// 16. FINALIZAR COMPRA
// ============================================================

export const finalizarCompra = async (req: Request, res: Response): Promise<void> => {
  const usuarioId  = getUsuarioId(req);
  const rolUsuario = req.usuario?.rol;
  const id         = getParamId(req.params.id, 'compraId');
  const { observaciones } = req.body;

  if (rolUsuario !== 'RRHH_FINANZAS' && rolUsuario !== 'ADMIN_GENERAL') {
    throw new AppError(403, 'Solo finanzas/administración puede finalizar compras');
  }

  const compra = await prisma.compraRequisicion.findUnique({ where: { id } });
  if (!compra) throw new AppError(404, 'Compra no encontrada');

  if (compra.estado === EstadoCompra.FINALIZADO) {
    // Ensure Requisicion estado is also synced (covers records created before this fix)
    await prisma.requisicion.updateMany({
      where: { id: compra.requisicionId, estado: { not: EstadoRequisicion.FINALIZADA } },
      data: { estado: EstadoRequisicion.FINALIZADA },
    });
    res.json({ success: true, message: 'Compra ya estaba finalizada' });
    return;
  }

  validarTransicionCompra(compra.estado, EstadoCompra.FINALIZADO);

  await prisma.$transaction(async (tx) => {
    await tx.compraRequisicion.update({
      where: { id },
      data: { estado: EstadoCompra.FINALIZADO },
    });
    await tx.requisicion.update({
      where: { id: compra.requisicionId },
      data: { estado: EstadoRequisicion.FINALIZADA },
    });
    await registrarHistorial(
      tx, id, EstadoCompra.FINALIZADO, usuarioId,
      observaciones ?? 'Compra finalizada',
    );
  });

  await crearNotificacion({
    titulo: 'Compra Finalizada',
    mensaje: `Compra ${compra.folio} ha sido completada exitosamente.`,
    tipo: 'EXITO',
    rol: 'ALMACEN',
    link: `/compras/${id}`,
  });

  await registrarBitacora(usuarioId, 'FINALIZAR_COMPRA', 'compras', {
    compraId: id,
    folio: compra.folio,
  });

  res.json({ success: true, message: 'Compra finalizada' });
};

// ============================================================
// 17. DASHBOARD COMPRAS
// ============================================================

export const dashboardCompras = async (_req: Request, res: Response): Promise<void> => {
  const ESTADOS_ACTIVOS = [
    EstadoCompra.EN_COMPRAS,
    EstadoCompra.COTIZACIONES_CARGADAS,
    EstadoCompra.EN_REVISION_ADMINISTRACION,
    EstadoCompra.DEVUELTA_A_COMPRAS,
    EstadoCompra.EN_REVISION_DIRECCION,
    EstadoCompra.AUTORIZADA,
    EstadoCompra.ORDEN_GENERADA,
    EstadoCompra.FACTURAS_RECIBIDAS,
    EstadoCompra.EXPEDIENTE_GENERADO,
    EstadoCompra.ENVIADA_A_FINANZAS,
  ];

  const [
    pendientes,
    autorizadas,
    rechazadas,
    urgentes,
    comprasMayores,
    porEstado,
    gastosPorProveedor,
    recientes,
  ] = await Promise.all([
    prisma.compraRequisicion.count({ where: { estado: { in: ESTADOS_ACTIVOS } } }),
    prisma.compraRequisicion.count({ where: { estado: EstadoCompra.AUTORIZADA } }),
    prisma.compraRequisicion.count({ where: { estado: EstadoCompra.RECHAZADO } }),
    prisma.compraRequisicion.count({
      where: { esUrgente: true, estado: { in: ESTADOS_ACTIVOS } },
    }),
    prisma.compraRequisicion.count({ where: { esCompraMayor: true } }),
    prisma.compraRequisicion.groupBy({ by: ['estado'], _count: { id: true } }),
    prisma.compraRequisicion.groupBy({
      by: ['proveedorSeleccionadoId'],
      where: {
        proveedorSeleccionadoId: { not: null },
        estado: EstadoCompra.FINALIZADO,
      },
      _sum:   { totalFinal: true },
      _count: { id: true },
    }),
    prisma.compraRequisicion.findMany({
      where:   {},
      include: { usuario: { select: { nombre: true, apellidos: true } } },
      orderBy: { createdAt: 'desc' },
      take: 5,
    }),
  ]);

  res.json({
    success: true,
    data: {
      resumen: { pendientes, autorizadas, rechazadas, urgentes, comprasMayores },
      porEstado: porEstado.map((e) => ({ estado: e.estado, total: e._count.id })),
      gastosPorProveedor: gastosPorProveedor.map((g) => ({
        proveedorId:  g.proveedorSeleccionadoId,
        totalGastos:  g._sum.totalFinal ?? 0,
        numCompras:   g._count.id,
      })),
      recientes,
    },
  });
};

// ============================================================
// BACKWARD-COMPAT: getRequisiciones → alias de getCompras
// ============================================================

export const getRequisiciones = getCompras;