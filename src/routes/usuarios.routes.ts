import { Router } from 'express';
import { authenticate } from '../middlewares/auth';
import { prisma } from '../utils/prisma';
import { Rol } from '@prisma/client';

const router = Router();

router.get('/', authenticate, async (req, res) => {
  const { roles } = req.query;

  const where: Record<string, unknown> = { deletedAt: null };

  if (roles && typeof roles === 'string') {
    const rolesArr = roles.split(',').filter((r): r is Rol =>
      Object.values(Rol).includes(r as Rol)
    );
    if (rolesArr.length > 0) {
      where.rol = { in: rolesArr };
    }
  }

  const usuarios = await prisma.usuario.findMany({
    where,
    select: {
      id: true,
      nombre: true,
      apellidos: true,
      correo: true,
      rol: true,
      activo: true,
      ultimoAcceso: true,
    },
    orderBy: [{ rol: 'asc' }, { nombre: 'asc' }],
  });

  res.json({ success: true, data: usuarios });
});

export default router;
