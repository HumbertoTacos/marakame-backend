import { Request, Response } from 'express';
import { prisma } from '../utils/prisma';
import { AppError } from '../middlewares/errorHandler';
import path from 'path';
import fs from 'fs';
import multer from 'multer';

type EstadoProveedor       = 'ACTIVO' | 'INACTIVO' | 'BLOQUEADO';
type GiroProveedor         = 'TECNOLOGIA' | 'PAPELERIA' | 'REFACCIONES' | 'SERVICIOS' | 'LIMPIEZA' | 'ALIMENTOS' | 'MEDICAMENTOS' | 'OTROS';
type CondicionesPagoProveedor = 'CONTADO' | 'CREDITO_15' | 'CREDITO_30';
type MonedaProveedor       = 'MXN' | 'USD' | 'EUR';

// ─── HELPERS ─────────────────────────────────────────────────────────────────

const getParamId = (val: string | string[] | undefined, name = 'id'): number => {
  const str = Array.isArray(val) ? val[0] : val;
  const n   = parseInt(str as string, 10);
  if (!str || isNaN(n) || n <= 0) throw new AppError(400, `${name} inválido`);
  return n;
};

const uploadDir = process.env.UPLOADS_DIR || './uploads';

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    const dir = path.join(uploadDir, 'proveedores');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (_req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, unique + path.extname(file.originalname));
  },
});

export const upload = multer({
  storage,
  fileFilter: (_req, file, cb) => {
    const allowed = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new AppError(400, 'Solo se aceptan PDF, JPG, PNG.') as unknown as null, false);
  },
  limits: { fileSize: 10 * 1024 * 1024 },
});

const INCLUDE_PROVEEDOR = {
  _count: {
    select: { cotizaciones: true, ordenes: true, contraRecibos: true },
  },
};

// ─── LISTAR ───────────────────────────────────────────────────────────────────

export async function getProveedores(req: Request, res: Response) {
  const { q, estado, giro, page = '1', limit: limitParam = '50' } = req.query as Record<string, string>;

  const pageNum  = Math.max(1, parseInt(page, 10) || 1);
  const pageSize = Math.min(100, parseInt(limitParam, 10) || 50);
  const skip     = (pageNum - 1) * pageSize;

  const where: Record<string, unknown> = {};

  if (q) {
    where.OR = [
      { nombre:           { contains: q, mode: 'insensitive' } },
      { razonSocial:      { contains: q, mode: 'insensitive' } },
      { rfc:              { contains: q, mode: 'insensitive' } },
      { contactoPrincipal:{ contains: q, mode: 'insensitive' } },
      { correo:           { contains: q, mode: 'insensitive' } },
    ];
  }

  if (estado && ['ACTIVO', 'INACTIVO', 'BLOQUEADO'].includes(estado)) {
    where.estadoProveedor = estado as EstadoProveedor;
  }

  const girosValidos: GiroProveedor[] = ['TECNOLOGIA', 'PAPELERIA', 'REFACCIONES', 'SERVICIOS', 'LIMPIEZA', 'ALIMENTOS', 'MEDICAMENTOS', 'OTROS'];
  if (giro && girosValidos.includes(giro as GiroProveedor)) {
    where.giro = giro as GiroProveedor;
  }

  const [total, proveedores] = await Promise.all([
    prisma.proveedor.count({ where }),
    prisma.proveedor.findMany({
      where,
      include: INCLUDE_PROVEEDOR,
      orderBy: { nombre: 'asc' },
      skip,
      take: pageSize,
    }),
  ]);

  res.json({
    success: true,
    data: proveedores,
    meta: { total, page: pageNum, limit: pageSize, totalPages: Math.ceil(total / pageSize) },
  });
}

// ─── OBTENER POR ID ───────────────────────────────────────────────────────────

export async function getProveedorById(req: Request, res: Response) {
  const id = getParamId(req.params.id);

  const proveedor = await prisma.proveedor.findUnique({
    where: { id },
    include: {
      ...INCLUDE_PROVEEDOR,
      cotizaciones: {
        orderBy: { id: 'desc' },
        take: 10,
      },
      ordenes: {
        orderBy: { fecha: 'desc' },
        take: 10,
        select: { id: true, folio: true, fecha: true, total: true },
      },
    },
  });

  if (!proveedor) throw new AppError(404, 'Proveedor no encontrado');

  res.json({ success: true, data: proveedor });
}

// ─── CREAR ────────────────────────────────────────────────────────────────────

