import 'express-async-errors';
import express from 'express';
import cors from 'cors';
import path from 'path';
import dotenv from 'dotenv';

import { logger } from './utils/logger';
import { errorHandler } from './middlewares/errorHandler';
import { requestLogger } from './middlewares/requestLogger';
import { auditMiddleware } from './middlewares/auditMiddleware';

// Rutas
import authRoutes from './routes/auth.routes';
import pacientesRoutes from './routes/pacientes.routes';
import admisionesRoutes from './routes/admisiones.routes';
import expedientesRoutes from './routes/expedientes.routes';
import almacenRoutes from './routes/almacen.routes';
import comprasRoutes from './routes/compras.routes';
import nominasRoutes from './routes/nominas.routes';
import documentosRoutes from './routes/documentos.routes';
import bitacoraRoutes from './routes/bitacora.routes';
import reportesRoutes from './routes/reportes.routes';
import usuariosRoutes from './routes/usuarios.routes';
import dashboardRoutes from './routes/dashboard.routes';
import actividadesRoutes from './routes/actividades.routes';
import clinicaRoutes from './routes/clinica.routes';
import inventarioRoutes from './routes/inventario.routes';
import egresoRoutes from './routes/egreso.routes';
import contraReciboRoutes from './routes/contraRecibo.routes';
import notificacionesRoutes from './routes/notificaciones.routes';
import pagosRoutes from './routes/pagos.routes';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// ── Middlewares globales ────────────────────────────────────
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(requestLogger);

// Archivos estáticos (documentos subidos)
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

// ── Rutas de la API ─────────────────────────────────────────
const API = '/api/v1';

// Auditoría automática — intercepta todos los POST/PUT/PATCH/DELETE
app.use(API, auditMiddleware);

app.use(`${API}/auth`,       authRoutes);
app.use(`${API}/usuarios`,   usuariosRoutes);
app.use(`${API}/dashboard`,  dashboardRoutes);
app.use(`${API}/pacientes`,  pacientesRoutes);
app.use(`${API}/admisiones`, admisionesRoutes);
app.use(`${API}/expedientes`, expedientesRoutes);
app.use(`${API}/almacen`,    almacenRoutes);
app.use(`${API}/contra-recibos`, contraReciboRoutes);
app.use(`${API}/compras`,    comprasRoutes);
app.use(`${API}/nominas`,    nominasRoutes);
app.use(`${API}/documentos`, documentosRoutes);
app.use(`${API}/bitacora`,   bitacoraRoutes);
app.use(`${API}/reportes`,       reportesRoutes);
app.use(`${API}/actividades`,    actividadesRoutes);
app.use(`${API}/clinica`,        clinicaRoutes);
app.use(`${API}/inventario`,     inventarioRoutes);
app.use(`${API}/egreso`,         egresoRoutes);
app.use(`${API}/notificaciones`, notificacionesRoutes);
app.use(`${API}/pagos`,          pagosRoutes);

// Health check (indicador de red local)
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    sistema: 'Marakame',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    red: 'intranet',
  });
});

// ── Manejo de errores ───────────────────────────────────────
app.use(errorHandler);

// ── Iniciar servidor ────────────────────────────────────────
app.listen(PORT, () => {
  logger.info(`✅ Servidor Marakame corriendo en http://localhost:${PORT}`);
  logger.info(`📡 Red: Intranet local`);
  logger.info(`🗄️  API: http://localhost:${PORT}${API}`);
});

export default app;
