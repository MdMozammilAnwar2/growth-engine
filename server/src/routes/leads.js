import { Router } from 'express';
import { Lead, Contact, LEAD_STAGES } from '../db.js';
import { ah } from '../middleware.js';
import { log } from '../services/util.js';

const r = Router();
const FIELDS = ['title', 'need', 'stage', 'valueInr', 'notes', 'nextStep', 'nextStepDate', 'contactId'];
const pick = (b) => Object.fromEntries(FIELDS.filter((k) => k in (b || {})).map((k) => [k, b[k] === '' ? null : b[k]]));

r.get('/', ah(async (_req, res) => {
  const rows = await Lead.findAll({ include: [{ model: Contact, attributes: ['id', 'fullName', 'whatsapp', 'phone', 'email'] }], order: [['updatedAt', 'DESC']] });
  const totals = Object.fromEntries(LEAD_STAGES.map((s) => [s, 0]));
  for (const l of rows) totals[l.stage] += l.valueInr || 0;
  res.json({ leads: rows, totals, stages: LEAD_STAGES });
}));

r.post('/', ah(async (req, res) => {
  const lead = await Lead.create(pick(req.body));
  if (lead.contactId) await log(lead.contactId, 'you', 'lead_created', `New lead: ${lead.title || lead.need}`);
  res.status(201).json(lead);
}));

r.patch('/:id', ah(async (req, res) => {
  const lead = await Lead.findByPk(req.params.id);
  if (!lead) return res.status(404).json({ error: 'Not found' });
  const before = lead.stage;
  await lead.update(pick(req.body));
  if (lead.contactId && before !== lead.stage) await log(lead.contactId, 'you', 'lead_stage', `Lead moved to ${lead.stage}`);
  res.json(lead);
}));

r.delete('/:id', ah(async (req, res) => {
  await Lead.destroy({ where: { id: req.params.id } });
  res.json({ ok: true });
}));

export default r;
