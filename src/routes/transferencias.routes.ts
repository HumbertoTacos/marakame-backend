import { Router } from 'express'
import {
  crearProveedor,
  programarTransferencia,
  ejecutarTransferencia,
} from '../controllers/transferencias.controller'

const router = Router()

router.post('/proveedores', crearProveedor)
router.post('/', programarTransferencia)
router.put('/:id/ejecutar', ejecutarTransferencia)

export default router