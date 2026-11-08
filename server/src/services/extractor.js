// Extractor agent: LinkedIn PDF text or profile screenshots -> structured profile JSON.
import fs from 'node:fs/promises';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { aiEnabled, askJson } from './llm.js';

export const EMPTY_PROFILE = {
  fullName: '', headline: '', location: '', about: '',
  email: '', phone: '', linkedinUrl: '', website: '',
  experience: [], // {title, company, start, end, location, description, featured}
  education: [],  // {school, degree, start, end}
  skills: [],     // {name, featured}
  projects: [],   // {name, description, url}
  certifications: [], // {name, issuer, year}
  languages: [],
};

const SCHEMA_HINT = `{
  "fullName": string, "headline": string, "location": string, "about": string,
  "email": string, "phone": string, "linkedinUrl": string, "website": string,
  "experience": [{"title": string, "company": string, "start": string, "end": string, "location": string, "description": string}],
  "education": [{"school": string, "degree": string, "start": string, "end": string}],
  "skills": [string],
  "projects": [{"name": string, "description": string, "url": string}],
  "certifications": [{"name": string, "issuer": string, "year": string}],
  "languages": [string],
  "flags": [{"field": string, "reason": string}]
}`;

const SYSTEM = `You extract LinkedIn profile data into JSON.
Rules:
- Copy facts exactly as written. Never invent, infer or embellish jobs, dates, employers, schools or skills.
- Use "" or [] when something is not present.
- Dates as written (e.g. "Jan 2021", "2019", "Present").
- Put entries in "flags" for anything you are unsure about (cut-off text, unclear dates, ambiguous names).
- Reply with JSON only, matching this shape:
${SCHEMA_HINT}`;

export function normalizeProfile(raw = {}) {
  const p = { ...EMPTY_PROFILE, ...raw };
  const str = (v) => (v == null ? '' : String(v).trim());
  return {
    fullName: str(p.fullName), headline: str(p.headline), location: str(p.location), about: str(p.about),
    email: str(p.email), phone: str(p.phone), linkedinUrl: str(p.linkedinUrl), website: str(p.website),
    experience: (p.experience || []).map((e, i) => ({
      title: str(e.title), company: str(e.company), start: str(e.start), end: str(e.end),
      location: str(e.location), description: str(e.description),
      featured: e.featured ?? i < 3,
    })).filter((e) => e.title || e.company),
    education: (p.education || []).map((e) => ({ school: str(e.school), degree: str(e.degree), start: str(e.start), end: str(e.end) }))
      .filter((e) => e.school),
    skills: (p.skills || []).map((s, i) => (typeof s === 'string' ? { name: str(s), featured: i < 8 } : { name: str(s.name), featured: s.featured ?? i < 8 }))
      .filter((s) => s.name),
    projects: (p.projects || []).map((x) => ({ name: str(x.name), description: str(x.description), url: str(x.url) })).filter((x) => x.name),
    certifications: (p.certifications || []).map((x) => ({ name: str(x.name), issuer: str(x.issuer), year: str(x.year) })).filter((x) => x.name),
    languages: (p.languages || []).map(str).filter(Boolean),
  };
}

/** Text of a PDF, one visual line per line, pages in order. */
export async function pdfToText(filePath) {
  const data = new Uint8Array(await fs.readFile(filePath));
  const task = getDocument({ data, useSystemFonts: true, isEvalSupported: false, verbosity: 0 });
  const doc = await task.promise;
  const pages = [];
  for (let n = 1; n <= doc.numPages; n++) {
    const page = await doc.getPage(n);
    const { items } = await page.getTextContent();
    let line = '';
    const lines = [];
    for (const it of items) {
      line += it.str;
      if (it.hasEOL) { lines.push(line); line = ''; }
    }
    if (line) lines.push(line);
    pages.push(lines.join('\n'));
  }
  await task.destroy();
  return pages.join('\n');
}

// ── Rule-based fallback for LinkedIn "Save to PDF" files ─────────────────
const MONTHS = '(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*';
const DATE_RANGE = new RegExp(`^((?:${MONTHS}\\s+)?\\d{4})\\s*[-–]\\s*(Present|(?:${MONTHS}\\s+)?\\d{4})`, 'i');
const DURATION = /^\d+\s+(year|month)s?(\s+\d+\s+months?)?$/i;
const LEFT_HEADS = ['Contact', 'Top Skills', 'Languages', 'Certifications', 'Honors-Awards', 'Publications', 'Patents'];
const MAIN_HEADS = ['Summary', 'Experience', 'Education'];

