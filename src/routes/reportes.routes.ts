import { Router } from 'express';
import { authenticate } from '../middlewares/auth';
import { exportarPacientesPDF, exportarAlmacenExcel } from '../controllers/reportes.controller';

const router = Router();

router.use(authenticate);

router.get('/pacientes/pdf', exportarPacientesPDF);
router.get('/almacen/excel', exportarAlmacenExcel);

export default router;
