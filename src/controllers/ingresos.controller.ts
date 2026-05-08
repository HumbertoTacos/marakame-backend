import { Request, Response } from 'express'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export const registrarPago = async (
  req: Request,
  res: Response
) => {
  try {
    const {
      pacienteId,
      monto,
      metodoPago,
      concepto,
      comprobanteUrl,
    } = req.body

    const pago = await prisma.pagoPaciente.create({
      data: {
        pacienteId,
        usuarioRecibeId: (req as any).user.id,
        monto,
        metodoPago,
        concepto,
        comprobanteUrl,
      },
    })

    res.json({
      ok: true,
      pago,
    })
  } catch (error) {
    console.error(error)

    res.status(500).json({
      error: 'Error registrando pago',
    })
  }
}

export const obtenerPagos = async (
  req: Request,
  res: Response
) => {
  try {
    const pagos = await prisma.pagoPaciente.findMany({
      include: {
        paciente: true,
        usuarioRecibe: true,
      },
      orderBy: {
        fechaPago: 'desc',
      },
    })

    res.json(pagos)
  } catch (error) {
    console.error(error)

    res.status(500).json({
      error: 'Error obteniendo pagos',
    })
  }
}