// The private preview link your friend opens, plus their Publish / Changes / No thanks answer.
import { Router } from 'express';
import fs from 'node:fs/promises';
import path from 'node:path';
import { Contact, Site, Consent, Message } from '../db.js';
import { ah, upload } from '../middleware.js';
import { renderPortfolio } from '../templates/portfolio.js';
import { escapeHtml as e, hashIp, log, setStatus, ensureDir, storagePath } from '../services/util.js';
import { config } from '../config.js';

export const previewRouter = Router({ strict: true }); // "/p/x" and "/p/x/" are different routes
export const consentRouter = Router();

const findSite = (token) => Site.findOne({ where: { previewToken: token } });

const consentBar = (token, name) => `
<style>
#ge-sheet{position:fixed;left:0;right:0;bottom:0;z-index:1000;background:#FAFAF7;color:#141416;border-radius:24px 24px 0 0;box-shadow:0 -18px 50px rgba(0,0,0,.35);padding:12px 20px calc(22px + env(safe-area-inset-bottom));font-family:Inter,system-ui,sans-serif;max-width:560px;margin:0 auto}
#ge-sheet *{box-sizing:border-box}
#ge-sheet .h{width:40px;height:5px;border-radius:3px;background:#D6D3CB;margin:0 auto 12px}
#ge-sheet .from{font-size:12px;font-weight:500;color:#8A4A2E;margin:0 0 6px}
#ge-sheet .t{font-family:'Instrument Serif',Georgia,serif;font-size:26px;line-height:1.08;margin:0 0 6px}
#ge-sheet p{font-size:14px;line-height:1.5;color:#55554F;margin:0 0 14px}
#ge-sheet button,#ge-sheet label.up{font:inherit;cursor:pointer;border-radius:14px;min-height:48px;font-size:15px}
#ge-sheet .pri{width:100%;border:0;background:#141416;color:#FAFAF7;font-weight:600;font-size:16px;min-height:52px}
#ge-sheet .row{display:flex;gap:10px;margin-top:10px}
#ge-sheet .sec{flex:1;border:1px solid #CFCBC1;background:transparent;color:#141416}
#ge-sheet .ter{border:0;background:transparent;color:#55554F;padding:0 14px}
#ge-sheet textarea{width:100%;border-radius:12px;border:1px solid #CFCBC1;padding:12px;font:inherit;font-size:15px;resize:none;margin-bottom:10px;background:#fff;color:#141416}
#ge-sheet label.up{display:flex;align-items:center;justify-content:center;border:1px dashed #B9B4A8;margin-bottom:10px;font-size:14px}
#ge-sheet input[type=file]{position:absolute;width:1px;height:1px;opacity:0}
#ge-sheet [hidden]{display:none!important}
#ge-sheet .min{position:absolute;top:10px;right:14px;border:0;background:transparent;min-height:36px;color:#55554F;font-size:13px}
body{padding-bottom:300px!important}
nav.tabs{display:none!important}
</style>
<div id="ge-sheet" role="dialog" aria-label="Your portfolio preview">
  <div class="h"></div>
  <button class="min" type="button" id="ge-min">Hide</button>
  <div id="ge-ask">
    <p class="from">${e(config.credit.name)} made this for you</p>
    <h2 class="t">Your portfolio, ready when you are.</h2>
    <p>Only you can see this link. Nothing goes public unless you say so.</p>
    <button class="pri" type="button" data-d="publish">Publish it</button>
    <div class="row"><button class="sec" type="button" id="ge-ch">Request changes</button><button class="ter" type="button" data-d="decline">No thanks</button></div>
  </div>
  <form id="ge-changes" hidden>
    <h2 class="t">What should change?</h2>
    <label for="ge-msg" style="font-size:13px;color:#55554F;display:block;margin-bottom:6px">Tell ${e(config.credit.name)} in your own words</label>
    <textarea id="ge-msg" rows="3" placeholder="e.g. use my newer photo, mention my MBA"></textarea>
    <label class="up" for="ge-photo" id="ge-photo-l">Upload a different photo</label>
    <input id="ge-photo" type="file" accept="image/*">
    <div class="row"><button class="sec" type="button" id="ge-back" style="flex:none;padding:0 16px">Back</button><button class="pri" type="submit">Send to ${e(config.credit.name)}</button></div>
  </form>
  <div id="ge-done" hidden><h2 class="t" id="ge-dt"></h2><p id="ge-db"></p></div>
</div>
<script>
(function(){
  var token=${JSON.stringify(token)}, base=${JSON.stringify(config.publicBaseUrl)};
  var $=function(id){return document.getElementById(id)};
  var done={publish:['You said yes.','${e(config.credit.name)} will put it live shortly and send you the link.'],changes:['Got it, thanks.','${e(config.credit.name)} will update the site and send you a fresh preview.'],decline:['No problem at all.','Thanks for taking a look, ${e(name)}. Your details will be deleted within ${config.declineRetentionDays} days.']};
  function show(id){['ge-ask','ge-changes','ge-done'].forEach(function(x){$(x).hidden=x!==id})}
  function send(d,fd){fd=fd||new FormData();fd.append('decision',d);
    return fetch(base+'/api/public/consent/'+encodeURIComponent(token),{method:'POST',body:fd}).then(function(r){if(!r.ok)throw 0;
      $('ge-dt').textContent=done[d][0];$('ge-db').textContent=done[d][1];show('ge-done')}).catch(function(){alert('Could not send. Please try again.')})}
  document.querySelectorAll('#ge-sheet [data-d]').forEach(function(b){b.onclick=function(){send(b.getAttribute('data-d'))}});
  $('ge-ch').onclick=function(){show('ge-changes')};$('ge-back').onclick=function(){show('ge-ask')};
  $('ge-photo').onchange=function(){if(this.files[0])$('ge-photo-l').textContent='Photo selected: '+this.files[0].name};
  $('ge-changes').onsubmit=function(ev){ev.preventDefault();var fd=new FormData();fd.append('message',$('ge-msg').value);if($('ge-photo').files[0])fd.append('photo',$('ge-photo').files[0]);send('changes',fd)};
  $('ge-min').onclick=function(){var s=$('ge-sheet');var h=s.dataset.min==='1';s.dataset.min=h?'0':'1';s.style.transform=h?'':'translateY(calc(100% - 44px))';this.textContent=h?'Hide':'Show'};
})();
</script>`;

