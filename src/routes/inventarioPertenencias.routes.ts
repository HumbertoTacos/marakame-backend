import express from 'express';
import path from 'path';
import multer from 'multer';

import {
    guardarInventario,
    getInventarioByPaciente,
    uploadEvidenciasInventario
} from '../controllers/inventarioPertenencias.controller';

const router = express.Router();

/* ================= MULTER CONFIG ================= */

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/inventario');
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        const ext = path.extname(file.originalname);
        cb(null, `INV-${uniqueSuffix}${ext}`);
    }
    });

    // 🔥 Validación de tipo de archivo
    const fileFilter = (req: any, file: Express.Multer.File, cb: any) => {
    const allowed = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf'];

    if (allowed.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('Tipo de archivo no permitido'), false);
    }
};

const upload = multer({
    storage,
    fileFilter,
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB
    }
});

/* ================= ROUTES ================= */

// Crear / actualizar inventario
router.post('/inventario', guardarInventario);

// Obtener inventario por paciente
router.get('/inventario/:pacienteId', getInventarioByPaciente);

// Subir evidencias
router.post(
    '/inventario/:pacienteId/upload',
    upload.array('files', 10),
    uploadEvidenciasInventario
);

export default router;