export async function createProveedor(req: Request, res: Response) {
  const {
    nombre, razonSocial, rfc, curp, tipo, giro, tipoPersona,
    estadoProveedor,
    contactoPrincipal, cargoContacto, telefono, celular, correo, paginaWeb,
    pais, estadoRepublica, ciudad, colonia, calle, numExterior, numInterior, codigoPostal, referencias,
    banco, cuentaBancaria, clabe, metodoPago, condicionesPago, moneda, diasCredito,
    regimenFiscal, usoCFDI, metodoFacturacion, retencionesAplicables,
    productosServicios, marcas, tiempoEntregaPromedio, garantias, convenios,
    calificacion, observaciones, notas,
  } = req.body;

  // Validaciones obligatorias
  if (!nombre?.trim())           throw new AppError(400, 'El nombre comercial es obligatorio');
  if (!razonSocial?.trim())      throw new AppError(400, 'La razón social es obligatoria');
  if (!rfc?.trim())              throw new AppError(400, 'El RFC es obligatorio');
  if (!contactoPrincipal?.trim())throw new AppError(400, 'El contacto principal es obligatorio');
  if (!telefono?.trim())         throw new AppError(400, 'El teléfono es obligatorio');
  if (!correo?.trim())           throw new AppError(400, 'El correo es obligatorio');
  if (!codigoPostal?.trim())     throw new AppError(400, 'El código postal es obligatorio');
  if (!banco?.trim())            throw new AppError(400, 'El banco es obligatorio');
  if (!clabe?.trim())            throw new AppError(400, 'La CLABE es obligatoria');
  if (!regimenFiscal?.trim())    throw new AppError(400, 'El régimen fiscal es obligatorio');

  // Validar formato RFC básico
  const rfcRegex = /^[A-Z&Ñ]{3,4}[0-9]{6}[A-Z0-9]{3}$/i;
  if (!rfcRegex.test(rfc.trim())) throw new AppError(400, 'RFC con formato inválido');

  // Validar CLABE (18 dígitos)
  if (!/^\d{18}$/.test(clabe.trim())) throw new AppError(400, 'CLABE debe tener 18 dígitos');

  // Validar correo
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo.trim())) throw new AppError(400, 'Correo electrónico inválido');

  // Verificar unicidad
  const existe = await prisma.proveedor.findFirst({
    where: { OR: [{ nombre: nombre.trim() }, { rfc: rfc.trim() }] },
  });
  if (existe) {
    if (existe.nombre === nombre.trim()) throw new AppError(409, 'Ya existe un proveedor con ese nombre comercial');
    throw new AppError(409, 'Ya existe un proveedor con ese RFC');
  }

  const proveedor = await prisma.proveedor.create({
    data: {
      nombre:            nombre.trim(),
      razonSocial:       razonSocial?.trim() || null,
      rfc:               rfc.trim().toUpperCase(),
      curp:              curp?.trim() || null,
      tipo:              tipo || null,
      giro:              giro || null,
      tipoPersona:       tipoPersona || null,
      estadoProveedor:   (estadoProveedor as EstadoProveedor) || 'ACTIVO',
      activo:            estadoProveedor !== 'INACTIVO' && estadoProveedor !== 'BLOQUEADO',
      contactoPrincipal: contactoPrincipal?.trim() || null,
      cargoContacto:     cargoContacto?.trim() || null,
      telefono:          telefono?.trim() || null,
      celular:           celular?.trim() || null,
      correo:            correo?.trim().toLowerCase() || null,
      paginaWeb:         paginaWeb?.trim() || null,
      pais:              pais?.trim() || null,
      estadoRepublica:   estadoRepublica?.trim() || null,
      ciudad:            ciudad?.trim() || null,
      colonia:           colonia?.trim() || null,
      calle:             calle?.trim() || null,
      numExterior:       numExterior?.trim() || null,
      numInterior:       numInterior?.trim() || null,
      codigoPostal:      codigoPostal?.trim() || null,
      referencias:       referencias?.trim() || null,
      banco:             banco?.trim() || null,
      cuentaBancaria:    cuentaBancaria?.trim() || null,
      clabe:             clabe?.trim() || null,
      metodoPago:        metodoPago?.trim() || null,
      condicionesPago:   condicionesPago || null,
      moneda:            moneda || null,
      diasCredito:       diasCredito ? parseInt(diasCredito, 10) : null,
      regimenFiscal:     regimenFiscal?.trim() || null,
      usoCFDI:           usoCFDI?.trim() || null,
      metodoFacturacion: metodoFacturacion?.trim() || null,
      retencionesAplicables: retencionesAplicables?.trim() || null,
      productosServicios: productosServicios?.trim() || null,
      marcas:            marcas?.trim() || null,
      tiempoEntregaPromedio: tiempoEntregaPromedio?.trim() || null,
      garantias:         garantias?.trim() || null,
      convenios:         convenios?.trim() || null,
      calificacion:      calificacion ? parseInt(calificacion, 10) : null,
      observaciones:     observaciones?.trim() || null,
      notas:             notas?.trim() || null,
    },
  });

  res.status(201).json({ success: true, data: proveedor, message: 'Proveedor registrado correctamente' });
}

