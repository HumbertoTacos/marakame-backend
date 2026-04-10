import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { prisma } from '../utils/prisma';
import { AppError } from '../middlewares/errorHandler';
import { authenticate } from '../middlewares/auth';
import { registrarAuditoria } from '../utils/auditoria';

const router = Router();

const loginSchema = z.object({
  correo: z.string().email('Correo inválido'),
  password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres'),
});

function generarTokens(payload: { id: number; rol: string; nombre: string }) {
  const accessToken = jwt.sign(payload, process.env.JWT_SECRET!, {
    expiresIn: (process.env.JWT_EXPIRES_IN || '8h') as any,
  });
  const refreshToken = jwt.sign(payload, process.env.JWT_REFRESH_SECRET!, {
    expiresIn: (process.env.JWT_REFRESH_EXPIRES_IN || '7d') as any,
  });
  return { accessToken, refreshToken };
}

// POST /api/v1/auth/login
router.post('/login', async (req, res) => {
  const { correo, password } = loginSchema.parse(req.body);

  const usuario = await prisma.usuario.findUnique({ where: { correo } });
  if (!usuario || !usuario.activo) {
    throw new AppError(401, 'Credenciales incorrectas o usuario inactivo.');
  }

  const passwordValido = await bcrypt.compare(password, usuario.passwordHash);
  if (!passwordValido) {
    throw new AppError(401, 'Credenciales incorrectas.');
  }

  // Actualizar último acceso
  await prisma.usuario.update({
    where: { id: usuario.id },
    data: { ultimoAcceso: new Date() },
  });

  await registrarAuditoria(usuario.id, 'LOGIN', 'auth', { correo });

  const { accessToken, refreshToken } = generarTokens({
    id: usuario.id,
    rol: usuario.rol,
    nombre: `${usuario.nombre} ${usuario.apellidos}`,
  });

  res.json({
    success: true,
    data: {
      usuario: {
        id: usuario.id,
        nombre: usuario.nombre,
        apellidos: usuario.apellidos,
        correo: usuario.correo,
        rol: usuario.rol,
      },
      accessToken,
      refreshToken,
    },
  });
});

// POST /api/v1/auth/refresh
router.post('/refresh', async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) throw new AppError(401, 'Refresh token requerido.');

  try {
    const payload = jwt.verify(
      refreshToken,
      process.env.JWT_REFRESH_SECRET!
    ) as { id: number; rol: string; nombre: string };

    const { accessToken, refreshToken: newRefresh } = generarTokens(payload);
    res.json({ success: true, data: { accessToken, refreshToken: newRefresh } });
  } catch {
    throw new AppError(401, 'Refresh token inválido o expirado.');
  }
});

// GET /api/v1/auth/me
router.get('/me', authenticate, async (req, res) => {
  const usuario = await prisma.usuario.findUnique({
    where: { id: req.usuario!.id },
    select: {
      id: true,
      nombre: true,
      apellidos: true,
      correo: true,
      rol: true,
      ultimoAcceso: true,
    },
  });
  res.json({ success: true, data: usuario });
});

// POST /api/v1/auth/logout
router.post('/logout', authenticate, async (req, res) => {
  await registrarAuditoria(req.usuario!.id, 'LOGOUT', 'auth', {});
  res.json({ success: true, message: 'Sesión cerrada correctamente.' });
});

export default router;
