import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { config } from '../config.js';
import { Activity, Contact } from '../db.js';

export const randomToken = (bytes = 24) => crypto.randomBytes(bytes).toString('base64url');

export const slugify = (s) =>
  String(s || 'person')
    .normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'person';

export async function uniqueSlug(name, excludeId) {
  const base = slugify(name);
  let slug = base;
  for (let i = 2; ; i++) {
    const hit = await Contact.findOne({ where: { slug } });
    if (!hit || hit.id === excludeId) return slug;
    slug = `${base}-${i}`;
  }
}

export const escapeHtml = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const storagePath = (...parts) => path.join(config.storageDir, ...parts);

export async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
  return dir;
}

/** Log an event to the activity feed. Never throws. */
export async function log(contactId, actor, event, text, payload = {}) {
  try {
    await Activity.create({ contactId, actor, event, text, payload });
  } catch (e) {
    console.error('activity log failed', e.message);
  }
}

export async function setStatus(contact, status) {
  contact.status = status;
  contact.statusChangedAt = new Date();
  await contact.save();
}

export const hashIp = (ip) => crypto.createHash('sha256').update(String(ip) + config.jwtSecret).digest('hex').slice(0, 16);

export const digitsOnly = (s) => String(s || '').replace(/\D/g, '');

export function truncateWords(s, max) {
  const str = String(s || '').trim().replace(/\s+/g, ' ');
  if (str.length <= max) return str;
  const cut = str.slice(0, max + 1);
  const at = cut.lastIndexOf(' ');
  return (at > max * 0.6 ? cut.slice(0, at) : str.slice(0, max)).replace(/[,;:\-–—\s]+$/, '');
}
