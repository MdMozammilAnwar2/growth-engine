// Portfolio template: editorial layout (numbered sections, serif display type, timeline,
// dark band, slide-down mobile drawer). One layout, three palettes.
// Rules that keep it safe on every screen size:
//  - photo sits in its own grid cell with a fixed aspect ratio + object-fit: cover (never overlaps text)
//  - fluid type via clamp(), no fixed widths, long words wrap
//  - content is visible without JS; reveal animation only runs when JS adds .js to <html>
// QA relies on: .brand, h1, .ctas, .photo
import { escapeHtml as e } from '../services/util.js';

const FONTS = 'family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;1,400;1,500&family=DM+Sans:wght@400;500;600;700';

const THEMES = {
  // Warm paper, deep teal ink, clay accent (the reference look)
  aurora: {
    vars: `--paper:#F5F2EB;--paper-2:#EAEDE5;--ink:#203B43;--ink-2:#31545C;--muted:#5F706D;--soft:#8A9C91;--sage:#C7D3C9;--line:#DCDDD5;--line-2:#C9D0C7;--clay:#B8765D;--card:rgba(255,255,255,.4);--on-ink:#FFFFFF;--art-a:#DCE3DA;--art-b:#B6C7BD;`,
  },
  // Dark editorial
  monolith: {
    vars: `--paper:#121416;--paper-2:#1A1D20;--ink:#ECE8DF;--ink-2:#FFFFFF;--muted:#A5A9A6;--soft:#C9B9A0;--sage:#C9B9A0;--line:#2A2E31;--line-2:#363B3F;--clay:#E0906F;--card:rgba(255,255,255,.03);--on-ink:#121416;--art-a:#1E2326;--art-b:#2C3539;`,
  },
  // Navy + gold
  folio: {
    vars: `--paper:#F4F3EF;--paper-2:#E7E9EF;--ink:#16233F;--ink-2:#24365E;--muted:#5C6478;--soft:#7D8BAA;--sage:#C9D3E8;--line:#DADCE3;--line-2:#C5CAD6;--clay:#B08A3E;--card:rgba(255,255,255,.5);--on-ink:#FFFFFF;--art-a:#DDE2EC;--art-b:#B9C4DB;`,
  },
};

export const TEMPLATE_IDS = Object.keys(THEMES);

const safeUrl = (u) => {
  const s = String(u || '').trim();
  if (!s) return '';
  if (/^(https?:|mailto:|tel:)/i.test(s)) return s;
  if (/^[\w.-]+\.[a-z]{2,}/i.test(s)) return `https://${s}`;
  return '';
};

const initials = (name) => String(name || '?').split(/\s+/).filter(Boolean).map((w) => w[0]).slice(0, 2).join('').toUpperCase();
const pad = (n) => String(n).padStart(2, '0');

// Italicise the tail of a headline: "Building the next useful thing." -> last 1-2 words emphasised.
function emphasise(text) {
  const words = String(text || '').trim().split(/\s+/).filter(Boolean);
  if (words.length < 3) return e(words.join(' '));
  const n = words.length > 6 ? 2 : 1;
  return `${e(words.slice(0, -n).join(' '))} <em>${e(words.slice(-n).join(' '))}</em>`;
}

const ARROW = '<span aria-hidden="true">↗</span>';

