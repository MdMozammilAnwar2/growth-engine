import Anthropic from '@anthropic-ai/sdk';
import { config } from '../config.js';

let client = null;
export const aiEnabled = () => Boolean(config.ai.key);

function getClient() {
  if (!client) client = new Anthropic({ apiKey: config.ai.key });
  return client;
}

/** Pull the first JSON object or array out of a model reply. */
export function parseJson(text) {
  const cleaned = String(text).replace(/```(?:json)?/gi, '').trim();
  const start = cleaned.search(/[[{]/);
  if (start === -1) throw new Error('No JSON in model reply');
  const open = cleaned[start];
  const close = open === '{' ? '}' : ']';
  const end = cleaned.lastIndexOf(close);
  return JSON.parse(cleaned.slice(start, end + 1));
}

/**
 * Ask the model for JSON.
 * @param {string} system
 * @param {Array} content  Anthropic content blocks (text / image)
 */
export async function askJson(system, content, maxTokens = 4000) {
  if (!aiEnabled()) throw new Error('ANTHROPIC_API_KEY is not set');
  const res = await getClient().messages.create({
    model: config.ai.model,
    max_tokens: maxTokens,
    system,
    messages: [{ role: 'user', content }],
  });
  const text = res.content.filter((b) => b.type === 'text').map((b) => b.text).join('\n');
  return parseJson(text);
}
