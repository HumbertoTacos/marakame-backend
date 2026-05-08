import { Request, Response } from 'express';
import { prisma } from '../utils/prisma';
import { AppError } from '../middlewares/errorHandler';
import { EstadoCompra, TipoCompra } from '@prisma/client';
import { permisosEstado } from '../utils/comprasPermissions';
import multer from 'multer';

// ============================================================
// HELPERS
// ============================================================

const getId = (
  value: string | string[] | undefined,
  name = 'id'
): number => {

  const str =
    Array.isArray(value)
      ? value[0]
      : value;

  if (!str) {
    throw new AppError(
      400,
      `${name} es requerido`
    );
  }

  const parsed = Number(str);

  if (isNaN(parsed)) {
    throw new AppError(
      400,
      `${name} inválido`
    );
  }

  return parsed;
};

const toNumber = (
  value: any,
  defaultValue = 0
): number => {

  const num = Number(value);

  return isNaN(num)
    ? defaultValue
    : num;
};

const getUsuarioId = (
  req: Request
): number => {

  if (!req.usuario) {
    throw new AppError(
      401,
      'No autenticado'
    );
  }

  return req.usuario.id;
};

const registrarHistorial = async (
  requisicionId: number,
  estado: EstadoCompra,
  usuarioId: number
) => {

  await prisma.compraHistorial.create({
    data: {
      requisicionId,
      estado,
      usuarioId
    }
  });
};

// ============================================================
// FLUJO DE ESTADOS
// ============================================================

const transicionesValidas: Record<
  EstadoCompra,
  EstadoCompra[]
> = {

  REQUISICION_CREADA: [
    EstadoCompra.EN_REVISION_RECURSOS
  ],

  EN_REVISION_RECURSOS: [
    EstadoCompra.EN_REVISION_COMPRAS,
    EstadoCompra.RECHAZADO
  ],

  // Compras captura cotizaciones (mínimo 3 → auto-avanza a COTIZACIONES_CARGADAS)
  EN_REVISION_COMPRAS: [
    EstadoCompra.COTIZACIONES_CARGADAS,
    EstadoCompra.RECHAZADO
  ],

  // Administración revisa expediente y reenvía a Dirección para autorización
  EN_REVISION_ADMINISTRACION: [
    EstadoCompra.EN_REVISION_DIRECCION,
    EstadoCompra.RECHAZADO
  ],

  // Dirección General autoriza o rechaza
  EN_REVISION_DIRECCION: [
    EstadoCompra.AUTORIZADA,
    EstadoCompra.RECHAZADO
  ],

  COTIZACIONES_CARGADAS: [
    EstadoCompra.PROVEEDOR_SELECCIONADO
  ],

  PROVEEDOR_SELECCIONADO: [
    EstadoCompra.NEGOCIACION_COMPLETADA
  ],

  // Tras negociación: Compras envía expediente a Administración para revisión
  NEGOCIACION_COMPLETADA: [
    EstadoCompra.EN_REVISION_ADMINISTRACION,
    EstadoCompra.RECHAZADO
  ],

  AUTORIZADA: [
    EstadoCompra.ORDEN_GENERADA
  ],

  ORDEN_GENERADA: [
    EstadoCompra.FACTURAS_RECIBIDAS
  ],

  FACTURAS_RECIBIDAS: [
    EstadoCompra.ORDEN_PAGO_GENERADA
  ],

  ORDEN_PAGO_GENERADA: [
    EstadoCompra.PAGO_GENERADO
  ],

  PAGO_GENERADO: [
    EstadoCompra.FINALIZADO
  ],

  FINALIZADO: [],

  RECHAZADO: []
};

// ============================================================
// CREATE REQUISICIÓN
// ============================================================

