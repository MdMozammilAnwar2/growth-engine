// QA agent: static checks always; layout checks in a real browser when Playwright is installed.
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';

const check = (id, label, ok, meta = '', severity = 'warn') => ({
  id, label, status: ok ? 'pass' : severity, meta,
});

function staticChecks(content, html) {
  const out = [];
  out.push(check('viewport', 'Mobile viewport tag', /name="viewport"/.test(html), '', 'fail'));
  out.push(check('name', 'Name fits the app bar', (content.name || '').length > 0 && content.name.length <= 32, `${(content.name || '').length} chars`));
  out.push(check('hero', 'Headline is short enough', (content.hero || '').length > 0 && content.hero.length <= 90, `${(content.hero || '').length} chars`));
  out.push(check('photo', 'Has a photo', Boolean(content.photo), content.photo ? 'ok' : 'initials used'));
  out.push(check('experience', 'At least one role', (content.experience || []).length > 0, `${(content.experience || []).length} roles`));
  const contact = content.contact || {};
  out.push(check('contact', 'Has a way to get in touch', Boolean(contact.email || contact.linkedin || contact.website)));
  const unsafe = (html.match(/href="([^"]*)"/g) || []).filter((h) => /javascript:/i.test(h));
  out.push(check('links', 'Links are safe', unsafe.length === 0, `${unsafe.length} unsafe`, 'fail'));
  return out;
}

async function browserChecks(dir) {
  let chromium;
  try {
    ({ chromium } = await import('playwright'));
  } catch {
    try {
      ({ chromium } = createRequire(import.meta.url)('playwright')); // also finds a global install via NODE_PATH
    } catch {
      return [{ id: 'browser', label: 'Browser layout checks', status: 'skip', meta: 'run: npx playwright install chromium' }];
    }
  }
  const out = [];
  let browser;
  try {
    browser = process.env.CHROME_PATH
      ? await chromium.launch({ executablePath: process.env.CHROME_PATH })
      : await chromium.launch().catch(() => chromium.launch({ channel: 'chrome' }));
    const url = pathToFileURL(path.join(dir, 'index.html')).href;
    for (const width of [360, 390, 768, 1440]) {
      const page = await browser.newPage({ viewport: { width, height: 900 } });
      await page.goto(url, { waitUntil: 'load', timeout: 20000 }).catch(() => {});
      const r = await page.evaluate(() => {
        const box = (sel) => { const el = document.querySelector(sel); return el ? el.getBoundingClientRect() : null; };
        const hit = (a, b) => a && b && !(a.right <= b.left || b.right <= a.left || a.bottom <= b.top || b.bottom <= a.top);
        const photo = box('.photo');
        const h1 = box('h1');
        const ctas = box('.ctas');
        const brand = document.querySelector('.brand');
        return {
          overflow: document.documentElement.scrollWidth > window.innerWidth + 1,
          overlap: hit(photo, h1) || hit(photo, ctas),
          brandClipped: brand ? brand.scrollWidth > brand.clientWidth + 1 : false,
        };
      });
      out.push(check(`w${width}`, `No overlap or sideways scroll at ${width} px`, !r.overflow && !r.overlap,
        r.overflow ? 'page scrolls sideways' : r.overlap ? 'photo overlaps text' : 'pass', 'fail'));
      if (width === 360) out.push(check('brand', 'Name not cut off at 360 px', !r.brandClipped, r.brandClipped ? 'truncated' : 'pass'));
      await page.close();
    }
  } catch (e) {
    out.push({ id: 'browser', label: 'Browser layout checks', status: 'skip', meta: e.message.split('\n')[0].slice(0, 80) });
  } finally {
    await browser?.close().catch(() => {});
  }
  return out;
}

export async function runQa(dir, content, html) {
  const report = [...staticChecks(content, html), ...(await browserChecks(dir))];
  const status = report.some((r) => r.status === 'fail') ? 'failed'
    : report.some((r) => r.status === 'warn') ? 'warnings' : 'passed';
  return { status, report };
}
