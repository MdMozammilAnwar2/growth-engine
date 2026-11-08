import { Router } from 'express';
import { Op } from 'sequelize';
import { Contact, Message, Deployment } from '../db.js';
import { ah } from '../middleware.js';
import { draftMessage, sendLinks } from '../services/outreach.js';
import { latestProfile, latestSite, previewUrlFor } from '../services/pipeline.js';
import { log, setStatus } from '../services/util.js';

const r = Router();
const NUDGE_AFTER_DAYS = 4;

async function contextFor(contact) {
  const [profile, site, dep] = await Promise.all([
    latestProfile(contact.id),
    latestSite(contact.id),
    Deployment.findOne({ where: { contactId: contact.id, status: 'live' }, order: [['createdAt', 'DESC']] }),
  ]);
  return { contact, profile: profile?.data || {}, previewUrl: site ? previewUrlFor(site) : '', pagesUrl: dep?.pagesUrl || '' };
}

/** Who needs a message right now, and which one. */
r.get('/messages/queue', ah(async (_req, res) => {
  const out = [];
  const add = (contact, templateKey, reason) => out.push({
    contact: { id: contact.id, fullName: contact.fullName, whatsapp: contact.whatsapp, email: contact.email, status: contact.status },
    templateKey, reason,
  });
  const sentKeys = async (id) => new Set((await Message.findAll({ where: { contactId: id, status: 'sent' } })).map((m) => m.templateKey));

  for (const c of await Contact.findAll({ where: { status: 'preview_approved' } })) add(c, 'preview', 'Preview approved');

  const cutoff = new Date(Date.now() - NUDGE_AFTER_DAYS * 864e5);
  for (const c of await Contact.findAll({ where: { status: 'preview_sent' } })) {
    const sent = await Message.findOne({ where: { contactId: c.id, templateKey: 'preview', status: 'sent', sentAt: { [Op.lt]: cutoff } } });
    const replied = await Message.findOne({ where: { contactId: c.id, replyReceivedAt: { [Op.ne]: null } } });
    if (sent && !replied && !(await sentKeys(c.id)).has('nudge')) add(c, 'nudge', `No reply for ${NUDGE_AFTER_DAYS}+ days`);
  }
  for (const c of await Contact.findAll({ where: { status: 'published' } })) {
    if (!(await sentKeys(c.id)).has('live')) add(c, 'live', 'Site is live');
  }
  for (const c of await Contact.findAll({ where: { status: 'declined', purgedAt: null } })) {
    if (!(await sentKeys(c.id)).has('thanks')) add(c, 'thanks', 'Said no thanks');
  }
  res.json(out);
}));

/** Create (or return the existing) draft for a contact. */
r.post('/contacts/:id/messages/draft', ah(async (req, res) => {
  const contact = await Contact.findByPk(req.params.id);
  if (!contact) return res.status(404).json({ error: 'Not found' });
  const templateKey = req.body?.templateKey || 'preview';
  const channel = req.body?.channel || (contact.whatsapp ? 'whatsapp' : 'linkedin');
  let msg = await Message.findOne({ where: { contactId: contact.id, templateKey, status: 'draft' } });
  if (!msg || req.body?.regenerate) {
    const { body, highlight } = await draftMessage(templateKey, await contextFor(contact));
    if (msg) Object.assign(msg, { body, highlight, channel });
    else msg = Message.build({ contactId: contact.id, templateKey, channel, body, highlight });
    await msg.save();
    await log(contact.id, 'Outreach', 'drafted', `Drafted ${templateKey} message for ${contact.fullName}`);
  }
  res.json({ ...msg.toJSON(), links: sendLinks(msg.channel, contact, msg.body) });
}));

r.patch('/messages/:id', ah(async (req, res) => {
  const msg = await Message.findByPk(req.params.id, { include: [Contact] });
  if (!msg) return res.status(404).json({ error: 'Not found' });
  if (typeof req.body?.body === 'string') msg.body = req.body.body;
  if (['whatsapp', 'linkedin', 'email'].includes(req.body?.channel)) msg.channel = req.body.channel;
  await msg.save();
  res.json({ ...msg.toJSON(), links: sendLinks(msg.channel, msg.contact, msg.body) });
}));

r.post('/messages/:id/sent', ah(async (req, res) => {
  const msg = await Message.findByPk(req.params.id, { include: [Contact] });
  if (!msg) return res.status(404).json({ error: 'Not found' });
  msg.status = 'sent';
  msg.sentAt = new Date();
  if (msg.templateKey === 'preview' && req.body?.remind !== false) msg.remindAt = new Date(Date.now() + NUDGE_AFTER_DAYS * 864e5);
  await msg.save();
  if (msg.templateKey === 'preview' && msg.contact.status === 'preview_approved') await setStatus(msg.contact, 'preview_sent');
  await log(msg.contactId, 'you', 'message_sent', `Sent ${msg.templateKey} message to ${msg.contact.fullName} by ${msg.channel}`);
  res.json({ ok: true });
}));

export default r;
