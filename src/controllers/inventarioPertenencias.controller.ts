import { Request, Response } from 'express';
import { prisma } from '../utils/prisma';
import { AppError } from '../middlewares/errorHandler';

/**
 * Crear o actualizar inventario de pertenencias
 * POST /api/v1/admisiones/inventario
 */
export const guardarInventario = async (req: Request, res: Response) => {
    const { pacienteId, articulos, validado, firmaRecibido } = req.body;

    if (!pacienteId || isNaN(Number(pacienteId))) {
        throw new AppError(400, 'El pacienteId es obligatorio y debe ser válido');
    }

    if (!articulos || typeof articulos !== 'object') {
        throw new AppError(400, 'El campo articulos es obligatorio');
    }

    const inventario = await prisma.inventarioPertenencias.upsert({
        where: { pacienteId: Number(pacienteId) },
        create: {
        pacienteId: Number(pacienteId),
        articulos,
        validado: validado ?? false,
        firmaRecibido: firmaRecibido ?? false
        },
        update: {
        articulos,
        validado: validado ?? false,
        firmaRecibido: firmaRecibido ?? false
        }
    });

    // 🔥 Actualizar estado del paciente
    const paciente = await prisma.paciente.findUnique({
        where: { id: Number(pacienteId) }
    });

    if (paciente && paciente.estado !== 'PENDIENTE_INGRESO') {
        await prisma.paciente.update({
        where: { id: Number(pacienteId) },
        data: { estado: 'PENDIENTE_INGRESO' }
        });
    }

    res.json({
        success: true,
        data: inventario
    });
    };

    /**
     * Obtener inventario por paciente
     * GET /api/v1/admisiones/inventario/:pacienteId
     */
    export const getInventarioByPaciente = async (req: Request, res: Response) => {
    const { pacienteId } = req.params;

    if (!pacienteId || isNaN(Number(pacienteId))) {
        throw new AppError(400, 'pacienteId inválido');
    }

    const inventario = await prisma.inventarioPertenencias.findUnique({
        where: { pacienteId: Number(pacienteId) },
        include: {
        documentos: true // 🔥 para traer evidencias
        }
    });

    res.json({
        success: true,
        data: inventario
    });
    };

    /**
     * Subir evidencias (imagenes o PDF)
     * POST /api/v1/admisiones/inventario/:pacienteId/upload
     */
    export const uploadEvidenciasInventario = async (req: Request, res: Response) => {
    const { pacienteId } = req.params;

    if (!pacienteId || isNaN(Number(pacienteId))) {
        throw new AppError(400, 'pacienteId inválido');
    }

    const files = req.files as Express.Multer.File[];

    if (!files || files.length === 0) {
        throw new AppError(400, 'Debe subir al menos un archivo');
    }

    const inventario = await prisma.inventarioPertenencias.findUnique({
        where: { pacienteId: Number(pacienteId) }
    });

    if (!inventario) {
        throw new AppError(404, 'Inventario no encontrado');
    }

    if (!inventario.validado) {
        throw new AppError(400, 'Debe validar el inventario antes de subir evidencias');
    }

    // 🔥 Guardar archivos
    const documentos = await Promise.all(
        files.map(file =>
        prisma.documento.create({
            data: {
            usuarioId: (req as any).user?.id || 1,
            nombre: file.originalname,
            rutaArchivo: `/uploads/inventario/${file.filename}`,
            mimeType: file.mimetype,
            tamanoBytes: file.size,
            inventarioId: inventario.id
            }
        })
        )
    );

    res.json({
        success: true,
        data: documentos,
        message: 'Archivos subidos correctamente'
    });
};