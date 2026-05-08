import { Router } from 'express'
import {
  crearPago,
  obtenerPagos,
  generarCorteCaja,
} from '../controllers/ingresos.controller'

const router = Router()

router.post('/', crearPago)
router.get('/', obtenerPagos)
router.post('/corte-caja/', generarCorteCaja)

export default router