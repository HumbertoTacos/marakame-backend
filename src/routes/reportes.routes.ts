import { Router } from 'express';
import { authenticate } from '../middlewares/auth';
import { 
  exportarPacientesPDF, 
  exportarAlmacenExcel, 
  generarDocumentoFirmaPDF 
} from '../controllers/reportes.controller';

const router = Router();

router.use(authenticate);

router.get('/pacientes/pdf', exportarPacientesPDF);
router.get('/almacen/excel', exportarAlmacenExcel);
router.get('/documentos/:docId/firma-pdf', generarDocumentoFirmaPDF);

export default router;
