// Outreach agent: drafts messages. You always read and send them yourself.
import { aiEnabled, askJson } from './llm.js';
import { config } from '../config.js';
import { digitsOnly, truncateWords } from './util.js';

const firstName = (n) => String(n || '').trim().split(/\s+/)[0] || 'there';

function fallbackHighlight(profile = {}) {
  const job = profile.experience?.[0];
  if (job?.title && job?.company) return `your work as ${job.title} at ${job.company}`;
  if (profile.headline) return `your work in ${truncateWords(profile.headline.toLowerCase(), 50)}`;
  return 'your profile';
}

async function pickHighlight(profile) {
  if (!aiEnabled()) return fallbackHighlight(profile);
  try {
    const out = await askJson(
      `Pick ONE specific, genuine detail from this LinkedIn profile that a friend would notice and mention.
Return a short phrase (max 70 chars) that fits after "I was going through your profile and ... stood out".
Start with "your". Use only facts in the profile. JSON only: {"highlight": ""}`,
      [{ type: 'text', text: JSON.stringify(profile) }], 300,
    );
    return truncateWords(out.highlight || fallbackHighlight(profile), 80);
  } catch {
    return fallbackHighlight(profile);
  }
}

/**
 * @param {'preview'|'nudge'|'live'|'thanks'} key
 * @returns {Promise<{body: string, highlight: string}>}
 */
export async function draftMessage(key, { contact, profile, previewUrl, pagesUrl }) {
  const name = firstName(contact.fullName);
  const sign = config.credit.name;
  if (key === 'preview') {
    const highlight = await pickHighlight(profile);
    return {
      highlight,
      body: `Hi ${name}, I was going through your profile and ${highlight} stood out. I built you a personal portfolio site as a small gift: ${previewUrl}

It's private right now. If you like it, tap "Publish it" and it goes live at your own link, free, no catch. If you'd like anything changed, just tell me. — ${sign}`,
    };
  }
  if (key === 'nudge') {
    return {
      highlight: 'swap the photo or tweak the wording',
      body: `Hi ${name}, just checking you saw the portfolio I made for you. Happy to swap the photo or tweak the wording before it goes live. No worries if it's not your thing.

${previewUrl}`,
    };
  }
  if (key === 'live') {
    return {
      highlight: 'your LinkedIn Featured section',
      body: `Your site is live: ${pagesUrl}

Add it to your LinkedIn Featured section and your CV. If you ever want a custom domain, I can set that up.

And if you or anyone you know needs a website, web app, mobile app or custom software, I'd love to help. That's what my team and I do every day. — ${sign}`,
    };
  }
  return {
    highlight: '',
    body: `No problem at all, ${name}. Thanks for taking a look. Your details will be deleted from my system within ${config.declineRetentionDays} days. — ${sign}`,
  };
}

export function sendLinks(channel, contact, body) {
  const text = encodeURIComponent(body);
  if (channel === 'whatsapp') {
    const phone = digitsOnly(contact.whatsapp || contact.phone);
    return { open: phone ? `https://wa.me/${phone}?text=${text}` : `https://wa.me/?text=${text}` };
  }
  if (channel === 'email') {
    return { open: `mailto:${contact.email || ''}?subject=${encodeURIComponent('A small gift for you')}&body=${text}` };
  }
  return { open: contact.linkedinUrl || 'https://www.linkedin.com/messaging/' };
}