export const createRequisicion = async (
  req: Request,
  res: Response
) => {

  const {
    areaSolicitante,
    descripcion,
    justificacion,
    presupuestoEstimado,
    tipo,
    detalles
  } = req.body;

  const usuarioId =
    getUsuarioId(req);

  if (
    !areaSolicitante ||
    !descripcion ||
    !justificacion
  ) {
    throw new AppError(
      400,
      'Campos obligatorios faltantes'
    );
  }

  if (
    !Array.isArray(detalles) ||
    detalles.length === 0
  ) {
    throw new AppError(
      400,
      'Debes agregar al menos un detalle'
    );
  }

  const tipoEnum =
    Object.values(TipoCompra).includes(tipo)
      ? tipo
      : TipoCompra.ORDINARIA;

  const folio =
    `REQ-${Date.now()}-${usuarioId}`;

  const requisicion =
    await prisma.compraRequisicion.create({

      data: {

        folio,

        usuarioId,

        areaSolicitante,

        descripcion,

        justificacion,

        presupuestoEstimado:
          toNumber(presupuestoEstimado),

        tipo: tipoEnum,

        estado:
          EstadoCompra.REQUISICION_CREADA,

        detalles: {
          create: detalles.map(
            (
              d: any,
              index: number
            ) => ({
              numero: index + 1,
              producto: d.producto,
              unidad: d.unidad,
              cantidad: toNumber(d.cantidad)
            })
          )
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

export const getRequisiciones = async (
  _req: Request,
  res: Response
) => {

  const data =
    await prisma.compraRequisicion.findMany({

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

        ordenPago: {
          include: {
            elaboradoPor: true,
            revisadoPor: true,
            autorizadoPor: true,
            detalles: true
          }
        },

        facturas: true,

        historial: true
      },

      orderBy: {
        createdAt: 'desc'
      }
    });

  res.json({
    success: true,
    data
  });
};

// ============================================================
// UPDATE ESTADO
// ============================================================

export const updateRequisicionEstado = async (
  req: Request,
  res: Response
) => {

  const id =
    getId(req.params.id);

  const {
    estado,
    observacionesVoBo
  } = req.body;

  const usuarioId =
    getUsuarioId(req);

  const rolUsuario =
    req.usuario?.rol;

  if (!rolUsuario) {
    throw new AppError(
      401,
      'No autenticado'
    );
  }

  const requisicion =
    await prisma.compraRequisicion.findUnique({
      where: { id }
    });

  if (!requisicion) {
    throw new AppError(
      404,
      'Requisición no encontrada'
    );
  }

  const estadoEnum =
    estado as EstadoCompra;

  const rolesPermitidos =
    permisosEstado[estadoEnum];

  if (
    rolesPermitidos &&
    !rolesPermitidos.includes(rolUsuario)
  ) {
    throw new AppError(
      403,
      'No tienes permisos para esta acción'
    );
  }

  if (
    !Object.values(EstadoCompra)
      .includes(estadoEnum)
  ) {
    throw new AppError(
      400,
      'Estado inválido'
    );
  }

  if (
    !transicionesValidas[
      requisicion.estado
    ].includes(estadoEnum)
  ) {
    throw new AppError(
      400,
      `No puedes cambiar de ${requisicion.estado} a ${estadoEnum}`
    );
  }

  // ========================================================
  // VALIDAR 3 COTIZACIONES
  // ========================================================

  if (
    estadoEnum ===
    EstadoCompra.PROVEEDOR_SELECCIONADO
  ) {

    const cotizaciones =
      await prisma.compraCotizacion.count({
        where: {
          requisicionId: id
        }
      });

    if (cotizaciones < 3) {
      throw new AppError(
        400,
        'Debes registrar mínimo 3 cotizaciones'
      );
    }
  }

  const updateData: any = {
    estado: estadoEnum
  };

  // ========================================================
  // RECHAZO
  // ========================================================

  if (
    estadoEnum ===
    EstadoCompra.RECHAZADO
  ) {

    updateData.observacionesVoBo =
      observacionesVoBo;

    updateData.fechaAutorizacion =
      new Date();
  }

  // ========================================================
  // AUTORIZACIÓN
  // ========================================================

  if (
    estadoEnum ===
    EstadoCompra.AUTORIZADA
  ) {

    updateData.usuarioAutorizaId =
      usuarioId;

    updateData.fechaAutorizacion =
      new Date();
  }

  const updated =
    await prisma.compraRequisicion.update({

      where: { id },

      data: updateData,

      include: {
        cotizaciones: true,
        ordenCompra: true,
        ordenPago: true,
        facturas: true
      }
    });

  await registrarHistorial(
    id,
    estadoEnum,
    usuarioId
  );

  res.json({
    success: true,
    data: updated
  });
};

// ============================================================
// COTIZACIONES
// ============================================================

export const addCotizacion = async (
  req: Request,
  res: Response
) => {

  const id =
    getId(
      req.params.requisicionId,
      'requisicionId'
    );

  const {
    proveedor,
    precio,
    tiempoEntrega
  } = req.body;

  const usuarioId =
    getUsuarioId(req);

  const rolUsuario =
    req.usuario?.rol;

  if (
    rolUsuario !== 'ALMACEN' &&
    rolUsuario !== 'ADMIN_GENERAL'
  ) {
    throw new AppError(
      403,
      'No tienes permisos para agregar cotizaciones'
    );
  }

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

  const precioNumero =
    toNumber(precio);

  const menorActual =
    requisicion.cotizaciones.length > 0
      ? Math.min(
          ...requisicion.cotizaciones.map(
            c => Number(c.precio)
          )
        )
      : null;

  const nuevaEsMejor =
    menorActual === null ||
    precioNumero < menorActual;

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

export const generarOrden = async (
  req: Request,
  res: Response
) => {

  const id =
    getId(
      req.params.requisicionId,
      'requisicionId'
    );

  const {
    proveedor,
    total
  } = req.body;

  const usuarioId =
    getUsuarioId(req);

  const rolUsuario =
    req.usuario?.rol;

  if (
    rolUsuario !== 'ADMIN_GENERAL'
  ) {
    throw new AppError(
      403,
      'No tienes permisos para generar órdenes'
    );
  }

  if (!proveedor || !total) {
    throw new AppError(
      400,
      'Proveedor y total son obligatorios'
    );
  }

  const requisicion =
    await prisma.compraRequisicion.findUnique({
      where: { id }
    });

  if (!requisicion) {
    throw new AppError(
      404,
      'Requisición no encontrada'
    );
  }

  if (
    requisicion.estado !==
    EstadoCompra.AUTORIZADA
  ) {
    throw new AppError(
      400,
      'Solo requisiciones autorizadas pueden generar orden'
    );
  }

  const existeOrden =
    await prisma.compraOrden.findFirst({
      where: {
        requisicionId: id
      }
    });

  if (existeOrden) {
    throw new AppError(
      400,
      'La requisición ya tiene una orden'
    );
  }

  const folio =
    `ORD-${Date.now()}-${usuarioId}`;

  const orden =
    await prisma.compraOrden.create({

      data: {

        requisicionId: id,

        folio,

        fecha: new Date(),

        proveedor,

        total: toNumber(total),

        elaboradoPorId:
          requisicion.usuarioId,

        revisadoPorId:
          usuarioId,

        autorizadoPorId:
          requisicion.usuarioAutorizaId
      },

      include: {
        elaboradoPor: true,
        revisadoPor: true,
        autorizadoPor: true
      }
    });

  await prisma.compraRequisicion.update({

    where: { id },

    data: {
      estado:
        EstadoCompra.ORDEN_GENERADA
    }
  });

  await registrarHistorial(
    id,
    EstadoCompra.ORDEN_GENERADA,
    usuarioId
  );

  res.status(201).json({
    success: true,
    data: orden
  });
};

// ============================================================
// GENERAR ORDEN DE PAGO
// ============================================================

export const generarOrdenPago = async (
  req: Request,
  res: Response
) => {

  const id =
    getId(
      req.params.requisicionId,
      'requisicionId'
    );

  const usuarioId =
    getUsuarioId(req);

  const rolUsuario =
    req.usuario?.rol;

  const {
    asunto,
    dirigidoA
  } = req.body;

  if (
    rolUsuario !== 'RRHH_FINANZAS' &&
    rolUsuario !== 'ADMIN_GENERAL'
  ) {
    throw new AppError(
      403,
      'No tienes permisos para generar órdenes de pago'
    );
  }

  const requisicion =
    await prisma.compraRequisicion.findUnique({

      where: { id },

      include: {
        ordenCompra: true
      }
    });

  if (!requisicion) {
    throw new AppError(
      404,
      'Requisición no encontrada'
    );
  }

  if (
    requisicion.estado !==
    EstadoCompra.FACTURAS_RECIBIDAS
  ) {
    throw new AppError(
      400,
      'La requisición aún no tiene facturas'
    );
  }

  const facturas =
    await prisma.compraFactura.findMany({
      where: {
        requisicionId: id
      }
    });

  if (facturas.length === 0) {
    throw new AppError(
      400,
      'Debes subir al menos una factura'
    );
  }

  const existeOrdenPago =
    await prisma.compraOrdenPago.findFirst({
      where: {
        requisicionId: id
      }
    });

  if (existeOrdenPago) {
    throw new AppError(
      400,
      'La requisición ya tiene orden de pago'
    );
  }

  // Distribuir monto si las facturas tienen monto=0
  const ordenTotal =
    Number(requisicion.ordenCompra?.total ?? requisicion.presupuestoEstimado ?? 0);

  const montoPorFactura =
    facturas.length > 0 ? ordenTotal / facturas.length : 0;

  const folio =
    `OP-${Date.now()}-${usuarioId}`;

  const totalGeneral =
    facturas.reduce(
      (sum, f) => sum + (Number(f.monto) > 0 ? Number(f.monto) : montoPorFactura),
      0
    );

  // Construir detalles: una fila por factura
  const detallesData = facturas.map(f => ({
    fechaOrdenCompra: requisicion.ordenCompra?.fecha ?? new Date(),
    folioOrdenCompra: requisicion.ordenCompra?.folio ?? null,
    numeroFactura:    f.numero,
    proveedor:        requisicion.ordenCompra?.proveedor ?? requisicion.proveedorSeleccionado ?? null,
    monto:            Number(f.monto) > 0 ? Number(f.monto) : montoPorFactura,
  }));

  const ordenPago =
    await prisma.compraOrdenPago.create({

      data: {

        requisicionId: id,

        folio,

        asunto:   asunto   || 'Envío de facturas para pago',
        dirigidoA: dirigidoA || 'Jefe del Departamento de Administración',

        totalGeneral,

        observaciones: null,

        elaboradoPorId:  requisicion.usuarioId,
        revisadoPorId:   usuarioId,
        autorizadoPorId: requisicion.usuarioAutorizaId,

        detalles: {
          create: detallesData
        }
      },

      include: {
        elaboradoPor: true,
        revisadoPor: true,
        autorizadoPor: true,
        detalles: true
      }
    });

  await prisma.compraRequisicion.update({

    where: { id },

    data: {
      estado:
        EstadoCompra.ORDEN_PAGO_GENERADA
    }
  });

  await registrarHistorial(
    id,
    EstadoCompra.ORDEN_PAGO_GENERADA,
    usuarioId
  );

  res.status(201).json({
    success: true,
    data: ordenPago
  });
};

// ============================================================
// FACTURAS
// ============================================================

const storage =
  multer.diskStorage({

    destination:
      'uploads/facturas/',

    filename:
      (_, file, cb) =>
        cb(
          null,
          `${Date.now()}-${file.originalname}`
        )
  });

export const upload =
  multer({ storage });

export const subirFactura = async (
  req: Request,
  res: Response
) => {

  const { requisicionId } =
    req.params;

  const file =
    req.file;

  const rolUsuario =
    req.usuario?.rol;

  if (
    rolUsuario !== 'RRHH_FINANZAS' &&
    rolUsuario !== 'ADMIN_GENERAL'
  ) {
    throw new AppError(
      403,
      'No tienes permisos para subir facturas'
    );
  }

  if (!file) {
    throw new AppError(
      400,
      'No se recibió archivo'
    );
  }

  const requisicion =
    await prisma.compraRequisicion.findUnique({

      where: {
        id: parseInt(requisicionId as string)
      }
    });

  if (!requisicion) {
    throw new AppError(
      404,
      'Requisición no encontrada'
    );
  }

  await prisma.compraFactura.create({

    data: {

      requisicionId:
        parseInt(requisicionId as string),

      numero:
        file.originalname,

      monto: 0,

      documentoUrl:
        `/uploads/facturas/${file.filename}`
    }
  });

  await prisma.compraRequisicion.update({

    where: {
      id: parseInt(requisicionId as string)
    },

    data: {
      estado:
        EstadoCompra.FACTURAS_RECIBIDAS
    }
  });

  await registrarHistorial(
    parseInt(requisicionId as string),
    EstadoCompra.FACTURAS_RECIBIDAS,
    req.usuario!.id
  );

  res.json({
    success: true,
    url:
      `/uploads/facturas/${file.filename}`
  });
};