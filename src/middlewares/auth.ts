import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AppError } from './errorHandler';
import { Rol } from '@prisma/client';

export interface JwtPayload {
  id: number;
  rol: Rol;
  nombre: string;
}

declare global {
  namespace Express {
    interface Request {
      usuario?: JwtPayload;
    }
  }
}

export function authenticate(req: Request, _res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    throw new AppError(401, 'No autenticado. Se requiere token de acceso.');
  }

  const token = authHeader.split(' ')[1];
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET!) as JwtPayload;
    req.usuario = payload;
    next();
  } catch {
    throw new AppError(401, 'Token inválido o expirado.');
  }
}

export function authorize(...roles: Rol[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.usuario) throw new AppError(401, 'No autenticado.');
    if (!roles.includes(req.usuario.rol)) {
      throw new AppError(403, 'No tienes permisos para realizar esta acción.');
    }
    next();
  };
}