export function renderPortfolio(content, { extraHead = '', extraBody = '' } = {}) {
  const t = THEMES[content.templateId] || THEMES.aurora;
  const c = content;
  const name = c.name || '';
  const mono = initials(name);
  const email = c.contact?.email ? `mailto:${c.contact.email}` : '';
  const linkedin = safeUrl(c.contact?.linkedin);
  const website = safeUrl(c.contact?.website);
  const primaryCta = email || linkedin || website;
  const tagline = c.eyebrow || '';
  const city = String(c.location || '').trim();
  const current = (c.experience || [])[0];

  const exp = c.experience || [];
  const projects = (c.projects || []).filter((p) => p && p.name);
  const skills = c.skills || [];
  const edu = c.education || [];
  const certs = c.certifications || [];

  // Section numbering follows whatever sections exist.
  let n = 0;
  const num = () => pad(++n);
  const S = {};
  if (c.about) S.about = num();
  if (exp.length) S.experience = num();
  if (projects.length) S.work = num();
  if (skills.length) S.skills = num();
  if (edu.length || certs.length) S.education = num();
  S.contact = num();

  const navItems = [
    S.about && ['#about', 'About'],
    S.experience && ['#experience', 'Experience'],
    S.work && ['#work', 'Selected work'],
    S.skills && ['#skills', 'Skills'],
    S.education && ['#education', 'Education'],
  ].filter(Boolean);
  const desktopNav = navItems.map(([h, l]) => `<a class="nav-link" href="${h}">${l}</a>`).join('');
  const mobileNav = navItems.map(([h, l]) => `<a class="m-link" href="${h}">${l}<span aria-hidden="true">→</span></a>`).join('');

  const photo = c.photo
    ? `<img src="${e(c.photo)}" alt="Photo of ${e(name)}" width="640" height="760" loading="eager" decoding="async">`
    : `<div class="art" aria-hidden="true"><span class="art-sun"></span><span class="art-arch"></span><span class="art-line"></span><span class="art-mono">${e(mono)}</span></div>`;

  const metaRow = [
    city && `<span class="meta-dot"><i></i>${e(city)}</span>`,
    current?.company && `<span>Currently at ${e(current.company)}</span>`,
    exp.length > 1 && `<span>${exp.length} roles</span>`,
  ].filter(Boolean).join('');

  const aboutParas = String(c.about || '').split(/\n{2,}/).filter(Boolean)
    .map((p, i) => `<p class="${i ? 'body' : 'lead'}">${e(p)}</p>`).join('');

  const timeline = exp.map((x) => `
        <article class="tl reveal">
          ${x.period ? `<p class="tl-date">${e(x.period)}</p>` : ''}
          <h3 class="serif tl-org">${e(x.company || x.title)}</h3>
          <p class="tl-role">${e([x.company ? x.title : '', x.location].filter(Boolean).join(' · '))}</p>
          ${x.summary ? `<p class="tl-sum">${e(x.summary)}</p>` : ''}
        </article>`).join('');

  const glyphs = ['✳', '↗', '◇', '○', '△', '✦'];
  const projectCards = projects.map((p, i) => {
    const url = safeUrl(p.url);
    const title = url ? `<a href="${e(url)}" rel="noopener" target="_blank">${e(p.name)} ${ARROW}</a>` : e(p.name);
    return `
        <article class="proj reveal">
          <div class="proj-top"><span class="eyebrow clay">${pad(i + 1)} / Project</span><span class="serif proj-glyph" aria-hidden="true">${glyphs[i % glyphs.length]}</span></div>
          <h3 class="serif proj-title">${title}</h3>
          ${p.description ? `<p class="proj-desc">${e(p.description)}</p>` : '<p class="proj-desc"></p>'}
        </article>`;
  }).join('');

  const tags = skills.map((s) => `<li class="tag">${e(s)}</li>`).join('');

  const eduItems = edu.map((x) => `
          <div class="edu reveal">
            ${[x.start, x.end].filter(Boolean).length ? `<p class="eyebrow muted">${e([x.start, x.end].filter(Boolean).join(' — '))}</p>` : ''}
            <h3 class="serif edu-deg">${e(x.degree || x.school)}</h3>
            ${x.degree ? `<p class="edu-school">${e(x.school)}</p>` : ''}
          </div>`).join('');
  const certItems = certs.map((x) => `<li>${e(x.name)}${x.issuer ? ` <span>· ${e(x.issuer)}</span>` : ''}</li>`).join('');

  const contactRows = [
    email && `<a class="c-row" href="${e(email)}"><span><span class="c-k">Email</span><span class="c-v">${e(c.contact.email)}</span></span><span class="c-arr" aria-hidden="true">↗</span></a>`,
    linkedin && `<a class="c-row" href="${e(linkedin)}" target="_blank" rel="noopener"><span><span class="c-k">LinkedIn</span><span class="c-v">Connect professionally</span></span><span class="c-arr" aria-hidden="true">↗</span></a>`,
    website && `<a class="c-row" href="${e(website)}" target="_blank" rel="noopener"><span><span class="c-k">Website</span><span class="c-v">${e(website.replace(/^https?:\/\//, '').replace(/\/$/, ''))}</span></span><span class="c-arr" aria-hidden="true">↗</span></a>`,
  ].filter(Boolean).join('');

  const creditUrl = safeUrl(c.credit?.url);
  const themeColor = (t.vars.match(/--paper:([^;]+)/) || [])[1] || '#F5F2EB';

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${e(name)}${tagline ? ` — ${e(tagline)}` : ''}</title>
<meta name="description" content="${e(c.hero)}">
<meta property="og:title" content="${e(name)}">
<meta property="og:description" content="${e(c.hero)}">
<meta name="theme-color" content="${themeColor}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?${FONTS}&display=swap" rel="stylesheet">
<script>document.documentElement.classList.add('js')</script>
<style>
:root{${t.vars}--max:1240px;--gut:clamp(18px,4.5vw,44px)}
*{box-sizing:border-box}
html{scroll-behavior:smooth;scroll-padding-top:84px;-webkit-text-size-adjust:100%}
html,body{max-width:100%;overflow-x:clip}
body{margin:0;background:var(--paper);color:var(--ink);font-family:'DM Sans',system-ui,sans-serif;font-size:16px;line-height:1.6;-webkit-font-smoothing:antialiased}
::selection{background:var(--sage);color:var(--ink)}
a{color:inherit;text-decoration:none}
img{max-width:100%;display:block}
p,h1,h2,h3,a,span,li{overflow-wrap:break-word}
h1,h2,h3{margin:0;font-weight:500}
ul{list-style:none;margin:0;padding:0}
.serif,h1,h2{font-family:'Cormorant Garamond',Georgia,serif}
em{font-style:italic;font-weight:400;color:var(--soft)}
.wrap{width:100%;max-width:var(--max);margin:0 auto;padding-left:var(--gut);padding-right:var(--gut)}
.eyebrow{letter-spacing:.19em;text-transform:uppercase;font-size:.68rem;font-weight:700;margin:0}
.clay{color:var(--clay)}.muted{color:var(--muted)}
.rule{height:1px;background:var(--line)}
a:focus-visible,button:focus-visible{outline:3px solid var(--clay);outline-offset:4px}

/* Buttons */
.btn{display:inline-flex;align-items:center;justify-content:center;gap:.6rem;min-height:48px;padding:13px 20px;border-radius:3px;font-size:.8rem;font-weight:700;letter-spacing:.01em;transition:transform .2s,background .2s,border-color .2s;border:1px solid var(--ink);background:var(--ink);color:var(--on-ink);cursor:pointer;font-family:inherit}
.btn:hover{background:var(--ink-2);transform:translateY(-2px)}
.btn.ghost{background:transparent;color:var(--ink);border-color:var(--line-2)}
.btn.ghost:hover{border-color:var(--ink);background:var(--paper-2)}

/* Header */
header.bar{position:sticky;top:0;z-index:50;background:color-mix(in srgb,var(--paper) 94%,transparent);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);border-bottom:1px solid var(--line)}
header.bar nav.main{display:flex;align-items:center;justify-content:space-between;gap:16px;min-height:72px}
.brand{display:flex;align-items:center;gap:12px;min-width:0;flex:0 1 auto}
.mono{flex:0 0 auto;display:flex;align-items:center;justify-content:center;width:40px;height:40px;border:1px solid color-mix(in srgb,var(--ink) 30%,transparent);font-family:'Cormorant Garamond',serif;font-size:1.2rem}
.brand-txt{display:flex;flex-direction:column;min-width:0;line-height:1.2}
.brand-name{font-size:.9rem;font-weight:700;letter-spacing:.01em}
.brand-tag{margin-top:3px;font-size:9px;letter-spacing:.18em;text-transform:uppercase;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.d-nav{display:flex;align-items:center;gap:clamp(16px,2.2vw,28px);font-size:.78rem;font-weight:600}
.nav-link{position:relative;color:var(--muted);transition:color .2s}
.nav-link:after{content:'';position:absolute;left:0;bottom:-7px;width:0;height:1px;background:var(--clay);transition:width .25s}
.nav-link:hover{color:var(--ink)}.nav-link:hover:after{width:100%}
.d-nav .btn{min-height:42px;padding:10px 16px}
#menuBtn{display:none;flex:0 0 44px;width:44px;height:44px;align-items:center;justify-content:center;border:1px solid var(--line);border-radius:8px;background:color-mix(in srgb,var(--paper) 60%,#fff 40%);color:var(--ink);cursor:pointer}
#menuBtn .x{display:none}#menuBtn[aria-expanded="true"] .x{display:block}#menuBtn[aria-expanded="true"] .h{display:none}
.m-menu{display:none}

/* Hero */
.hero{display:grid;grid-template-columns:minmax(0,1.08fr) minmax(0,.92fr);gap:clamp(28px,5vw,64px);align-items:center;padding-top:clamp(36px,7vw,84px);padding-bottom:clamp(40px,7vw,84px)}
.hero .eyebrow{display:flex;align-items:center;gap:12px;margin-bottom:24px}
.hero .eyebrow i{display:inline-block;width:36px;height:1px;background:var(--clay)}
h1{font-size:clamp(2.9rem,7.4vw,6.2rem);line-height:.96;letter-spacing:-.035em;max-width:14ch}
.hero-lead{margin:28px 0 0;max-width:36rem;font-size:clamp(1rem,1.4vw,1.12rem);line-height:1.75;color:var(--muted)}
.ctas{display:flex;flex-wrap:wrap;gap:12px;margin-top:32px}
.meta{display:flex;flex-wrap:wrap;align-items:center;gap:10px 28px;margin-top:44px;padding-top:20px;border-top:1px solid var(--line);font-size:.78rem;color:var(--muted)}
.meta-dot{display:inline-flex;align-items:center;gap:8px}.meta-dot i{width:6px;height:6px;border-radius:50%;background:var(--clay)}
.photo{position:relative;width:100%;aspect-ratio:4/5;max-height:640px;overflow:hidden;background:var(--art-a)}
.photo img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:center 22%}
.photo.has-img:after{content:'';position:absolute;inset:0;background:linear-gradient(to top,color-mix(in srgb,var(--ink) 58%,transparent),transparent 45%);pointer-events:none;z-index:2}
.photo-label{position:absolute;z-index:3;left:7%;right:7%;bottom:7%;color:#fff;font-size:.66rem;letter-spacing:.18em;text-transform:uppercase}
.photo-badge{position:absolute;z-index:3;right:16px;top:16px;max-width:70%;padding:8px 12px;border:1px solid rgba(255,255,255,.5);background:color-mix(in srgb,var(--paper) 88%,transparent);color:var(--ink);font-size:9px;letter-spacing:.2em;text-transform:uppercase}
.art{position:absolute;inset:0}
.art:before{content:'';position:absolute;width:72%;aspect-ratio:1;border-radius:50%;background:var(--art-b);right:-8%;top:6%}
.art:after{content:'';position:absolute;width:50%;aspect-ratio:1;border-radius:50%;border:1px solid color-mix(in srgb,var(--ink) 35%,transparent);right:5%;top:17%}
.art-arch{position:absolute;z-index:1;bottom:-4%;left:15%;width:60%;height:77%;border-radius:999px 999px 0 0;background:var(--ink)}
.art-arch:before{content:'';position:absolute;width:70%;height:70%;border-radius:999px 999px 0 0;left:15%;top:12%;background:var(--sage)}
.art-sun{position:absolute;z-index:2;width:19%;aspect-ratio:1;border-radius:50%;background:var(--clay);top:19%;left:19%}
.art-line{position:absolute;z-index:3;height:1px;width:50%;background:color-mix(in srgb,var(--ink) 50%,transparent);right:0;top:47%;transform:rotate(-40deg)}
.art-mono{position:absolute;z-index:2;left:15%;width:60%;bottom:18%;text-align:center;font-family:'Cormorant Garamond',serif;font-size:clamp(3rem,8vw,5.5rem);color:var(--ink)}

/* Sections */
section{padding-top:clamp(56px,8vw,96px);padding-bottom:clamp(56px,8vw,96px);scroll-margin-top:76px}
.band{background:var(--paper-2)}
.dark{background:var(--ink);color:var(--on-ink)}
.dark em,.dark .eyebrow{color:var(--sage)}
.head{display:flex;flex-direction:column;gap:18px}
.head h2,.split h2{margin-top:16px;font-size:clamp(2.3rem,5vw,3.75rem);line-height:1.05;letter-spacing:-.01em}
.head-row{display:flex;flex-wrap:wrap;align-items:flex-end;justify-content:space-between;gap:20px}
.head-row > p{max-width:28rem;margin:0;font-size:.9rem;line-height:1.65;color:var(--muted)}
.split{display:grid;grid-template-columns:minmax(0,.7fr) minmax(0,1.3fr);gap:clamp(32px,6vw,80px)}
.lead{margin:0;font-size:clamp(1.05rem,1.6vw,1.2rem);line-height:1.8}
.body{margin:20px 0 0;line-height:1.75;color:var(--muted)}
.ulink{display:inline-flex;align-items:center;gap:8px;margin-top:28px;padding-bottom:4px;border-bottom:1px solid var(--clay);font-size:.85rem;font-weight:700}

/* Timeline */
.tl{position:relative;padding:0 0 36px 28px;border-left:1px solid var(--line-2)}
.tl:before{content:'';position:absolute;left:-5px;top:7px;width:9px;height:9px;border-radius:50%;background:var(--clay)}
.tl:last-child{border-left-color:transparent;padding-bottom:0}
.tl-date{margin:0;font-size:.72rem;letter-spacing:.15em;text-transform:uppercase;color:var(--clay)}
.tl-org{margin-top:6px;font-size:clamp(1.6rem,2.6vw,1.9rem);line-height:1.15}
.tl-role{margin:4px 0 0;font-size:.88rem;font-weight:600}
.tl-sum{margin:12px 0 0;max-width:38rem;font-size:.9rem;line-height:1.7;color:var(--muted)}

/* Projects */
.projs{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,300px),1fr));gap:20px;margin-top:48px}
.proj{display:flex;flex-direction:column;padding:clamp(22px,3vw,28px);border:1px solid var(--line);background:var(--card);transition:transform .25s,border-color .25s}
.proj:hover{transform:translateY(-4px);border-color:var(--line-2)}
.proj-top{display:flex;align-items:center;justify-content:space-between;gap:12px}
.proj-glyph{font-size:1.9rem;color:var(--soft);line-height:1}
.proj-title{margin-top:32px;font-size:clamp(1.6rem,2.4vw,1.9rem);line-height:1.15}
.proj-title a:hover{color:var(--clay)}
.proj-desc{flex:1;margin:14px 0 0;font-size:.9rem;line-height:1.7;color:var(--muted)}

