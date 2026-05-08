import { Request, Response } from 'express'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export const generarPrenomina = async (
  req: Request,
  res: Response
) => {
  try {
    const {
      periodo,
      fechaInicio,
      fechaFin,
    } = req.body

    const nomina = await prisma.nomina.create({
      data: {
        folio: `NOM-${Date.now()}`,
        periodo,
        fechaInicio: new Date(fechaInicio),
        fechaFin: new Date(fechaFin),
        estado: 'BORRADOR',
      },
    })

    const empleados =
      await prisma.empleado.findMany({
        where: {
          activo: true,
        },
      })

    const prenominas = empleados.map(
      (empleado) => {
        const salarioBase =
          empleado.salarioBase

        const bonos = 0

        const deducciones = 0

        const totalAPagar =
          salarioBase +
          bonos -
          deducciones

        return {
          nominaId: nomina.id,
          empleadoId: empleado.id,
          diasTrabajados: 15,
          salarioBase,
          bonos,
          deducciones,
          totalAPagar,
        }
      }
    )

    await prisma.preNomina.createMany({
      data: prenominas,
    })

    const totalGeneral =
      prenominas.reduce(
        (acc, item) =>
          acc + item.totalAPagar,
        0
      )

    await prisma.nomina.update({
      where: {
        id: nomina.id,
      },
      data: {
        totalGeneral,
      },
    })

    res.json({
      ok: true,
      nominaId: nomina.id,
    })
  } catch (error) {
    console.error(error)

    res.status(500).json({
      error: 'Error generando prenómina',
    })
  }
}