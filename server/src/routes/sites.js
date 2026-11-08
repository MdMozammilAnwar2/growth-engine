import { Router } from 'express';
import { Contact, Site, Consent, Deployment } from '../db.js';
import { ah } from '../middleware.js';
import {
  approvePreview, approvePublish, sendBack, latestSite, previewUrlFor,
} from '../services/pipeline.js';
import { takedownFromGithub } from '../services/publisher.js';
import { log, setStatus } from '../services/util.js';

const r = Router();

const siteOr404 = async (id) => {
  const s = await Site.findByPk(id);
  if (!s) throw Object.assign(new Error('Site not found'), { status: 404 });
  return s;
};

const card = async (contact) => {
  const site = await latestSite(contact.id);
  const consent = site ? await Consent.findOne({ where: { siteId: site.id }, order: [['createdAt', 'DESC']] }) : null;
  return {
    contact: { id: contact.id, fullName: contact.fullName, slug: contact.slug, status: contact.status, statusChangedAt: contact.statusChangedAt, whatsapp: contact.whatsapp },
    site: site && {
      id: site.id, version: site.version, templateId: site.templateId, qaStatus: site.qaStatus, qaReport: site.qaReport,
      eyebrow: site.content?.eyebrow, hero: site.content?.hero, previewUrl: previewUrlFor(site),
    },
    consent: consent && { decision: consent.decision, message: consent.message, at: consent.createdAt },
  };
};

// Both approval queues
r.get('/approvals', ah(async (_req, res) => {
  const preview = await Contact.findAll({ where: { status: 'built' }, order: [['statusChangedAt', 'ASC']] });
  const publish = await Contact.findAll({ where: { status: 'consented' }, order: [['statusChangedAt', 'ASC']] });
  const changes = await Contact.findAll({ where: { status: 'changes_requested' }, order: [['statusChangedAt', 'ASC']] });
  res.json({
    preview: await Promise.all(preview.map(card)),
    publish: await Promise.all(publish.map(card)),
    changes: await Promise.all(changes.map(card)),
  });
}));

r.get('/sites/:id', ah(async (req, res) => {
  const s = await siteOr404(req.params.id);
  res.json({ ...s.toJSON(), outputDir: undefined, previewUrl: previewUrlFor(s) });
}));

r.post('/sites/:id/approve-preview', ah(async (req, res) => {
  const s = await siteOr404(req.params.id);
  await approvePreview(s, req.body?.note);
  res.json({ ok: true });
}));

r.post('/sites/:id/send-back', ah(async (req, res) => {
  const s = await siteOr404(req.params.id);
  await sendBack(s, req.body?.stage === 'publish' ? 'publish' : 'preview', req.body?.note);
  res.json({ ok: true });
}));

r.post('/sites/:id/approve-publish', ah(async (req, res) => {
  const s = await siteOr404(req.params.id);
  const latest = await latestSite(s.contactId);
  const dep = await approvePublish(latest || s, req.body?.note);
  res.json(dep);
}));

r.post('/sites/:id/takedown', ah(async (req, res) => {
  const s = await siteOr404(req.params.id);
  const dep = await Deployment.findOne({ where: { contactId: s.contactId, status: 'live' }, order: [['createdAt', 'DESC']] });
  if (!dep) throw Object.assign(new Error('Nothing is live for this person'), { status: 404 });
  await takedownFromGithub(dep.githubRepo);
  dep.status = 'taken_down';
  dep.takedownAt = new Date();
  await dep.save();
  const c = await Contact.findByPk(s.contactId);
  await setStatus(c, 'declined');
  await log(c.id, 'Publisher', 'taken_down', `Took down ${dep.githubRepo}`);
  res.json({ ok: true });
}));

export default r;
