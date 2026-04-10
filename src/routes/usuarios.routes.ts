import { Router } from 'express';
import { authenticate } from '../middlewares/auth';

const router = Router();

router.get('/', authenticate, (req, res) => {
  res.json({ message: 'Ruta en construcción' });
});

export default router;
