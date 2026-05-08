import { Router } from 'express';
import { authenticate, authorize } from '../middlewares/auth';
import { Rol } from '@prisma/client';
import {
  getUsuarios,
  createUsuario,
  updateUsuario,
  toggleActivo,
  resetPassword,
} from '../controllers/usuarios.controller';

const router = Router();

router.use(authenticate, authorize(Rol.ADMIN_GENERAL));

router.get('/',                     getUsuarios);
router.post('/',                    createUsuario);
router.put('/:id',                  updateUsuario);
router.patch('/:id/toggle-activo',  toggleActivo);
router.patch('/:id/reset-password', resetPassword);

export default router;