/* Skills */
.tags{display:flex;flex-wrap:wrap;gap:8px;margin-top:36px}
.tag{display:inline-flex;padding:9px 13px;border:1px solid var(--line-2);border-radius:2px;font-size:.78rem;color:var(--ink);transition:border-color .2s,background .2s}
.tag:hover{border-color:var(--clay);background:color-mix(in srgb,var(--clay) 8%,transparent)}
.dark .tag{color:var(--on-ink);border-color:color-mix(in srgb,var(--on-ink) 25%,transparent)}

/* Education */
.edus{display:grid;gap:28px}
.edu{border-top:1px solid var(--line-2);padding-top:20px}
.edu-deg{margin-top:8px;font-size:clamp(1.6rem,2.6vw,1.9rem);line-height:1.15}
.edu-school{margin:6px 0 0;font-size:.9rem;color:var(--muted)}
.certs{margin-top:8px;border-top:1px solid var(--line-2);padding-top:20px}
.certs li{padding:6px 0;font-size:.92rem}.certs li span{color:var(--muted)}

/* Contact */
.contact{display:grid;grid-template-columns:minmax(0,1.1fr) minmax(0,.9fr);gap:clamp(32px,6vw,80px);align-items:end}
.contact h2{margin-top:16px;font-size:clamp(2.6rem,6.4vw,4.75rem);line-height:.98;max-width:13ch}
.contact .lead{margin-top:24px;max-width:30rem;color:var(--muted);font-size:1rem}
.c-list{border-top:1px solid var(--line)}
.c-row{display:flex;align-items:center;justify-content:space-between;gap:16px;min-height:72px;padding:16px 0;border-bottom:1px solid var(--line)}
.c-row > span:first-child{min-width:0}
.c-k{display:block;font-size:.72rem;color:var(--muted)}
.c-v{display:block;margin-top:4px;font-size:.92rem;font-weight:700;overflow-wrap:anywhere}
.c-arr{font-size:1.3rem;transition:transform .2s}.c-row:hover .c-arr{transform:translate(3px,-3px);color:var(--clay)}
.c-note{margin:20px 0 0;font-size:.78rem;color:var(--muted)}

