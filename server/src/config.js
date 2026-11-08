import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

const list = (v, d = '') => (v ?? d).split(',').map((s) => s.trim()).filter(Boolean);

export const config = {
  port: Number(process.env.PORT || 4000),
  env: process.env.NODE_ENV || 'development',
  corsOrigins: list(process.env.CORS_ORIGINS, 'http://localhost:5173'),
  publicBaseUrl: (process.env.PUBLIC_BASE_URL || 'http://localhost:4000').replace(/\/$/, ''),

  db: {
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 5432),
    name: process.env.DB_NAME || 'growth_engine',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '',
  },

  admin: {
    email: (process.env.ADMIN_EMAIL || '').toLowerCase(),
    password: process.env.ADMIN_PASSWORD || '',
  },
  jwtSecret: process.env.JWT_SECRET || 'dev-only-secret',

  ai: {
    key: process.env.ANTHROPIC_API_KEY || '',
    model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-5-5',
  },

  github: {
    token: process.env.GITHUB_TOKEN || '',
    owner: process.env.GITHUB_OWNER || '',
    ownerType: (process.env.GITHUB_OWNER_TYPE || 'org').toLowerCase(),
  },

  credit: {
    name: process.env.CREDIT_NAME || 'Anwar',
    url: process.env.CREDIT_URL || '#',
    line: process.env.CREDIT_LINE || 'Need a website, web app or mobile app?',
  },

  declineRetentionDays: Number(process.env.DECLINE_RETENTION_DAYS || 30),

  storageDir: path.resolve(here, '..', 'storage'),
};
