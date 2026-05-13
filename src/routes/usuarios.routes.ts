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

// Personal clínico — accesible a Jefe Médico y Admin General (filtro por rol en el controller)
router.get(
  '/personal-clinico',
  authenticate,
  authorize(Rol.JEFE_MEDICO, Rol.ADMIN_GENERAL, Rol.DIRECCION),
  getPersonalClinico,
);

// El resto de endpoints solo ADMIN_GENERAL y DIRECCION
router.use(authenticate, authorize(Rol.ADMIN_GENERAL, Rol.DIRECCION));

router.get('/',                     getUsuarios);
router.post('/',                    createUsuario);
router.put('/:id',                  updateUsuario);
router.patch('/:id/toggle-activo',  toggleActivo);
router.patch('/:id/reset-password', resetPassword);

export default router;
