import { Router } from 'express';
import { fn, col, Op } from 'sequelize';
import { Contact, Message, Deployment, Lead, Activity, Template, STATUSES } from '../db.js';
import { ah } from '../middleware.js';
import { aiEnabled } from '../services/llm.js';
import { githubEnabled } from '../services/publisher.js';
import { config } from '../config.js';

const r = Router();

r.get('/dashboard', ah(async (_req, res) => {
  const byStatus = Object.fromEntries(STATUSES.map((s) => [s, 0]));
  const rows = await Contact.findAll({ attributes: ['status', [fn('COUNT', col('id')), 'n']], group: ['status'], raw: true });
  for (const row of rows) byStatus[row.status] = Number(row.n);

  const previewsSent = await Message.count({ where: { templateKey: 'preview', status: 'sent' } });
  const yes = byStatus.consented + byStatus.published;
  const live = await Deployment.count({ where: { status: 'live' } });
  const replies = await Message.count({ where: { replyReceivedAt: { [Op.ne]: null } } });
  const won = await Lead.findAll({ where: { stage: 'won' }, attributes: ['valueInr'], raw: true });

  const needs = async (status, task, to) => (await Contact.findAll({ where: { status }, order: [['statusChangedAt', 'ASC']], limit: 10 }))
    .map((c) => ({ id: c.id, name: c.fullName, task, status, since: c.statusChangedAt, to: to(c) }));
  const todos = [
    ...(await needs('consented', 'Approve publish', () => '/approvals?tab=publish')),
    ...(await needs('changes_requested', 'Apply requested changes', (c) => `/people/${c.id}/studio`)),
    ...(await needs('extracted', 'Review profile', (c) => `/people/${c.id}/review`)),
    ...(await needs('reviewed', 'Build site', (c) => `/people/${c.id}/review`)),
    ...(await needs('built', 'Approve preview', () => '/approvals')),
    ...(await needs('preview_approved', 'Send preview', (c) => `/send?contact=${c.id}`)),
    ...(await needs('failed', 'Fix failed step', (c) => `/people/${c.id}/review`)),
  ];

  const activity = await Activity.findAll({
    include: [{ model: Contact, attributes: ['fullName'] }], order: [['createdAt', 'DESC']], limit: 12,
  });
  const recentLive = await Deployment.findAll({
    where: { status: 'live' }, include: [{ model: Contact, attributes: ['fullName', 'id'] }], order: [['deployedAt', 'DESC']], limit: 6,
  });

  res.json({
    byStatus,
    kpis: {
      previewsSent,
      consentRate: previewsSent ? Math.round((yes / previewsSent) * 100) : null,
      yes,
      sitesLive: live,
      replies,
      wonValue: won.reduce((a, l) => a + (l.valueInr || 0), 0),
      wonCount: won.length,
    },
    todos,
    activity: activity.map((a) => ({ id: a.id, actor: a.actor, text: a.text, event: a.event, at: a.createdAt, contactId: a.contactId, name: a.contact?.fullName })),
    recentLive: recentLive.map((d) => ({ id: d.id, url: d.pagesUrl, repo: d.githubRepo, name: d.contact?.fullName, contactId: d.contact?.id, at: d.deployedAt })),
  });
}));

r.get('/settings', ah(async (_req, res) => {
  res.json({
    ai: { enabled: aiEnabled(), model: config.ai.model },
    github: { enabled: githubEnabled(), owner: config.github.owner, ownerType: config.github.ownerType },
    credit: config.credit,
    publicBaseUrl: config.publicBaseUrl,
    declineRetentionDays: config.declineRetentionDays,
    templates: await Template.findAll({ where: { active: true }, order: [['id', 'ASC']] }),
  });
}));

export default r;
