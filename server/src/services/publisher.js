// Publisher agent: one public repo per person, files committed, GitHub Pages switched on.
import fs from 'node:fs/promises';
import path from 'node:path';
import { Octokit } from '@octokit/rest';
import { config } from '../config.js';

export const githubEnabled = () => Boolean(config.github.token && config.github.owner);

function octo() {
  return new Octokit({ auth: config.github.token, userAgent: 'growth-engine' });
}

async function ensureRepo(gh, owner, repo, description) {
  try {
    await gh.repos.get({ owner, repo });
    return;
  } catch (e) {
    if (e.status !== 404) throw e;
  }
  const params = { name: repo, description, private: false, has_issues: false, has_wiki: false, auto_init: false };
  if (config.github.ownerType === 'org') await gh.repos.createInOrg({ org: owner, ...params });
  else await gh.repos.createForAuthenticatedUser(params);
}

async function putFile(gh, owner, repo, filePath, buf, message) {
  let sha;
  try {
    const { data } = await gh.repos.getContent({ owner, repo, path: filePath });
    sha = Array.isArray(data) ? undefined : data.sha;
  } catch (e) {
    if (e.status !== 404) throw e;
  }
  const { data } = await gh.repos.createOrUpdateFileContents({
    owner, repo, path: filePath, message, content: buf.toString('base64'), sha,
  });
  return data.commit.sha;
}

async function enablePages(gh, owner, repo) {
  try {
    await gh.request('POST /repos/{owner}/{repo}/pages', { owner, repo, source: { branch: 'main', path: '/' } });
  } catch (e) {
    if (e.status !== 409 && e.status !== 422) throw e; // already enabled
  }
  try {
    const { data } = await gh.request('GET /repos/{owner}/{repo}/pages', { owner, repo });
    return data.html_url;
  } catch {
    return `https://${owner}.github.io/${repo}/`;
  }
}

/**
 * @param {{slug: string, name: string, dir: string}} site
 * @returns {Promise<{repo: string, commitSha: string, pagesUrl: string}>}
 */
export async function publishToGithub({ slug, name, dir }) {
  if (!githubEnabled()) throw new Error('GitHub is not configured. Set GITHUB_TOKEN and GITHUB_OWNER in server/.env');
  const gh = octo();
  const owner = config.github.owner;
  const repo = slug;
  await ensureRepo(gh, owner, repo, `Portfolio of ${name}`);
  const files = (await fs.readdir(dir)).filter((f) => !f.startsWith('_'));
  // index.html last so Pages builds once the photo is already there
  files.sort((a, b) => (a === 'index.html') - (b === 'index.html'));
  let commitSha = '';
  for (const f of files) {
    const buf = await fs.readFile(path.join(dir, f));
    commitSha = await putFile(gh, owner, repo, f, buf, `Update ${f}`);
  }
  const pagesUrl = await enablePages(gh, owner, repo);
  return { repo: `${owner}/${repo}`, commitSha, pagesUrl };
}

export async function takedownFromGithub(fullRepo) {
  if (!githubEnabled()) throw new Error('GitHub is not configured');
  const [owner, repo] = fullRepo.split('/');
  await octo().repos.delete({ owner, repo });
}
