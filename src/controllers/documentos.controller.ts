import { Request, Response } from 'express';
import { prisma } from '../utils/prisma';
import fs from 'fs';
import path from 'path';

export const getDocumentosExpediente = async (req: Request, res: Response) => {
  const { pacienteId } = req.params;

  const documentos = await prisma.documentoExpediente.findMany({
    where: { pacienteId: parseInt(pacienteId as string, 10) },
    orderBy: [{ ubicacion: 'asc' }, { nombre: 'asc' }]
  });

  res.json({ success: true, data: documentos });
};

export const uploadDocumentoExpediente = async (req: Request, res: Response) => {
  const { id } = req.params;

  if (!req.file) {
    return res.status(400).json({ success: false, error: 'No se subió ningún archivo' });
  }

  const docId = parseInt(id as string, 10);
  const documento = await prisma.documentoExpediente.findUnique({ where: { id: docId } });

  if (!documento) {
    if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    return res.status(404).json({ success: false, error: 'Documento del expediente no encontrado' });
  }

  if (documento.archivoUrl) {
    const oldPath = path.join(__dirname, '../../', documento.archivoUrl);
    if (fs.existsSync(oldPath)) {
      try { fs.unlinkSync(oldPath); } catch (e) { console.error('Error al borrar archivo anterior', e); }
    }
  }

  const updated = await prisma.documentoExpediente.update({
    where: { id: docId },
    data: {
      archivoUrl: req.file.path.replace(/\\/g, '/'),
      estado: 'COMPLETADO'
    }
  });

  res.json({ success: true, data: updated });
};
