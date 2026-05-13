import { Router } from 'express';
import { authenticate, authorize } from '../middlewares/auth';
import { Rol } from '@prisma/client';
import {
  getUsuarios,
  getPersonalClinico,
  createUsuario,
  updateUsuario,
  toggleActivo,
  resetPassword,
} from '../controllers/usuarios.controller';

const router = Router();

// Personal clínico — Jefe Médico, Jefe Clínico y Admin (filtro por rol en el controller)
router.get(
  '/personal-clinico',
  authenticate,
  authorize(Rol.JEFE_MEDICO, Rol.JEFE_CLINICO, Rol.ADMIN_GENERAL),
  getPersonalClinico,
);

// El resto de endpoints solo ADMIN_GENERAL
router.use(authenticate, authorize(Rol.ADMIN_GENERAL));

router.get('/', getUsuarios);
router.post('/', createUsuario);
router.put('/:id', updateUsuario);
router.patch('/:id/toggle-activo', toggleActivo);
router.patch('/:id/reset-password', resetPassword);

export default router;