// GET /p/:token  -> redirect to trailing slash so relative photo paths work
previewRouter.get('/:token', (req, res) => res.redirect(301, `${req.baseUrl}/${encodeURIComponent(req.params.token)}/${req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : ''}`));

previewRouter.get('/:token/', ah(async (req, res) => {
  const site = await findSite(req.params.token);
  if (!site?.outputDir) return res.status(404).type('html').send('<h1 style="font-family:system-ui">This preview link is no longer active.</h1>');
  const contact = await Contact.findByPk(site.contactId);
  const framed = req.query.frame === '1'; // dashboard studio view: no consent sheet
  const open = !framed && !['published', 'declined'].includes(contact.status);
  const html = renderPortfolio(site.content, {
    extraHead: '<meta name="robots" content="noindex,nofollow">',
    extraBody: open ? consentBar(req.params.token, contact.fullName.split(' ')[0]) : '',
  });
  if (!framed) {
    const msg = await Message.findOne({ where: { contactId: contact.id, templateKey: 'preview', status: 'sent' } });
    if (msg && !msg.replyReceivedAt) await log(contact.id, 'person', 'preview_opened', `${contact.fullName} opened the preview`);
  }
  res.set('X-Robots-Tag', 'noindex, nofollow');
  res.set('Cache-Control', 'no-store');
  res.type('html').send(html);
}));

previewRouter.get('/:token/:file', ah(async (req, res) => {
  const site = await findSite(req.params.token);
  if (!site?.outputDir) return res.status(404).end();
  const file = path.basename(req.params.file);
  if (!/^photo\.(jpg|jpeg|png|webp|gif)$/i.test(file)) return res.status(404).end();
  res.sendFile(path.join(site.outputDir, file));
}));

// POST /api/public/consent/:token
consentRouter.post('/consent/:token', upload.single('photo'), ah(async (req, res) => {
  const site = await findSite(req.params.token);
  if (!site) return res.status(404).json({ error: 'Link not found' });
  const decision = req.body?.decision;
  if (!['publish', 'changes', 'decline'].includes(decision)) return res.status(400).json({ error: 'Unknown answer' });
  const contact = await Contact.findByPk(site.contactId);
  if (['published', 'declined'].includes(contact.status)) return res.status(409).json({ error: 'Already answered' });

  await Consent.create({
    siteId: site.id, decision, message: String(req.body?.message || '').slice(0, 2000), ipHash: hashIp(req.ip),
  });
  if (req.file) {
    const dir = await ensureDir(storagePath('uploads', contact.id));
    const dest = path.join(dir, `photo-from-person${path.extname(req.file.path)}`);
    await fs.rename(req.file.path, dest);
    contact.photoPath = dest;
    await contact.save();
  }
  const status = { publish: 'consented', changes: 'changes_requested', decline: 'declined' }[decision];
  await setStatus(contact, status);
  // Any answer counts as a reply
  const m = await Message.findOne({ where: { contactId: contact.id, status: 'sent' }, order: [['sentAt', 'DESC']] });
  if (m && !m.replyReceivedAt) { m.replyReceivedAt = new Date(); await m.save(); }
  const text = {
    publish: `${contact.fullName} tapped "Publish it"`,
    changes: `${contact.fullName} asked for changes${req.file ? ' and sent a new photo' : ''}`,
    decline: `${contact.fullName} said no thanks`,
  }[decision];
  await log(contact.id, 'person', `consent_${decision}`, text, { message: req.body?.message || '' });
  res.json({ ok: true });
}));
