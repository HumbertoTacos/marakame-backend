import { Request, Response } from 'express';
import { prisma } from '../utils/prisma';
import { AppError } from '../middlewares/errorHandler';
import { EstadoCompra, TipoCompra } from '@prisma/client';
import multer from 'multer';
import path from 'path';

// ============================================================
// HELPERS
// ============================================================

const getId = (value: string | string[] | undefined, name = 'id'): number => {
  const str = Array.isArray(value) ? value[0] : value;
  if (!str) throw new AppError(400, `${name} es requerido`);
  const parsed = Number(str);
  if (isNaN(parsed)) throw new AppError(400, `${name} inválido`);
  return parsed;
};

const toNumber = (value: any, defaultValue = 0): number => {
  const num = Number(value);
  return isNaN(num) ? defaultValue : num;
};

const getUsuarioId = (req: Request): number => {
  if (!req.usuario) throw new AppError(401, 'No autenticado');
  return req.usuario.id;
};

const registrarHistorial = async (
  requisicionId: number,
  estado: EstadoCompra,
  usuarioId: number
) => {
  await prisma.compraHistorial.create({
    data: { requisicionId, estado, usuarioId }
  });
};

// ============================================================
// FLUJO DE ESTADOS
// ============================================================

const transicionesValidas: Record<EstadoCompra, EstadoCompra[]> = {
  REQUISICION_CREADA:        [EstadoCompra.REQUISICION_REVISADA],
  REQUISICION_REVISADA:      [EstadoCompra.COTIZACIONES_CARGADAS],
  COTIZACIONES_CARGADAS:     [EstadoCompra.PROVEEDOR_SELECCIONADO],
  PROVEEDOR_SELECCIONADO:    [EstadoCompra.NEGOCIACION_COMPLETADA],
  NEGOCIACION_COMPLETADA:    [EstadoCompra.EN_REVISION_ADMIN],
  EN_REVISION_ADMIN:         [EstadoCompra.EN_AUTORIZACION_DIRECCION],
  EN_AUTORIZACION_DIRECCION: [EstadoCompra.AUTORIZADA, EstadoCompra.RECHAZADO],
  AUTORIZADA:                [EstadoCompra.ORDEN_GENERADA],
  ORDEN_GENERADA:            [EstadoCompra.FACTURAS_RECIBIDAS],
  FACTURAS_RECIBIDAS:        [EstadoCompra.PAGO_GENERADO],
  PAGO_GENERADO:             [EstadoCompra.FINALIZADO],
  FINALIZADO:                [],
  RECHAZADO:                 []
};

// ============================================================
// CREATE REQUISICIÓN
// ============================================================
  export const createRequisicion = async (req: Request, res: Response) => {
    const {
      areaSolicitante,
      descripcion,
      justificacion,
      presupuestoEstimado,
      tipo,
      detalles
    } = req.body;

    const usuarioId = getUsuarioId(req);

    if (!areaSolicitante || !descripcion || !justificacion) {
      throw new AppError(400, 'Campos obligatorios faltantes');
    }

    if (!Array.isArray(detalles) || detalles.length === 0) {
      throw new AppError(400, 'Debes agregar al menos un detalle');
    }

    const tipoEnum = Object.values(TipoCompra).includes(tipo)
      ? tipo
      : TipoCompra.ORDINARIA;

    const folio = `REQ-${Date.now()}-${usuarioId}`;

    const requisicion = await prisma.compraRequisicion.create({
      data: {
        folio,
        usuarioId,
        areaSolicitante,
        descripcion,
        justificacion,
        presupuestoEstimado: toNumber(presupuestoEstimado),
        tipo: tipoEnum,
        estado: EstadoCompra.REQUISICION_CREADA,

        detalles: {
          create: detalles.map((d: any, index: number) => ({
            numero: index + 1,
            producto: d.producto,
            unidad: d.unidad,
            cantidad: toNumber(d.cantidad)
          }))
        }
      },

      include: {
        detalles: true
      }
    });

    await registrarHistorial(
      requisicion.id,
      EstadoCompra.REQUISICION_CREADA,
      usuarioId
    );

    res.status(201).json({
      success: true,
      data: requisicion
    });
  };

// ============================================================
// GET REQUISICIONES
// ============================================================

export const getRequisiciones = async (_req: Request, res: Response) => {
  const data = await prisma.compraRequisicion.findMany({
    include: {
      usuario: {
        select: {
          nombre: true,
          apellidos: true
        }
      },

      detalles: true,
      cotizaciones: true,
      ordenCompra: {
        include: {
          elaboradoPor: true,
          revisadoPor: true,
          autorizadoPor: true
        }
      },
      facturas: true,
      historial: true
    },

    orderBy: {
      createdAt: 'desc'
    }
  });

  res.json({ success: true, data });
};

// ============================================================
// UPDATE ESTADO
// ============================================================