export function parseLinkedInText(text) {
  const lines = text.split('\n').map((l) => l.replace(/ /g, ' ').trim())
    .filter((l) => l && !/^Page \d+ of \d+$/i.test(l));
  const idx = (h) => lines.findIndex((l) => l === h);
  const flags = [];
  const out = { ...EMPTY_PROFILE, experience: [], education: [], skills: [], certifications: [], languages: [] };

  // Contact block
  const email = text.match(/[\w.+-]+@[\w-]+\.[\w.-]+/);
  if (email) out.email = email[0];
  const li = text.match(/(?:www\.)?linkedin\.com\/in\/[\w-]+/i);
  if (li) out.linkedinUrl = `https://${li[0].replace(/^https?:\/\//, '')}`;
  // Left column lists, bounded by the next heading of any kind
  const allHeads = [...LEFT_HEADS, ...MAIN_HEADS];
  const firstMain = Math.min(...MAIN_HEADS.map(idx).filter((i) => i >= 0), lines.length);
  const block = (h) => {
    const s = idx(h);
    if (s < 0) return [];
    const res = [];
    for (let i = s + 1; i < lines.length && !allHeads.includes(lines[i]); i++) res.push(lines[i]);
    return res;
  };
  const leftEnd = (h) => {
    const b = block(h);
    // left lists stop before the name/headline/location trio that opens the main column
    const s = idx(h);
    return s >= 0 && s < firstMain ? b.slice(0, Math.max(0, Math.min(b.length, firstMain - s - 1 - 3))) : b;
  };
  const phone = block('Contact').join('\n').match(/(?:\+\d{1,3}[\s-]?)?\d{5}[\s-]?\d{5}\b/);
  if (phone) out.phone = phone[0].trim();
  out.skills = leftEnd('Top Skills').map((name) => ({ name, featured: true }));
  out.languages = leftEnd('Languages').map((l) => l.replace(/\s*\(.*\)$/, ''));
  out.certifications = leftEnd('Certifications').map((name) => ({ name, issuer: '', year: '' }));

  // Name, headline, location: the lines right before the first main heading
  const head = lines.slice(0, firstMain);
  const tail = head.slice(-3);
  if (tail.length === 3 && /,/.test(tail[2])) {
    [out.fullName, out.headline, out.location] = tail;
  } else if (tail.length >= 2) {
    [out.fullName, out.headline] = tail.slice(-2);
    flags.push({ field: 'location', reason: 'Location not found' });
  }

  // Summary
  const sum = block('Summary');
  if (sum.length) out.about = sum.join(' ');

  // Experience
  const exp = block('Experience');
  for (let i = 0; i < exp.length; i++) {
    const m = exp[i].match(DATE_RANGE);
    if (!m) continue;
    const title = exp[i - 1] || '';
    let company = exp[i - 2] || '';
    if (DURATION.test(company)) company = exp[i - 3] || '';
    // A company line that is itself a date/description means a grouped role: reuse previous company
    if (DATE_RANGE.test(company) || company.length > 80) company = out.experience.at(-1)?.company || '';
    const desc = [];
    let j = i + 1;
    let location = '';
    if (exp[j] && exp[j].length < 60 && /,/.test(exp[j]) && !DATE_RANGE.test(exp[j])) { location = exp[j]; j++; }
    for (; j < exp.length; j++) {
      if (exp[j + 1] && DATE_RANGE.test(exp[j + 1])) break;            // next title
      if (exp[j + 2] && DATE_RANGE.test(exp[j + 2])) break;            // next company + title
      if (exp[j + 3] && DATE_RANGE.test(exp[j + 3]) && DURATION.test(exp[j + 1] || '')) break;
      desc.push(exp[j]);
    }
    out.experience.push({
      title, company, start: m[1], end: m[2], location,
      description: desc.join(' ').trim(), featured: out.experience.length < 3,
    });
  }
  if (!out.experience.length && exp.length) flags.push({ field: 'experience', reason: 'Could not read roles; please add them' });

  // Education: "School" then "Degree · (2016 - 2020)"
  const edu = block('Education');
  for (let i = 0; i < edu.length; i++) {
    const line = edu[i + 1] || '';
    const yrs = line.match(/\((\d{4})\s*[-–]\s*(\d{4}|Present)\)/);
    if (yrs || line.includes('·')) {
      out.education.push({
        school: edu[i], degree: line.replace(/\s*·?\s*\(.*\)\s*$/, '').trim(),
        start: yrs?.[1] || '', end: yrs?.[2] || '',
      });
      i++;
    }
  }

  if (!out.fullName) flags.push({ field: 'fullName', reason: 'Name not found' });
  if (!out.headline) flags.push({ field: 'headline', reason: 'Headline not found' });
  return { profile: normalizeProfile(out), flags, extractedBy: 'rules' };
}

// ── Main entry ───────────────────────────────────────────────────────────
/**
 * @param {{pdfs: string[], images: {path: string, mime: string}[]}} files
 */
export async function extractProfile({ pdfs = [], images = [] }) {
  const texts = [];
  for (const p of pdfs) texts.push(await pdfToText(p));
  const text = texts.join('\n\n');

  if (aiEnabled()) {
    const content = [];
    for (const img of images.slice(0, 6)) {
      const data = (await fs.readFile(img.path)).toString('base64');
      content.push({ type: 'image', source: { type: 'base64', media_type: img.mime, data } });
    }
    content.push({
      type: 'text',
      text: text
        ? `LinkedIn profile PDF text:\n"""\n${text.slice(0, 60000)}\n"""`
        : 'These are screenshots of one person\'s LinkedIn profile. Extract the profile.',
    });
    const raw = await askJson(SYSTEM, content);
    const { flags = [], ...rest } = raw;
    return { profile: normalizeProfile(rest), flags, extractedBy: 'ai' };
  }

  if (images.length && !text) {
    throw new Error('Reading screenshots needs ANTHROPIC_API_KEY. Add it to server/.env, or upload the LinkedIn PDF instead.');
  }
  if (!text) throw new Error('No readable file was uploaded');
  return parseLinkedInText(text);
}
