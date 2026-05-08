import { Request, Response } from 'express'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export const crearProveedor = async (req: Request, res: Response) => {
  try {
    const proveedor = await prisma.proveedor.create({
      data: req.body,
    })

    res.status(201).json(proveedor)
  } catch (error) {
    res.status(500).json({ error: 'Error al crear proveedor' })
  }
}

export const programarTransferencia = async (
  req: Request,
  res: Response
) => {
  try {
    const transferencia = await prisma.transferenciaBancaria.create({
      data: {
        ...req.body,
        estado: 'PROGRAMADA',
      },
    })

    res.status(201).json(transferencia)
  } catch (error) {
    res.status(500).json({ error: 'Error al programar transferencia' })
  }
}

export const ejecutarTransferencia = async (
  req: Request,
  res: Response
) => {
  try {
    const transferencia = await prisma.transferenciaBancaria.update({
      where: {
        id: Number(req.params.id),
      },
      data: {
        estado: 'EJECUTADA',
        fechaEjecucion: new Date(),
      },
    })

    res.json(transferencia)
  } catch (error) {
    res.status(500).json({ error: 'Error al ejecutar transferencia' })
  }
}