// ─── ACTUALIZAR ───────────────────────────────────────────────────────────────

export async function updateProveedor(req: Request, res: Response) {
  const id = getParamId(req.params.id);

  const existing = await prisma.proveedor.findUnique({ where: { id } });
  if (!existing) throw new AppError(404, 'Proveedor no encontrado');

  const {
    nombre, razonSocial, rfc, curp, tipo, giro, tipoPersona, estadoProveedor,
    contactoPrincipal, cargoContacto, telefono, celular, correo, paginaWeb,
    pais, estadoRepublica, ciudad, colonia, calle, numExterior, numInterior, codigoPostal, referencias,
    banco, cuentaBancaria, clabe, metodoPago, condicionesPago, moneda, diasCredito,
    regimenFiscal, usoCFDI, metodoFacturacion, retencionesAplicables,
    productosServicios, marcas, tiempoEntregaPromedio, garantias, convenios,
    calificacion, observaciones, notas,
  } = req.body;

  // Validar RFC si cambió
  if (rfc && rfc.trim() !== existing.rfc) {
    const rfcRegex = /^[A-Z&Ñ]{3,4}[0-9]{6}[A-Z0-9]{3}$/i;
    if (!rfcRegex.test(rfc.trim())) throw new AppError(400, 'RFC con formato inválido');
    const dup = await prisma.proveedor.findUnique({ where: { rfc: rfc.trim().toUpperCase() } });
    if (dup && dup.id !== id) throw new AppError(409, 'Ya existe un proveedor con ese RFC');
  }

  // Validar CLABE si llegó
  if (clabe && !/^\d{18}$/.test(clabe.trim())) throw new AppError(400, 'CLABE debe tener 18 dígitos');

  // Validar correo si llegó
  if (correo && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo.trim())) throw new AppError(400, 'Correo electrónico inválido');

  const nuevoEstado = (estadoProveedor as EstadoProveedor) || existing.estadoProveedor;

  const updated = await prisma.proveedor.update({
    where: { id },
    data: {
      ...(nombre            !== undefined && { nombre: nombre.trim() }),
      ...(razonSocial       !== undefined && { razonSocial: razonSocial?.trim() || null }),
      ...(rfc               !== undefined && { rfc: rfc.trim().toUpperCase() }),
      ...(curp              !== undefined && { curp: curp?.trim() || null }),
      ...(tipo              !== undefined && { tipo: tipo || null }),
      ...(giro              !== undefined && { giro: giro || null }),
      ...(tipoPersona       !== undefined && { tipoPersona: tipoPersona || null }),
      ...(estadoProveedor   !== undefined && {
        estadoProveedor: nuevoEstado,
        activo: nuevoEstado === 'ACTIVO',
      }),
      ...(contactoPrincipal !== undefined && { contactoPrincipal: contactoPrincipal?.trim() || null }),
      ...(cargoContacto     !== undefined && { cargoContacto: cargoContacto?.trim() || null }),
      ...(telefono          !== undefined && { telefono: telefono?.trim() || null }),
      ...(celular           !== undefined && { celular: celular?.trim() || null }),
      ...(correo            !== undefined && { correo: correo?.trim().toLowerCase() || null }),
      ...(paginaWeb         !== undefined && { paginaWeb: paginaWeb?.trim() || null }),
      ...(pais              !== undefined && { pais: pais?.trim() || null }),
      ...(estadoRepublica   !== undefined && { estadoRepublica: estadoRepublica?.trim() || null }),
      ...(ciudad            !== undefined && { ciudad: ciudad?.trim() || null }),
      ...(colonia           !== undefined && { colonia: colonia?.trim() || null }),
      ...(calle             !== undefined && { calle: calle?.trim() || null }),
      ...(numExterior       !== undefined && { numExterior: numExterior?.trim() || null }),
      ...(numInterior       !== undefined && { numInterior: numInterior?.trim() || null }),
      ...(codigoPostal      !== undefined && { codigoPostal: codigoPostal?.trim() || null }),
      ...(referencias       !== undefined && { referencias: referencias?.trim() || null }),
      ...(banco             !== undefined && { banco: banco?.trim() || null }),
      ...(cuentaBancaria    !== undefined && { cuentaBancaria: cuentaBancaria?.trim() || null }),
      ...(clabe             !== undefined && { clabe: clabe?.trim() || null }),
      ...(metodoPago        !== undefined && { metodoPago: metodoPago?.trim() || null }),
      ...(condicionesPago   !== undefined && { condicionesPago: condicionesPago || null }),
      ...(moneda            !== undefined && { moneda: moneda || null }),
      ...(diasCredito       !== undefined && { diasCredito: diasCredito ? parseInt(diasCredito, 10) : null }),
      ...(regimenFiscal     !== undefined && { regimenFiscal: regimenFiscal?.trim() || null }),
      ...(usoCFDI           !== undefined && { usoCFDI: usoCFDI?.trim() || null }),
      ...(metodoFacturacion !== undefined && { metodoFacturacion: metodoFacturacion?.trim() || null }),
      ...(retencionesAplicables !== undefined && { retencionesAplicables: retencionesAplicables?.trim() || null }),
      ...(productosServicios !== undefined && { productosServicios: productosServicios?.trim() || null }),
      ...(marcas            !== undefined && { marcas: marcas?.trim() || null }),
      ...(tiempoEntregaPromedio !== undefined && { tiempoEntregaPromedio: tiempoEntregaPromedio?.trim() || null }),
      ...(garantias         !== undefined && { garantias: garantias?.trim() || null }),
      ...(convenios         !== undefined && { convenios: convenios?.trim() || null }),
      ...(calificacion      !== undefined && { calificacion: calificacion ? parseInt(calificacion, 10) : null }),
      ...(observaciones     !== undefined && { observaciones: observaciones?.trim() || null }),
      ...(notas             !== undefined && { notas: notas?.trim() || null }),
    },
  });

  res.json({ success: true, data: updated, message: 'Proveedor actualizado correctamente' });
}

