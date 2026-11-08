// Builder agent: renders the template to static files (index.html + photo) for one site version.
import fs from 'node:fs/promises';
import path from 'node:path';
import { renderPortfolio } from '../templates/portfolio.js';
import { ensureDir, storagePath } from './util.js';

/**
 * @returns {Promise<{dir: string, photoFile: string|null, html: string}>}
 */
export async function buildSiteFiles(siteId, content, photoAbsPath) {
  const dir = await ensureDir(storagePath('sites', siteId));
  let photoFile = null;
  if (photoAbsPath) {
    const ext = path.extname(photoAbsPath).toLowerCase() || '.jpg';
    photoFile = `photo${ext}`;
    await fs.copyFile(photoAbsPath, path.join(dir, photoFile));
  }
  const html = renderPortfolio({ ...content, photo: photoFile });
  await fs.writeFile(path.join(dir, 'index.html'), html, 'utf8');
  // Stop GitHub Pages from running Jekyll on the files.
  await fs.writeFile(path.join(dir, '.nojekyll'), '');
  return { dir, photoFile, html };
}

export async function listSiteFiles(dir) {
  const names = await fs.readdir(dir);
  return names.filter((n) => !n.startsWith('_'));
}
