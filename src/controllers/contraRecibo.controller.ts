import { Request, Response } from 'express';
import { prisma } from '../utils/prisma';
import { AppError } from '../middlewares/errorHandler';
import PDFDocument from 'pdfkit';
import path from 'path';

// ============================================================
// CREAR CONTRA RECIBO
// ============================================================

export const createContraRecibo = async (req: Request, res: Response) => {
    const {
        movimientoId,
        fechaPagoProgramado
    } = req.body;

    const usuarioId = req.usuario!.id;

    // ============================================================
    // VALIDAR MOVIMIENTO
    // ============================================================

    const movimiento = await prisma.almacenMovimiento.findUnique({
        where: { id: movimientoId },
        include: {
        producto: true
        }
    });

    if (!movimiento) {
        throw new AppError(404, 'Movimiento no encontrado');
    }

    if (movimiento.tipo !== 'ENTRADA') {
        throw new AppError(400, 'Solo las entradas pueden generar contra-recibo');
    }

    if (movimiento.estadoRecepcion !== 'ACEPTADO') {
        throw new AppError(400, 'La mercancía debe estar aceptada');
    }

    if (!movimiento.numeroFactura) {
        throw new AppError(400, 'El movimiento no tiene número de factura');
    }

    if (!movimiento.proveedor) {
        throw new AppError(400, 'El movimiento no tiene proveedor');
    }

    if (!movimiento.importeFactura) {
        throw new AppError(400, 'El movimiento no tiene importe');
    }

    // ============================================================
    // VALIDAR QUE NO EXISTA YA
    // ============================================================

    const existente = await prisma.contraRecibo.findUnique({
        where: {
        movimientoId
        }
    });

    if (existente) {
        throw new AppError(400, 'Este movimiento ya tiene contra-recibo');
    }

    // ============================================================
    // GENERAR FOLIO
    // ============================================================

    const ultimo = await prisma.contraRecibo.findFirst({
        orderBy: {
        id: 'desc'
        }
    });

    const folio = `CR-${String((ultimo?.id || 0) + 1).padStart(5, '0')}`;

    // ============================================================
    // CREAR CONTRA RECIBO
    // ============================================================

    const contraRecibo = await prisma.contraRecibo.create({
        data: {
        folio,
        movimientoId,

        proveedor: movimiento.proveedor,
        numeroFactura: movimiento.numeroFactura,
        importe: movimiento.importeFactura,

        fechaPagoProgramado: fechaPagoProgramado
            ? new Date(fechaPagoProgramado)
            : null,

        recibidoPorId: usuarioId,

        estado: 'PENDIENTE'
        }
    });

    res.status(201).json({
        success: true,
        data: contraRecibo
    });
    };

    // ============================================================
    // OBTENER TODOS
    // ============================================================

    export const getContraRecibos = async (_req: Request, res: Response) => {
    const contraRecibos = await prisma.contraRecibo.findMany({
        include: {
        movimiento: {
            include: {
            producto: true
            }
        },
        recibidoPor: {
            select: {
            id: true,
            nombre: true,
            apellidos: true
            }
        }
        },
        orderBy: {
        createdAt: 'desc'
        }
    });

    res.json({
        success: true,
        data: contraRecibos
    });
    };

    // ============================================================
    // OBTENER UNO
    // ============================================================

    export const getContraReciboById = async (req: Request, res: Response) => {
    const { id } = req.params;

    const contraRecibo = await prisma.contraRecibo.findUnique({
        where: {
        id: parseInt(id as string, 10)
        },
        include: {
        movimiento: {
            include: {
            producto: true
            }
        },
        recibidoPor: {
            select: {
            nombre: true,
            apellidos: true
            }
        }
        }
    });

    if (!contraRecibo) {
        throw new AppError(404, 'Contra-recibo no encontrado');
    }

    res.json({
        success: true,
        data: contraRecibo
    });
    };

    // ============================================================
    // CAMBIAR ESTADO
    // ============================================================

    export const updateEstadoContraRecibo = async (req: Request, res: Response) => {
    const { id } = req.params;
    const { estado } = req.body;

    const permitidos = ['PENDIENTE', 'PAGADO', 'CANCELADO'];

    if (!permitidos.includes(estado)) {
        throw new AppError(400, 'Estado inválido');
    }

    const contraRecibo = await prisma.contraRecibo.update({
        where: {
        id: parseInt(id as string, 10)
        },
        data: {
        estado
        }
    });

    res.json({
        success: true,
        data: contraRecibo
    });
    };

    // ============================================================
    // GENERAR PDF
    // ============================================================

    export const generateContraReciboPDF = async (req: Request, res: Response) => {
    const { id } = req.params;

    const contraRecibo = await prisma.contraRecibo.findUnique({
        where: {
        id: parseInt(id as string, 10)
        },
        include: {
        movimiento: {
            include: {
            producto: true
            }
        },
        recibidoPor: true
        }
    });

    if (!contraRecibo) {
        throw new AppError(404, 'Contra-recibo no encontrado');
    }

    // ============================================================
    // CONFIG PDF
    // ============================================================

    const doc = new PDFDocument({
        size: 'LETTER',
        margin: 50
    });

    const fileName = `contra-recibo-${contraRecibo.folio}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
        'Content-Disposition',
        `inline; filename="${fileName}"`
    );

    doc.pipe(res);

    // ============================================================
    // HEADER
    // ============================================================

    doc
        .fontSize(18)
        .text('INSTITUTO MARAKAME', {
        align: 'center'
        });

    doc
        .fontSize(10)
        .text('RFC: MAR000123ABC', {
        align: 'center'
        });

    doc.moveDown(2);

    // ============================================================
    // TITULO
    // ============================================================

    doc
        .fontSize(20)
        .text('CONTRA RECIBO', {
        align: 'left'
        });

    doc.moveDown();

    // ============================================================
    // FOLIO
    // ============================================================

    doc
        .fontSize(14)
        .text(`Folio: ${contraRecibo.folio}`, {
        align: 'right'
        });

    doc.moveDown(2);

    // ============================================================
    // DATOS
    // ============================================================

    doc.fontSize(12);

    doc.text(`Proveedor: ${contraRecibo.proveedor}`);
    doc.moveDown();

    doc.text(`Factura: ${contraRecibo.numeroFactura}`);
    doc.moveDown();

    doc.text(`Producto: ${contraRecibo.movimiento.producto.nombre}`);
    doc.moveDown();

    doc.text(`Cantidad: ${contraRecibo.movimiento.cantidad}`);
    doc.moveDown();

    doc.text(`Importe: $${contraRecibo.importe.toFixed(2)}`);
    doc.moveDown();

    doc.text(
        `Fecha recepción: ${contraRecibo.fechaRecepcion.toLocaleDateString()}`
    );

    doc.moveDown();

    if (contraRecibo.fechaPagoProgramado) {
        doc.text(
        `Fecha pago programado: ${contraRecibo.fechaPagoProgramado.toLocaleDateString()}`
        );
    }

    doc.moveDown(4);

    // ============================================================
    // TEXTO LEGAL
    // ============================================================

    doc
        .fontSize(9)
        .text(
        'Este contra-recibo se emite exclusivamente para efectos de control interno.',
        {
            align: 'justify'
        }
        );

    doc.moveDown(5);

    // ============================================================
    // FIRMA
    // ============================================================

    doc.text('__________________________________', {
        align: 'right'
    });

    doc.text(
        `${contraRecibo.recibidoPor.nombre} ${contraRecibo.recibidoPor.apellidos}`,
        {
        align: 'right'
        }
    );

    doc.text('Nombre y firma de quien recibe', {
        align: 'right'
    });

    // ============================================================
    // FINALIZAR
    // ============================================================

    doc.end();
};