// ─── CAMBIAR ESTADO ───────────────────────────────────────────────────────────

export async function cambiarEstadoProveedor(req: Request, res: Response) {
  const id = getParamId(req.params.id);
  const { estado } = req.body;

  if (!['ACTIVO', 'INACTIVO', 'BLOQUEADO'].includes(estado)) {
    throw new AppError(400, 'Estado inválido. Valores: ACTIVO, INACTIVO, BLOQUEADO');
  }

  const existing = await prisma.proveedor.findUnique({ where: { id } });
  if (!existing) throw new AppError(404, 'Proveedor no encontrado');

  const updated = await prisma.proveedor.update({
    where: { id },
    data: {
      estadoProveedor: estado as EstadoProveedor,
      activo: estado === 'ACTIVO',
    },
  });

  res.json({ success: true, data: updated, message: `Proveedor ${estado.toLowerCase()}` });
}

// ─── SUBIR DOCUMENTO ─────────────────────────────────────────────────────────

export async function subirDocumentoProveedor(req: Request, res: Response) {
  const id   = getParamId(req.params.id);
  const tipo = (Array.isArray(req.params.tipo) ? req.params.tipo[0] : req.params.tipo) as string;

  const camposPermitidos: Record<string, string> = {
    ine:           'ineRepresentanteUrl',
    acta:          'actaConstitutivaUrl',
    constancia:    'constanciaFiscalUrl',
    domicilio:     'comprobanteDomicilioUrl',
    contrato:      'contratoUrl',
    catalogo:      'catalogoProductosUrl',
  };

  if (!camposPermitidos[tipo]) {
    throw new AppError(400, `Tipo de documento inválido. Válidos: ${Object.keys(camposPermitidos).join(', ')}`);
  }

  if (!req.file) throw new AppError(400, 'No se recibió ningún archivo');

  const existing = await prisma.proveedor.findUnique({ where: { id } });
  if (!existing) throw new AppError(404, 'Proveedor no encontrado');

  const campo  = camposPermitidos[tipo];
  const urlDoc = `/uploads/proveedores/${req.file.filename}`;

  const updated = await prisma.proveedor.update({
    where: { id },
    data: { [campo]: urlDoc },
  });

  res.json({ success: true, data: updated, url: urlDoc, message: 'Documento subido correctamente' });
}
