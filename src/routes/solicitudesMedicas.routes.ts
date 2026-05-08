import { Router } from 'express';
import { authenticate, authorize } from '../middlewares/auth';
import { Rol } from '@prisma/client';
import {
  crearSolicitud,
  getSolicitudes,
  atenderSolicitud,
} from '../controllers/solicitudesMedicas.controller';

const router = Router();

router.use(authenticate);

// Cualquier clínico puede enviar solicitudes
router.post(
  '/',
  authorize(Rol.AREA_MEDICA, Rol.JEFE_MEDICO, Rol.ENFERMERIA, Rol.NUTRICION, Rol.PSICOLOGIA, Rol.ADMIN_GENERAL),
  crearSolicitud,
);

// Solo jefatura puede ver el buzón y marcar como atendida
router.get(
  '/',
  authorize(Rol.JEFE_MEDICO, Rol.ADMIN_GENERAL),
  getSolicitudes,
);

router.patch(
  '/:id/atender',
  authorize(Rol.JEFE_MEDICO, Rol.ADMIN_GENERAL),
  atenderSolicitud,
);

export default router;