export const updateRequisicionEstado = async (req: Request, res: Response) => {
  const id = getId(req.params.id);
  const { estado, observacionesVoBo } = req.body;
  const usuarioId = getUsuarioId(req);

  const requisicion = await prisma.compraRequisicion.findUnique({ where: { id } });
  if (!requisicion) throw new AppError(404, 'Requisición no encontrada');

  const estadoEnum = estado as EstadoCompra;

  if (!Object.values(EstadoCompra).includes(estadoEnum)) {
    throw new AppError(400, 'Estado inválido');
  }

  if (!transicionesValidas[requisicion.estado].includes(estadoEnum)) {
    throw new AppError(400, `No puedes cambiar de ${requisicion.estado} a ${estadoEnum}`);
  }

  const updateData: any = { estado: estadoEnum };

  if (
    estadoEnum === EstadoCompra.AUTORIZADA ||
    estadoEnum === EstadoCompra.RECHAZADO
  ) {
    updateData.usuarioAutorizaId = usuarioId;
    updateData.observacionesVoBo = observacionesVoBo;
    updateData.fechaAutorizacion = new Date();
  }

  const updated = await prisma.compraRequisicion.update({
    where: { id },
    data: updateData,
    include: { cotizaciones: true, ordenCompra: true }
  });

  await registrarHistorial(id, estadoEnum, usuarioId);

  res.json({ success: true, data: updated });
};

// ============================================================
// COTIZACIONES
// ============================================================

export const addCotizacion = async (req: Request, res: Response) => {
  const id = getId(req.params.requisicionId, 'requisicionId');

  const {
    proveedor,
    precio,
    tiempoEntrega
  } = req.body;

  const usuarioId = getUsuarioId(req);

  if (!proveedor || !precio) {
    throw new AppError(
      400,
      'Proveedor y precio son obligatorios'
    );
  }

  const requisicion =
    await prisma.compraRequisicion.findUnique({
      where: { id },
      include: {
        cotizaciones: true
      }
    });

  if (!requisicion) {
    throw new AppError(
      404,
      'Requisición no encontrada'
    );
  }

  const precioNumero = toNumber(precio);

  // Buscar precio más bajo existente
  const menorActual =
    requisicion.cotizaciones.length > 0
      ? Math.min(
          ...requisicion.cotizaciones.map(c => Number(c.precio))
        )
      : null;

  // La nueva es mejor si es menor que todas
  const nuevaEsMejor =
    menorActual === null || precioNumero < menorActual;

  // Si la nueva es la mejor, quitar bandera anterior
  if (nuevaEsMejor) {
    await prisma.compraCotizacion.updateMany({
      where: {
        requisicionId: id,
        esMejorOpcion: true
      },
      data: {
        esMejorOpcion: false
      }
    });
  }

  const cotizacion =
    await prisma.compraCotizacion.create({
      data: {
        requisicionId: id,
        proveedor,
        precio: precioNumero,
        tiempoEntrega,
        esMejorOpcion: nuevaEsMejor
      }
    });

  // Cambiar estado automáticamente
  if (
    transicionesValidas[
      requisicion.estado
    ].includes(
      EstadoCompra.COTIZACIONES_CARGADAS
    )
  ) {
    await prisma.compraRequisicion.update({
      where: { id },
      data: {
        estado:
          EstadoCompra.COTIZACIONES_CARGADAS
      }
    });

    await registrarHistorial(
      id,
      EstadoCompra.COTIZACIONES_CARGADAS,
      usuarioId
    );
  }

  res.status(201).json({
    success: true,
    data: cotizacion
  });
};

// ============================================================
// GENERAR ORDEN
// ============================================================

export const generarOrden = async (req: Request, res: Response) => {
  const id = getId(req.params.requisicionId, 'requisicionId');
  const { proveedor, total } = req.body;
  const usuarioId = getUsuarioId(req);

  if (!proveedor || !total) {
    throw new AppError(400, 'Proveedor y total son obligatorios');
  }

  const requisicion = await prisma.compraRequisicion.findUnique({ where: { id } });
  if (!requisicion) throw new AppError(404, 'Requisición no encontrada');

  if (requisicion.estado !== EstadoCompra.AUTORIZADA) {
    throw new AppError(400, 'Solo requisiciones autorizadas pueden generar orden');
  }

  const folio = `ORD-${Date.now()}-${usuarioId}`;

  const orden = await prisma.compraOrden.create({
    data: {
      requisicionId: id,
      folio,
      fecha: new Date(),

      proveedor,
      total: toNumber(total),

      elaboradoPorId: requisicion.usuarioId,
      revisadoPorId: usuarioId,
      autorizadoPorId: requisicion.usuarioAutorizaId
    },

    include: {
      elaboradoPor: true,
      revisadoPor: true,
      autorizadoPor: true
    }
  });

  await prisma.compraRequisicion.update({
    where: { id },
    data: { estado: EstadoCompra.ORDEN_GENERADA }
  });

  await registrarHistorial(id, EstadoCompra.ORDEN_GENERADA, usuarioId);

  res.status(201).json({ success: true, data: orden });
};

// ============================================================
// FACTURA
// ============================================================

const storage = multer.diskStorage({
  destination: 'uploads/facturas/',
  filename: (_, file, cb) => cb(null, `${Date.now()}-${file.originalname}`)
});

export const upload = multer({ storage });

export const subirFactura = async (req: Request, res: Response) => {
  const { requisicionId } = req.params;
  const file = req.file;

  if (!file) throw new AppError(400, 'No se recibió archivo');

  await prisma.compraFactura.create({
    data: {
      requisicionId: parseInt(requisicionId as string),
      numero: file.originalname,
      monto: 0, // o del body
      documentoUrl: `/uploads/facturas/${file.filename}`
    }
  });

  res.json({ success: true, url: `/uploads/facturas/${file.filename}` });
};