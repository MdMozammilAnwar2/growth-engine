// Orchestrates the agents and moves contacts through the pipeline.
import fs from 'node:fs/promises';
import { Contact, Profile, Site, SourceFile, Deployment, Approval } from '../db.js';
import { extractProfile } from './extractor.js';
import { writeCopy, composeContent } from './writer.js';
import { buildSiteFiles } from './builder.js';
import { runQa } from './qa.js';
import { publishToGithub } from './publisher.js';
import { log, randomToken, setStatus, uniqueSlug, storagePath } from './util.js';
import { config } from '../config.js';

export const latestProfile = (contactId) => Profile.findOne({ where: { contactId }, order: [['version', 'DESC']] });
export const latestSite = (contactId) => Site.findOne({ where: { contactId }, order: [['version', 'DESC']] });
export const previewUrlFor = (site) => `${config.publicBaseUrl}/p/${site.previewToken}/`;

export async function runExtraction(contactId) {
  const contact = await Contact.findByPk(contactId, { include: [SourceFile] });
  if (!contact) return;
  try {
    const files = contact.source_files || [];
    const pdfs = files.filter((f) => f.kind === 'profile_pdf').map((f) => f.storagePath);
    const images = files.filter((f) => f.kind === 'screenshot').map((f) => ({ path: f.storagePath, mime: f.mimeType }));
    await log(contact.id, 'Extractor', 'extract_started', `Reading ${pdfs.length + images.length} file(s)`);
    const { profile, flags, extractedBy } = await extractProfile({ pdfs, images });

    // Keep details you typed when importing
    if (!profile.fullName && contact.fullName !== 'Unnamed') profile.fullName = contact.fullName;
    if (contact.email && !profile.email) profile.email = contact.email;
    if (contact.linkedinUrl && !profile.linkedinUrl) profile.linkedinUrl = contact.linkedinUrl;

    const prev = await latestProfile(contact.id);
    await Profile.create({ contactId: contact.id, version: (prev?.version || 0) + 1, data: profile, flags, extractedBy });
    if (profile.fullName) {
      contact.fullName = profile.fullName;
      contact.slug = await uniqueSlug(profile.fullName, contact.id);
    }
    contact.email = contact.email || profile.email;
    contact.linkedinUrl = contact.linkedinUrl || profile.linkedinUrl;
    await setStatus(contact, 'extracted');
    await log(contact.id, 'Extractor', 'extracted',
      `Parsed profile for ${contact.fullName}${flags.length ? ` · ${flags.length} field(s) need a look` : ''}`, { extractedBy });
  } catch (e) {
    await setStatus(contact, 'failed');
    await log(contact.id, 'Extractor', 'extract_failed', e.message);
  }
}

export async function buildSite(contactId, { templateId = 'aurora', tone = 'confident', copy: overrides } = {}) {
  const contact = await Contact.findByPk(contactId);
  if (!contact) throw Object.assign(new Error('Contact not found'), { status: 404 });
  const profile = await latestProfile(contactId);
  if (!profile) throw Object.assign(new Error('No profile yet. Extract or fill it in first.'), { status: 400 });

  const copy = { ...(await writeCopy(profile.data, tone)), ...(overrides || {}) };
  await log(contact.id, 'Writer', 'copy_written', `Wrote site copy for ${contact.fullName}`, { by: copy.by });

  // The preview link stays the same across versions: move it from the old version to the new one.
  const prev = await latestSite(contactId);
  const token = prev?.previewToken || randomToken();
  if (prev) {
    prev.previewToken = `${token}.v${prev.version}`;
    await prev.save();
  }
  const site = await Site.create({
    contactId, templateId, version: (prev?.version || 0) + 1, previewToken: token,
  });
  const content = composeContent(profile.data, copy, { templateId });
  const { dir, photoFile, html } = await buildSiteFiles(site.id, content, contact.photoPath);
  const builtContent = { ...content, photo: photoFile };

  const qa = await runQa(dir, builtContent, html);
  site.content = { ...builtContent, tone };
  site.outputDir = dir;
  site.qaStatus = qa.status;
  site.qaReport = qa.report;
  await site.save();

  if (!['preview_sent', 'consented', 'published'].includes(contact.status)) {
    await setStatus(contact, 'built');
  }
  const passed = qa.report.filter((r) => r.status === 'pass').length;
  const counted = qa.report.filter((r) => r.status !== 'skip').length;
  await log(contact.id, 'QA', 'qa_done', `${contact.slug} passed ${passed} of ${counted} checks`, { status: qa.status });
  return site;
}

export async function approvePreview(site, note) {
  const contact = await Contact.findByPk(site.contactId);
  await Approval.create({ siteId: site.id, stage: 'preview', decision: 'approved', note });
  await setStatus(contact, 'preview_approved');
  await log(contact.id, 'you', 'preview_approved', `Approved preview for ${contact.fullName}`);
}

export async function sendBack(site, stage, note) {
  const contact = await Contact.findByPk(site.contactId);
  await Approval.create({ siteId: site.id, stage, decision: 'sent_back', note });
  await setStatus(contact, 'reviewed');
  await log(contact.id, 'you', 'sent_back', `Sent ${contact.fullName} back for changes${note ? `: ${note}` : ''}`);
}

export async function approvePublish(site, note) {
  const contact = await Contact.findByPk(site.contactId);
  if (contact.status !== 'consented' && contact.status !== 'published') {
    throw Object.assign(new Error('They have not said yes yet. A site only goes live after they tap "Publish it".'), { status: 409 });
  }
  await Approval.create({ siteId: site.id, stage: 'publish', decision: 'approved', note });
  const dep = await Deployment.create({ siteId: site.id, contactId: contact.id, status: 'deploying' });
  await log(contact.id, 'Publisher', 'deploy_started', `Deploying ${contact.slug} to GitHub Pages`);
  try {
    const r = await publishToGithub({ slug: contact.slug, name: contact.fullName, dir: site.outputDir });
    Object.assign(dep, { githubRepo: r.repo, commitSha: r.commitSha, pagesUrl: r.pagesUrl, status: 'live', deployedAt: new Date() });
    await dep.save();
    await setStatus(contact, 'published');
    await log(contact.id, 'Publisher', 'deployed', `Deployed ${contact.slug} to GitHub Pages`, { url: r.pagesUrl });
  } catch (e) {
    dep.status = 'failed';
    dep.error = e.message;
    await dep.save();
    await log(contact.id, 'Publisher', 'deploy_failed', e.message);
    throw Object.assign(new Error(`Publish failed: ${e.message}`), { status: 502 });
  }
  return dep;
}

/** Remove a contact's personal data but keep the row and its log. */
export async function purgeContactData(contact) {
  const sites = await Site.findAll({ where: { contactId: contact.id } });
  for (const s of sites) if (s.outputDir) await fs.rm(s.outputDir, { recursive: true, force: true });
  await fs.rm(storagePath('uploads', contact.id), { recursive: true, force: true });
  await Site.destroy({ where: { contactId: contact.id } });
  await Profile.destroy({ where: { contactId: contact.id } });
  await SourceFile.destroy({ where: { contactId: contact.id } });
  contact.photoPath = null;
  contact.email = null;
  contact.phone = null;
  contact.whatsapp = null;
  contact.purgedAt = new Date();
  await contact.save();
  await log(contact.id, 'system', 'purged', `Deleted profile data for ${contact.fullName}`);
}
