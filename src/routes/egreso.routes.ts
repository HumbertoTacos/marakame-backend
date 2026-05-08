import { Router } from 'express';
import { authenticate, authorize } from '../middlewares/auth';
import { Rol } from '@prisma/client';
import { getDatosEgreso, registrarEgreso, getRegistroEgreso } from '../controllers/egreso.controller';

const router = Router();

router.use(authenticate);

// Solo Área Médica y Admin pueden procesar egresos
router.get('/paciente/:pacienteId/datos',    authorize(Rol.AREA_MEDICA, Rol.ADMIN_GENERAL), getDatosEgreso);
router.post('/paciente/:pacienteId',         authorize(Rol.AREA_MEDICA, Rol.ADMIN_GENERAL), registrarEgreso);
router.get('/paciente/:pacienteId/registro', getRegistroEgreso);

export default router;
