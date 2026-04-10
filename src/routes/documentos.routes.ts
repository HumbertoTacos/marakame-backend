import { Router, Request, Response } from 'express';
import { authenticate } from '../middlewares/auth';
import { upload } from '../middlewares/upload';
import { prisma } from '../utils/prisma';
import fs from 'fs';
import path from 'path';

const router = Router();

router.use(authenticate);

// Subir un documento
router.post('/upload', upload.single('archivo'), async (req: Request, res: Response) => {
  if (!req.file) {
    return res.status(400).json({ success: false, error: 'No se subió ningún archivo' });
  }

  const {
    tipoDocumento,
    descripcion,
    pacienteId,
    primerContactoId,
    valoracionId,
    estudioId
  } = req.body;

  const documento = await prisma.documento.create({
    data: {
      usuarioId: req.usuario!.id,
      nombre: req.file.originalname,
      rutaArchivo: req.file.path,
      mimeType: req.file.mimetype,
      tamanoBytes: req.file.size,
      tipoDocumento: tipoDocumento || 'OTRO',
      descripcion,
      pacienteId: pacienteId ? parseInt(pacienteId, 10) : undefined,
      primerContactoId: primerContactoId ? parseInt(primerContactoId, 10) : undefined,
      valoracionId: valoracionId ? parseInt(valoracionId, 10) : undefined,
      estudioId: estudioId ? parseInt(estudioId, 10) : undefined,
    }
  });

  res.status(201).json({ success: true, data: documento });
});

// Obtener documentos de un paciente
router.get('/paciente/:pacienteId', async (req: Request, res: Response) => {
  const { pacienteId } = req.params;
  const documentos = await prisma.documento.findMany({
    where: { pacienteId: parseInt(pacienteId as string, 10) },
    orderBy: { createdAt: 'desc' }
  });

  res.json({ success: true, data: documentos });
});

// Eliminar un documento
router.delete('/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  const documento = await prisma.documento.findUnique({
    where: { id: parseInt(id as string, 10) }
  });

  if (!documento) {
    return res.status(404).json({ success: false, error: 'Documento no encontrado' });
  }

  // Eliminar el archivo físico
  try {
    if (fs.existsSync(documento.rutaArchivo)) {
      fs.unlinkSync(documento.rutaArchivo);
    }
  } catch (error) {
    console.error('Error al borrar el archivo físico', error);
  }

  await prisma.documento.delete({
    where: { id: parseInt(id as string, 10) }
  });

  res.json({ success: true, message: 'Documento eliminado correctamente' });
});

export default router;
