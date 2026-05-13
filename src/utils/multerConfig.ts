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

const justificantesDir = 'uploads/justificantes';
if (!fs.existsSync(justificantesDir)) {
  fs.mkdirSync(justificantesDir, { recursive: true });
}

export const uploadJustificante = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => {
      cb(null, justificantesDir);
    },
    filename: (_req, file, cb) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      const ext = path.extname(file.originalname);
      cb(null, `JUST_${uniqueSuffix}${ext}`);
    }
  }),
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB
  },
  fileFilter: (_req, file, cb) => {
    const filetypes = /pdf|jpg|jpeg|png/;
    const mimetype = filetypes.test(file.mimetype);
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());

    if (mimetype && extname) {
      return cb(null, true);
    }
    cb(new Error('Solo se permiten archivos PDF o Imágenes (JPG/PNG)'));
  }
});

const nominasDir = 'uploads/nominas';
if (!fs.existsSync(nominasDir)) {
  fs.mkdirSync(nominasDir, { recursive: true });
}

export const uploadNominaArchivo = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => {
      cb(null, nominasDir);
    },
    filename: (_req, file, cb) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      const ext = path.extname(file.originalname);
      cb(null, `NOM_${uniqueSuffix}${ext}`);
    }
  }),
  limits: {
    fileSize: 15 * 1024 * 1024 // 15MB
  },
  fileFilter: (_req, file, cb) => {
    const filetypes = /pdf|xlsx|xls|csv/;
    const mimetypes = /pdf|spreadsheet|excel|csv/;
    const validExt = filetypes.test(path.extname(file.originalname).toLowerCase());
    const validMime = mimetypes.test(file.mimetype) || file.mimetype === 'application/pdf';

    if (validExt && validMime) {
      return cb(null, true);
    }
    cb(new Error('Solo se permite el archivo de CONTPAQi en formato PDF, Excel o CSV.'));
  }
});

const expedienteDir = 'uploads/expedientes';
if (!fs.existsSync(expedienteDir)) {
  fs.mkdirSync(expedienteDir, { recursive: true });
}

export const uploadExpediente = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, expedienteDir);
    },
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      const ext = path.extname(file.originalname);
      cb(null, `DOC_${uniqueSuffix}${ext}`);
    }
  }),
  limits: {
    fileSize: 15 * 1024 * 1024 // 15MB
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
