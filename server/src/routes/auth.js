import { Router } from 'express';
import jwt from 'jsonwebtoken';
import crypto from 'node:crypto';
import { config } from '../config.js';
import { requireAuth } from '../middleware.js';

const r = Router();

const same = (a, b) => {
  const x = Buffer.from(String(a)); const y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
};

r.post('/login', (req, res) => {
  const { email = '', password = '' } = req.body || {};
  if (!config.admin.email || !config.admin.password) {
    return res.status(500).json({ error: 'Set ADMIN_EMAIL and ADMIN_PASSWORD in server/.env' });
  }
  if (!same(email.toLowerCase().trim(), config.admin.email) || !same(password, config.admin.password)) {
    return res.status(401).json({ error: 'Wrong email or password' });
  }
  const token = jwt.sign({ email: config.admin.email }, config.jwtSecret, { expiresIn: '30d' });
  res.json({ token, user: { email: config.admin.email, name: config.credit.name } });
});

r.get('/me', requireAuth, (req, res) => res.json({ user: { email: req.user.email, name: config.credit.name } }));

export default r;
