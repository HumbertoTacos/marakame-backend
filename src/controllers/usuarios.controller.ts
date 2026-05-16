import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../utils/prisma';
import { Rol } from '@prisma/client';
import { z } from 'zod';

const createSchema = z.object({
  nombre:    z.string().min(2),
  apellidos: z.string().min(2),
  correo:    z.string().email(),
  rol:       z.nativeEnum(Rol),
  esJefe:    z.boolean().optional().default(false),
  password:  z.string().min(6),
});

const updateSchema = z.object({
  nombre:    z.string().min(2).optional(),
  apellidos: z.string().min(2).optional(),
  correo:    z.string().email().optional(),
  rol:       z.nativeEnum(Rol).optional(),
  esJefe:    z.boolean().optional(),
});

const ROLES_CLINICOS_JEFE  = [Rol.AREA_MEDICA, Rol.ENFERMERIA, Rol.NUTRICION, Rol.PSICOLOGIA];
const ROLES_CLINICOS_ADMIN = [Rol.AREA_MEDICA, Rol.JEFE_MEDICO, Rol.ENFERMERIA, Rol.NUTRICION, Rol.PSICOLOGIA];

export const getPersonalClinico = async (req: Request, res: Response) => {
  const rolSolicitante = req.usuario!.rol;
  const rolesPermitidos = rolSolicitante === Rol.JEFE_MEDICO
    ? ROLES_CLINICOS_JEFE
    : ROLES_CLINICOS_ADMIN;

  const personal = await prisma.usuario.findMany({
    where: { deletedAt: null, rol: { in: rolesPermitidos } },
    select: {
      id: true, nombre: true, apellidos: true,
      correo: true, rol: true, esJefe: true, activo: true, ultimoAcceso: true,
    },
    orderBy: { nombre: 'asc' },
  });
  res.json({ success: true, data: personal });
};

export const getUsuarios = async (_req: Request, res: Response) => {
  const usuarios = await prisma.usuario.findMany({
    where: { deletedAt: null },
    select: {
      id: true, nombre: true, apellidos: true,
      correo: true, rol: true, esJefe: true, activo: true,
      ultimoAcceso: true, createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ success: true, data: usuarios });
};

export const createUsuario = async (req: Request, res: Response) => {
  if (req.usuario?.rol !== 'ADMIN_GENERAL' && req.usuario?.rol !== 'DIRECCION') {
    return res.status(403).json({ success: false, message: 'No tienes permisos para crear usuarios.' });
  }
  const body = createSchema.parse(req.body);

  const existe = await prisma.usuario.findUnique({ where: { correo: body.correo } });
  if (existe) {
    res.status(409).json({ success: false, message: 'Ya existe un usuario con ese correo.' });
    return;
  }

  const passwordHash = await bcrypt.hash(body.password, 12);
  const usuario = await prisma.usuario.create({
    data: { nombre: body.nombre, apellidos: body.apellidos, correo: body.correo, rol: body.rol, esJefe: body.esJefe, passwordHash },
    select: { id: true, nombre: true, apellidos: true, correo: true, rol: true, esJefe: true, activo: true, createdAt: true },
  });
  res.status(201).json({ success: true, data: usuario });
};

export const updateUsuario = async (req: Request, res: Response) => {
  if (req.usuario?.rol !== 'ADMIN_GENERAL' && req.usuario?.rol !== 'DIRECCION') {
    return res.status(403).json({ success: false, message: 'No tienes permisos para editar usuarios.' });
  }
  const id = parseInt(req.params.id as string, 10);
  const body = updateSchema.parse(req.body);

  if (body.correo) {
    const duplicado = await prisma.usuario.findFirst({ where: { correo: body.correo, id: { not: id } } });
    if (duplicado) {
      res.status(409).json({ success: false, message: 'Ese correo ya está en uso por otro usuario.' });
      return;
    }
  }

  const usuario = await prisma.usuario.update({
    where: { id },
    data: body,
    select: { id: true, nombre: true, apellidos: true, correo: true, rol: true, esJefe: true, activo: true },
  });
  res.json({ success: true, data: usuario });
};

export const toggleActivo = async (req: Request, res: Response) => {
  if (req.usuario?.rol !== 'ADMIN_GENERAL' && req.usuario?.rol !== 'DIRECCION') {
    return res.status(403).json({ success: false, message: 'No tienes permisos para activar/desactivar usuarios.' });
  }
  const id = parseInt(req.params.id as string, 10);

  // Evitar que el admin se desactive a sí mismo
  if (req.usuario?.id === id) {
    res.status(400).json({ success: false, message: 'No puedes desactivar tu propia cuenta.' });
    return;
  }

  const actual = await prisma.usuario.findUniqueOrThrow({ where: { id }, select: { activo: true } });
  const usuario = await prisma.usuario.update({
    where: { id },
    data: { activo: !actual.activo },
    select: { id: true, nombre: true, activo: true },
  });
  res.json({ success: true, data: usuario });
};

export const resetPassword = async (req: Request, res: Response) => {
  if (req.usuario?.rol !== 'ADMIN_GENERAL' && req.usuario?.rol !== 'DIRECCION') {
    return res.status(403).json({ success: false, message: 'No tienes permisos para resetear contraseñas.' });
  }
  const id = parseInt(req.params.id as string, 10);
  const { password } = z.object({ password: z.string().min(6) }).parse(req.body);

  const passwordHash = await bcrypt.hash(password, 12);
  await prisma.usuario.update({ where: { id }, data: { passwordHash } });
  res.json({ success: true, message: 'Contraseña actualizada correctamente.' });
};
