import { Request, Response } from 'express';
import { prisma } from '../utils/prisma';
import { AppError } from '../middlewares/errorHandler';

// ============================================================
// PRODUCTOS
// ============================================================

export const createProducto = async (req: Request, res: Response) => {
  const data = req.body;

  const existente = await prisma.almacenProducto.findUnique({
    where: { codigo: data.codigo }
  });

  if (existente) {
    throw new AppError(400, 'Ya existe un producto con este código.');
  }

  const producto = await prisma.almacenProducto.create({
    data: {
      codigo: data.codigo,
      nombre: data.nombre,
      descripcion: data.descripcion,
      categoria: data.categoria || 'OTRO',
      unidad: data.unidad || 'PIEZAS',
      stockMinimo: data.stockMinimo || 5,
      stockActual: 0,
      estadoStock: 'NORMAL'
    }
  });

  res.status(201).json({ success: true, data: producto });
};

export const getProductos = async (req: Request, res: Response) => {
  const productos = await prisma.almacenProducto.findMany({
    orderBy: { nombre: 'asc' }
  });
  res.json({ success: true, data: productos });
};

export const getProductoById = async (req: Request, res: Response) => {
  const { id } = req.params;
  const producto = await prisma.almacenProducto.findUnique({
    where: { id: parseInt(id as string, 10) }
  });

  if (!producto) throw new AppError(404, 'Producto no encontrado');

  res.json({ success: true, data: producto });
};

export const updateProducto = async (req: Request, res: Response) => {
  const { id } = req.params;
  const data = req.body;

  const producto = await prisma.almacenProducto.update({
    where: { id: parseInt(id as string, 10) },
    data: {
      nombre: data.nombre,
      descripcion: data.descripcion,
      categoria: data.categoria,
      unidad: data.unidad,
      stockMinimo: data.stockMinimo,
    }
  });

  // Re-evaluar estado de stock
  const estadoStock = producto.stockActual <= 0 ? 'CRITICO' : (producto.stockActual <= producto.stockMinimo ? 'BAJO' : 'NORMAL');
  
  if (producto.estadoStock !== estadoStock) {
    await prisma.almacenProducto.update({
      where: { id: producto.id },
      data: { estadoStock }
    });
  }

  res.json({ success: true, data: producto });
};

// ============================================================
// MOVIMIENTOS (KARDEX / ENTRADAS Y SALIDAS)
// ============================================================

export const registerMovimiento = async (req: Request, res: Response) => {
  const { productoId, tipo, cantidad, proveedor, numeroFactura, areaSolicitante, motivo, observaciones } = req.body;
  const usuarioId = req.usuario!.id;

  const producto = await prisma.almacenProducto.findUnique({ where: { id: productoId } });
  if (!producto) throw new AppError(404, 'Producto no encontrado');

  if (tipo === 'SALIDA' && producto.stockActual < cantidad) {
    throw new AppError(400, `Stock insuficiente. Stock actual: ${producto.stockActual}`);
  }

  // 1. Crear el movimiento
  const movimiento = await prisma.almacenMovimiento.create({
    data: {
      productoId,
      usuarioId,
      tipo,
      cantidad,
      proveedor,
      numeroFactura,
      areaSolicitante,
      motivo,
      observaciones
    }
  });

  // 2. Actualizar el stock del producto
  const nuevoStock = tipo === 'ENTRADA' ? producto.stockActual + cantidad : producto.stockActual - cantidad;
  const estadoStock = nuevoStock <= 0 ? 'CRITICO' : (nuevoStock <= producto.stockMinimo ? 'BAJO' : 'NORMAL');

  await prisma.almacenProducto.update({
    where: { id: productoId },
    data: {
      stockActual: nuevoStock,
      estadoStock
    }
  });

  res.status(201).json({ success: true, data: movimiento });
};

export const getMovimientos = async (req: Request, res: Response) => {
  // Filtros opcionales
  const { productoId, tipo } = req.query;
  
  const whereArgs: any = {};
  if (productoId) whereArgs.productoId = parseInt(productoId as string, 10);
  if (tipo) whereArgs.tipo = tipo as string;

  const movimientos = await prisma.almacenMovimiento.findMany({
    where: whereArgs,
    include: {
      producto: { select: { codigo: true, nombre: true, unidad: true } },
      usuario: { select: { nombre: true, apellidos: true } }
    },
    orderBy: { createdAt: 'desc' },
    take: 100 // Límite por defecto para evitar payloads masivos
  });

  res.json({ success: true, data: movimientos });
};
