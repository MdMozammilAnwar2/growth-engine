import { Router } from 'express';
import fs from 'node:fs/promises';
import path from 'node:path';
import { Op } from 'sequelize';
import {
  Contact, SourceFile, Profile, Site, Message, Deployment, Activity, Lead, STATUSES,
} from '../db.js';
import { ah, upload, extOf } from '../middleware.js';
import { ensureDir, log, setStatus, storagePath, uniqueSlug, randomToken } from '../services/util.js';
import { normalizeProfile } from '../services/extractor.js';
import {
  runExtraction, buildSite, latestProfile, latestSite, previewUrlFor, purgeContactData,
} from '../services/pipeline.js';

const r = Router();

async function moveIntoContact(contactId, file) {
  const dir = await ensureDir(storagePath('uploads', contactId));
  const dest = path.join(dir, path.basename(file.path));
  await fs.rename(file.path, dest);
  return dest;
}

async function savePhotoFromUrl(contactId, url) {
  if (!/^https?:\/\//i.test(url)) throw Object.assign(new Error('Photo link must start with http(s)://'), { status: 400 });
  const res = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(15000) });
  const type = res.headers.get('content-type') || '';
  if (!res.ok || !type.startsWith('image/')) throw Object.assign(new Error('That link did not return an image. It may have expired; download the photo and upload it instead.'), { status: 400 });
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length > 8 * 1024 * 1024) throw Object.assign(new Error('Photo is larger than 8 MB'), { status: 400 });
  const ext = type.includes('png') ? '.png' : type.includes('webp') ? '.webp' : '.jpg';
  const dir = await ensureDir(storagePath('uploads', contactId));
  const dest = path.join(dir, `photo-${randomToken(6)}${ext}`);
  await fs.writeFile(dest, buf);
  return dest;
}

const summary = (c) => ({
  id: c.id, fullName: c.fullName, slug: c.slug, status: c.status, statusChangedAt: c.statusChangedAt,
  relationshipNote: c.relationshipNote, whatsapp: c.whatsapp, email: c.email, hasPhoto: Boolean(c.photoPath),
  createdAt: c.createdAt,
});

// List
r.get('/', ah(async (req, res) => {
  const where = {};
  if (req.query.status) where.status = String(req.query.status).split(',').filter((s) => STATUSES.includes(s));
  if (req.query.q) where.fullName = { [Op.iLike]: `%${req.query.q}%` };
  const rows = await Contact.findAll({ where, order: [['statusChangedAt', 'DESC']], limit: 500 });
  res.json(rows.map(summary));
}));

// Create from files (PDF and/or screenshots) + optional photo
r.post('/', upload.fields([{ name: 'files', maxCount: 10 }, { name: 'photo', maxCount: 1 }]), ah(async (req, res) => {
  const files = req.files?.files || [];
  const photo = req.files?.photo?.[0];
  const b = req.body || {};
  if (!files.length && !b.fullName) {
    throw Object.assign(new Error('Add a LinkedIn PDF, screenshots, or at least a name'), { status: 400 });
  }
  const name = (b.fullName || '').trim() || 'Unnamed';
  const contact = await Contact.create({
    fullName: name,
    slug: await uniqueSlug(name === 'Unnamed' ? `person-${randomToken(4).toLowerCase()}` : name),
    relationshipNote: b.relationshipNote || null,
    whatsapp: b.whatsapp || null,
    email: b.email || null,
    linkedinUrl: b.linkedinUrl || null,
  });
  for (const f of files) {
    const dest = await moveIntoContact(contact.id, f);
    await SourceFile.create({
      contactId: contact.id,
      kind: f.mimetype === 'application/pdf' ? 'profile_pdf' : 'screenshot',
      storagePath: dest, originalName: f.originalname, mimeType: f.mimetype,
    });
  }
  if (photo) {
    contact.photoPath = await moveIntoContact(contact.id, photo);
  } else if (b.photoUrl) {
    try {
      contact.photoPath = await savePhotoFromUrl(contact.id, b.photoUrl);
    } catch (e) {
      await log(contact.id, 'system', 'photo_failed', e.message);
    }
  }
  await contact.save();
  await log(contact.id, 'you', 'imported', `Imported ${contact.fullName === 'Unnamed' ? 'a new profile' : contact.fullName}`);

  if (files.length) runExtraction(contact.id); // background; the app polls the contact
  else {
    await Profile.create({ contactId: contact.id, version: 1, data: normalizeProfile({ fullName: name }), extractedBy: 'manual' });
    await setStatus(contact, 'extracted');
  }
  res.status(201).json(summary(contact));
}));