/* Footer */
footer{border-top:1px solid var(--line)}
footer .wrap{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:16px;padding-top:28px;padding-bottom:calc(28px + env(safe-area-inset-bottom));font-size:.76rem;color:var(--muted)}
footer .f-brand{display:flex;align-items:center;gap:10px;font-weight:700;color:var(--ink)}
footer .f-brand .mono{width:32px;height:32px;font-size:1rem}
footer .f-links{display:flex;flex-wrap:wrap;gap:20px}
footer a:hover,footer button:hover{color:var(--ink)}
footer button{font:inherit;color:inherit;background:none;border:0;padding:0;cursor:pointer}
footer .credit a{color:var(--ink);text-decoration:underline;text-underline-offset:3px}

/* Reveal (JS only) */
.js .reveal{opacity:0;transform:translateY(18px);transition:opacity .7s ease,transform .7s ease}
.js .reveal.in{opacity:1;transform:none}

/* Tablet */
@media (max-width:1023px){
  .d-nav .nav-link{font-size:.72rem}
  .hero{grid-template-columns:minmax(0,1fr) minmax(0,.85fr)}
}
/* Mobile */
@media (max-width:860px){
  .d-nav{display:none}
  #menuBtn{display:inline-flex}
  header.bar nav.main{min-height:66px}
  .m-menu.open{display:flex;flex-direction:column;position:absolute;top:100%;left:0;right:0;padding:8px var(--gut) 18px;background:var(--paper);border-bottom:1px solid var(--line);box-shadow:0 18px 28px rgba(0,0,0,.10)}
  .m-link{display:flex;align-items:center;justify-content:space-between;min-height:52px;border-bottom:1px solid var(--line);font-size:.95rem;font-weight:500}
  .m-menu .btn{margin-top:16px}
  .hero{grid-template-columns:minmax(0,1fr)}
  .photo{aspect-ratio:4/4.4;max-height:520px}
  .split,.contact{grid-template-columns:minmax(0,1fr)}
}
@media (max-width:560px){
  .brand-name{font-size:.82rem}
  .brand-tag{font-size:8px;letter-spacing:.12em}
  .mono{width:36px;height:36px}
  .hero{padding-top:28px}
  .hero .eyebrow{font-size:.62rem;letter-spacing:.15em;margin-bottom:18px}
  .ctas .btn{flex:1 1 150px}
  .photo{aspect-ratio:1/1.08}
  .tl{padding-left:20px}
  .meta{margin-top:32px}
}
@media (prefers-reduced-motion:reduce){*,*:before,*:after{scroll-behavior:auto!important;transition:none!important;animation:none!important}.js .reveal{opacity:1;transform:none}}
@media print{header.bar,.ctas,footer .f-links{display:none!important}.js .reveal{opacity:1!important;transform:none!important}section{break-inside:avoid}body{background:#fff}}
</style>
${extraHead}
</head>
<body>
<header class="bar">
  <nav class="main wrap" aria-label="Main navigation">
    <a class="brand" href="#home" aria-label="${e(name)} — home">
      <span class="mono">${e(mono)}</span>
      <span class="brand-txt"><span class="brand-name">${e(name)}</span>${tagline ? `<span class="brand-tag">${e(tagline)}</span>` : ''}</span>
    </a>
    <div class="d-nav">
      ${desktopNav}
      <a class="btn" href="#contact">Let's connect ${ARROW}</a>
    </div>
    <button id="menuBtn" type="button" aria-label="Open menu" aria-expanded="false" aria-controls="mMenu">
      <svg class="h" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"/></svg>
      <svg class="x" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>
    </button>
  </nav>
  <div id="mMenu" class="m-menu">
    ${mobileNav}
    <a class="btn m-link-cta" href="#contact">Let's connect ${ARROW}</a>
  </div>
</header>

<main>
  <div id="home" class="wrap hero">
    <div class="reveal">
      ${tagline ? `<p class="eyebrow clay"><i></i>${e(tagline)}</p>` : ''}
      <h1>${emphasise(c.hero || name)}</h1>
      <p class="hero-lead">I'm ${e(name)}${current?.title ? ` — ${e(current.title)}${current.company ? ` at ${e(current.company)}` : ''}` : ''}.</p>
      <div class="ctas">
        ${primaryCta ? `<a class="btn" href="${e(primaryCta)}">Let's work together ${ARROW}</a>` : ''}
        ${exp.length ? '<a class="btn ghost" href="#experience">See my experience <span aria-hidden="true">↓</span></a>' : ''}
      </div>
      ${metaRow ? `<div class="meta">${metaRow}</div>` : ''}
    </div>
    <div class="photo reveal${c.photo ? ' has-img' : ''}">
      ${photo}
      ${c.photo && tagline ? `<span class="photo-badge">${e(tagline.split('·')[0].trim())}</span>` : ''}
      ${c.photo ? `<span class="photo-label">${e(name)}</span>` : ''}
    </div>
  </div>
  <div class="wrap"><div class="rule"></div></div>

  ${S.about ? `
  <section id="about">
    <div class="wrap split">
      <div class="reveal"><p class="eyebrow clay">${S.about} / About</p><h2>A little about <em>me.</em></h2></div>
      <div class="reveal" style="max-width:46rem">
        ${aboutParas}
        ${linkedin ? `<a class="ulink" href="${e(linkedin)}" target="_blank" rel="noopener">Connect on LinkedIn ${ARROW}</a>` : ''}
      </div>
    </div>
  </section>` : ''}

  ${S.experience ? `
  <section id="experience" class="band">
    <div class="wrap split">
      <div class="reveal"><p class="eyebrow clay">${S.experience} / Experience</p><h2>Learning by <em>building.</em></h2></div>
      <div style="padding-top:8px">${timeline}
      </div>
    </div>
  </section>` : ''}

  ${S.work ? `
  <section id="work">
    <div class="wrap">
      <div class="head-row reveal"><div><p class="eyebrow clay">${S.work} / Selected work</p><h2 class="serif" style="margin-top:16px;font-size:clamp(2.3rem,5vw,3.75rem);line-height:1.05">Complex problems, <em>practical outcomes.</em></h2></div></div>
      <div class="projs">${projectCards}
      </div>
    </div>
  </section>` : ''}

  ${S.skills ? `
  <section id="skills" class="dark">
    <div class="wrap">
      <div class="reveal"><p class="eyebrow">${S.skills} / Skills</p><h2 class="serif" style="margin-top:16px;font-size:clamp(2.3rem,5vw,3.75rem);line-height:1.05">The <em>toolkit.</em></h2></div>
      <ul class="tags reveal">${tags}</ul>
    </div>
  </section>` : ''}

  ${S.education ? `
  <section id="education" class="band">
    <div class="wrap split">
      <div class="reveal"><p class="eyebrow clay">${S.education} / Education</p><h2>Foundations &amp; <em>learning.</em></h2></div>
      <div class="edus">${eduItems}
        ${certItems ? `<ul class="certs reveal"><li class="eyebrow muted" style="padding-bottom:8px">Certifications</li>${certItems}</ul>` : ''}
      </div>
    </div>
  </section>` : ''}

  <section id="contact">
    <div class="wrap contact">
      <div class="reveal"><p class="eyebrow clay">${S.contact} / Contact</p><h2>Have a meaningful problem to <em>solve?</em></h2><p class="lead">Open to conversations about new roles, projects and collaborations.</p></div>
      <div class="reveal">
        ${contactRows ? `<div class="c-list">${contactRows}</div>` : '<p class="lead">Contact details coming soon.</p>'}
        ${city ? `<p class="c-note">${e(city)}</p>` : ''}
      </div>
    </div>
  </section>
</main>

<footer>
  <div class="wrap">
    <a class="f-brand" href="#home"><span class="mono">${e(mono)}</span>${e(name)}</a>
    <span class="credit">© ${e(c.year)} · Crafted by ${creditUrl ? `<a href="${e(creditUrl)}" rel="noopener">${e(c.credit?.name)}</a>` : e(c.credit?.name || '')}${c.credit?.line ? ` · ${e(c.credit.line)}` : ''}</span>
    <span class="f-links"><a href="#home">Back to top ↑</a><button type="button" onclick="window.print()">Print / Save PDF</button></span>
  </div>
</footer>
<script>
(function(){
  var b=document.getElementById('menuBtn'),m=document.getElementById('mMenu');
  function set(o){m.classList.toggle('open',o);b.setAttribute('aria-expanded',String(o));b.setAttribute('aria-label',o?'Close menu':'Open menu')}
  b.addEventListener('click',function(){set(!m.classList.contains('open'))});
  m.querySelectorAll('a').forEach(function(a){a.addEventListener('click',function(){set(false)})});
  document.addEventListener('keydown',function(ev){if(ev.key==='Escape')set(false)});
  var els=document.querySelectorAll('.reveal');
  if(!('IntersectionObserver' in window)){els.forEach(function(el){el.classList.add('in')});return}
  var io=new IntersectionObserver(function(es){es.forEach(function(en){if(en.isIntersecting){en.target.classList.add('in');io.unobserve(en.target)}})},{threshold:.12,rootMargin:'0px 0px -40px 0px'});
  els.forEach(function(el){io.observe(el)});
})();
</script>
${extraBody}
</body>
</html>`;
}
