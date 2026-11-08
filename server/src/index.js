import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { config } from './config.js';
import { initDb } from './db.js';
import { ensureDatabase } from './scripts/db-create.js';
import { requireAuth, errorHandler } from './middleware.js';
import authRoutes from './routes/auth.js';
import contactRoutes from './routes/contacts.js';
import siteRoutes from './routes/sites.js';
import messageRoutes from './routes/messages.js';
import leadRoutes from './routes/leads.js';
import dashboardRoutes from './routes/dashboard.js';
import { previewRouter, consentRouter } from './routes/public.js';
import { startRetentionJob } from './services/retention.js';

const app = express();
app.set('trust proxy', 1);
app.use(helmet({
  contentSecurityPolicy: false,        // preview pages carry their own inline script and Google Fonts
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  frameguard: false,                   // the studio shows previews in an iframe
}));
app.use(cors({ origin: (origin, cb) => cb(null, !origin || config.corsOrigins.includes(origin) || config.corsOrigins.includes('*')) }));
app.use(express.json({ limit: '2mb' }));
app.use(morgan(config.env === 'production' ? 'combined' : 'dev'));

app.get('/api/health', (_req, res) => res.json({ ok: true }));

// Public: preview pages and the consent answer (no login)
app.use('/p', previewRouter);
app.use('/api/public', cors({ origin: true }), consentRouter);

// Private API
app.use('/api/auth', authRoutes);
app.use('/api/contacts', requireAuth, contactRoutes);
app.use('/api/leads', requireAuth, leadRoutes);
app.use('/api', requireAuth, siteRoutes);
app.use('/api', requireAuth, messageRoutes);
app.use('/api', requireAuth, dashboardRoutes);

// In production, serve the built web app from ../web/dist
const webDist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'web', 'dist');
if (fs.existsSync(webDist)) {
  app.use(express.static(webDist));
  app.get(/^\/(?!api\/|p\/).*/, (_req, res) => res.sendFile(path.join(webDist, 'index.html')));
}

app.use('/api', (_req, res) => res.status(404).json({ error: 'Not found' }));
app.use(errorHandler);

async function start() {
  await ensureDatabase();
  await initDb();
  startRetentionJob();
  app.listen(config.port, () => {
    console.log(`Growth Engine API on http://localhost:${config.port}`);
    console.log(`Preview links use ${config.publicBaseUrl}`);
  });
}

start().catch((e) => {
  console.error('Failed to start:', e.message);
  process.exit(1);
});