// Detail
r.get('/:id', ah(async (req, res) => {
  const c = await Contact.findByPk(req.params.id);
  if (!c) return res.status(404).json({ error: 'Not found' });
  const [profile, site, messages, deployments, activity, sources, leads] = await Promise.all([
    latestProfile(c.id),
    latestSite(c.id),
    Message.findAll({ where: { contactId: c.id }, order: [['createdAt', 'DESC']] }),
    Deployment.findAll({ where: { contactId: c.id }, order: [['createdAt', 'DESC']] }),
    Activity.findAll({ where: { contactId: c.id }, order: [['createdAt', 'DESC']], limit: 30 }),
    SourceFile.findAll({ where: { contactId: c.id } }),
    Lead.findAll({ where: { contactId: c.id } }),
  ]);
  res.json({
    ...summary(c),
    linkedinUrl: c.linkedinUrl, phone: c.phone, purgedAt: c.purgedAt,
    photoUrl: c.photoPath ? `/api/contacts/${c.id}/photo?v=${encodeURIComponent(path.basename(c.photoPath))}` : null,
    profile: profile && { id: profile.id, version: profile.version, data: profile.data, flags: profile.flags, extractedBy: profile.extractedBy, reviewedAt: profile.reviewedAt },
    site: site && { ...site.toJSON(), outputDir: undefined, previewUrl: previewUrlFor(site) },
    messages, deployments, activity, leads,
    sources: sources.map((s) => ({ id: s.id, kind: s.kind, originalName: s.originalName, mimeType: s.mimeType })),
  });
}));

// Update basics
r.patch('/:id', ah(async (req, res) => {
  const c = await Contact.findByPk(req.params.id);
  if (!c) return res.status(404).json({ error: 'Not found' });
  for (const k of ['fullName', 'relationshipNote', 'whatsapp', 'email', 'phone', 'linkedinUrl']) {
    if (k in req.body) c[k] = req.body[k];
  }
  if ('fullName' in req.body) c.slug = await uniqueSlug(c.fullName, c.id);
  await c.save();
  res.json(summary(c));
}));

r.delete('/:id', ah(async (req, res) => {
  const c = await Contact.findByPk(req.params.id);
  if (!c) return res.status(404).json({ error: 'Not found' });
  await purgeContactData(c);
  await c.destroy();
  res.json({ ok: true });
}));

// Serve a source file (PDF / screenshot) for the review screen
r.get('/:id/sources/:fileId', ah(async (req, res) => {
  const f = await SourceFile.findOne({ where: { id: req.params.fileId, contactId: req.params.id } });
  if (!f) return res.status(404).end();
  res.type(f.mimeType).sendFile(f.storagePath);
}));

r.get('/:id/photo', ah(async (req, res) => {
  const c = await Contact.findByPk(req.params.id);
  if (!c?.photoPath) return res.status(404).end();
  res.sendFile(c.photoPath);
}));

// Replace photo: upload a file or give a link
r.post('/:id/photo', upload.single('photo'), ah(async (req, res) => {
  const c = await Contact.findByPk(req.params.id);
  if (!c) return res.status(404).json({ error: 'Not found' });
  if (req.file) c.photoPath = await moveIntoContact(c.id, req.file);
  else if (req.body?.photoUrl) c.photoPath = await savePhotoFromUrl(c.id, req.body.photoUrl);
  else throw Object.assign(new Error('Upload a photo or give a link'), { status: 400 });
  await c.save();
  await log(c.id, 'you', 'photo_updated', `Updated photo for ${c.fullName}`);
  res.json({ ok: true });
}));

r.post('/:id/extract', ah(async (req, res) => {
  const c = await Contact.findByPk(req.params.id);
  if (!c) return res.status(404).json({ error: 'Not found' });
  await setStatus(c, 'imported');
  runExtraction(c.id);
  res.json({ ok: true });
}));

// Save reviewed profile (creates a new version)
r.put('/:id/profile', ah(async (req, res) => {
  const c = await Contact.findByPk(req.params.id);
  if (!c) return res.status(404).json({ error: 'Not found' });
  const prev = await latestProfile(c.id);
  const data = normalizeProfile(req.body?.data || {});
  const markReviewed = Boolean(req.body?.reviewed);
  const p = await Profile.create({
    contactId: c.id, version: (prev?.version || 0) + 1, data,
    flags: req.body?.flags ?? [], extractedBy: prev?.extractedBy || 'manual',
    reviewedAt: markReviewed ? new Date() : null,
  });
  if (data.fullName && data.fullName !== c.fullName) {
    c.fullName = data.fullName;
    c.slug = await uniqueSlug(data.fullName, c.id);
    await c.save();
  }
  if (markReviewed && ['extracted', 'imported', 'failed'].includes(c.status)) {
    await setStatus(c, 'reviewed');
    await log(c.id, 'you', 'reviewed', `Reviewed ${c.fullName}'s profile`);
  }
  res.json({ id: p.id, version: p.version });
}));

// Build (or rebuild) the site
r.post('/:id/build', ah(async (req, res) => {
  const { templateId, tone, copy } = req.body || {};
  const site = await buildSite(req.params.id, { templateId, tone, copy });
  res.json({ ...site.toJSON(), outputDir: undefined, previewUrl: previewUrlFor(site) });
}));

// Mark that the person replied (stops nudges, helps lead tracking)
r.post('/:id/replied', ah(async (req, res) => {
  const m = await Message.findOne({ where: { contactId: req.params.id, status: 'sent' }, order: [['sentAt', 'DESC']] });
  if (m) { m.replyReceivedAt = new Date(); await m.save(); }
  await log(req.params.id, 'person', 'replied', 'Marked as replied');
  res.json({ ok: true });
}));

export default r;
