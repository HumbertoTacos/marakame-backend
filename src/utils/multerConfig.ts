import multer from 'multer';
import path from 'path';
import fs from 'fs';

// Asegurar que las carpetas existen
const uploadDir = 'uploads/valoraciones';
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // VALORACION_PACIENTE_[ID]_[DDMMYYYY].pdf (Se completará en el controlador si el ID está disponible, 
    // pero Multer necesita un nombre ahora. Usaremos un timestamp y el nombre original para evitar colisiones)
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, `VAL_RAW_${uniqueSuffix}${ext}`);
  }
});

export const uploadValoracion = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB
  },
  fileFilter: (req, file, cb) => {
    const filetypes = /pdf|jpg|jpeg|png/;
    const mimetype = filetypes.test(file.mimetype);
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());

    if (mimetype && extname) {
      return cb(null, true);
    }
    cb(new Error('Solo se permiten archivos PDF o Imágenes (JPG/PNG)'));
  }
});
