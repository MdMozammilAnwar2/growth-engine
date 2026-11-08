// Writer agent: turns a reviewed profile into site copy. It may rephrase, never add facts.
import { aiEnabled, askJson } from './llm.js';
import { truncateWords } from './util.js';
import { config } from '../config.js';

const TONES = {
  confident: 'confident and clear',
  warm: 'warm and personal',
  minimal: 'minimal and understated',
};

const SYSTEM = (tone) => `You write copy for a personal portfolio website.
Tone: ${TONES[tone] || TONES.confident}.
Hard rules:
- Use ONLY facts present in the profile JSON. Never add jobs, employers, dates, numbers, awards or claims.
- You may shorten and rephrase.
- "hero": one sentence, max 80 characters, about what the person does. No name in it.
- "eyebrow": role and city, max 48 characters, e.g. "Senior Software Engineer · Bengaluru".
- "about": 2–3 sentences, first person, max 320 characters.
- "roleSummaries": for each experience item in order, one sentence (max 140 chars) based only on its description, or "" if none.
Reply with JSON only: {"hero": "", "eyebrow": "", "about": "", "roleSummaries": [""]}`;

function fallbackCopy(p) {
  const role = p.experience[0]?.title || p.headline.split(/[|·@,]/)[0].trim();
  const city = (p.location || '').split(',')[0].trim();
  const cleanHeadline = String(p.headline || '').split(/\s+[|•]\s+/)[0].trim();
  return {
    hero: truncateWords(cleanHeadline || role || p.fullName, 80),
    eyebrow: truncateWords([role, city].filter(Boolean).join(' · '), 48),
    about: truncateWords(p.about, 320),
    roleSummaries: p.experience.map((e) => truncateWords(e.description, 140)),
  };
}

export async function writeCopy(profile, tone = 'confident') {
  if (!aiEnabled()) return { ...fallbackCopy(profile), by: 'template' };
  try {
    const out = await askJson(SYSTEM(tone), [{ type: 'text', text: JSON.stringify(profile) }], 1500);
    const fb = fallbackCopy(profile);
    return {
      hero: truncateWords(out.hero || fb.hero, 90),
      eyebrow: truncateWords(out.eyebrow || fb.eyebrow, 56),
      about: truncateWords(out.about || fb.about, 360),
      roleSummaries: Array.isArray(out.roleSummaries) ? out.roleSummaries.map((s) => truncateWords(s, 160)) : fb.roleSummaries,
      by: 'ai',
    };
  } catch (e) {
    console.error('Writer failed, using fallback:', e.message);
    return { ...fallbackCopy(profile), by: 'template' };
  }
}

/** Build the content object the templates render. */
export function composeContent(profile, copy, { photoFile, templateId }) {
  const featuredExp = profile.experience.filter((e) => e.featured !== false);
  return {
    templateId,
    name: profile.fullName,
    eyebrow: copy.eyebrow,
    hero: copy.hero,
    about: copy.about,
    location: profile.location,
    photo: photoFile || null,
    experience: featuredExp.map((e) => ({
      title: e.title, company: e.company, location: e.location,
      period: [e.start, e.end].filter(Boolean).join(' — '),
      summary: copy.roleSummaries?.[profile.experience.indexOf(e)] || truncateWords(e.description, 160),
    })),
    education: profile.education,
    skills: profile.skills.filter((s) => s.featured !== false).map((s) => s.name).slice(0, 14),
    projects: profile.projects,
    certifications: profile.certifications.slice(0, 6),
    contact: {
      email: profile.email,
      linkedin: profile.linkedinUrl,
      website: profile.website,
    },
    credit: { ...config.credit },
    year: new Date().getFullYear(),
  };
}
