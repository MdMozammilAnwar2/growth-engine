import { Op } from 'sequelize';
import { Contact } from '../db.js';
import { config } from '../config.js';
import { purgeContactData } from './pipeline.js';

export async function purgeDeclined() {
  const cutoff = new Date(Date.now() - config.declineRetentionDays * 864e5);
  const due = await Contact.findAll({
    where: { status: 'declined', purgedAt: null, statusChangedAt: { [Op.lt]: cutoff } },
  });
  for (const c of due) await purgeContactData(c);
  return due.length;
}

export function startRetentionJob() {
  const run = () => purgeDeclined().catch((e) => console.error('retention job:', e.message));
  run();
  return setInterval(run, 6 * 60 * 60 * 1000); // every 6 hours
}
