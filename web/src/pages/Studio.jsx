import { useEffect, useRef, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { CheckCircle2, AlertTriangle, XCircle, MinusCircle, Copy, ExternalLink, RefreshCw } from 'lucide-react';
import { api, API_BASE } from '../api.js';
import { useApi, Card, Spinner, ErrorNote, StatusPill, Button, Segmented, useToast, cx } from '../ui.jsx';

const QA_ICON = {
  pass: <CheckCircle2 className="size-4 text-ok shrink-0" />,
  warn: <AlertTriangle className="size-4 text-warn shrink-0" />,
  fail: <XCircle className="size-4 text-bad shrink-0" />,
  skip: <MinusCircle className="size-4 text-muted shrink-0" />,
};

function ScaledFrame({ src, width, height, title }) {
  const box = useRef(null);
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const el = box.current;
    if (!el) return undefined;
    const ro = new ResizeObserver(([e]) => setScale(Math.min(1, e.contentRect.width / width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, [width]);
  return (
    <div ref={box} className="w-full" style={{ height: height * scale }}>
      <iframe title={title} src={src} style={{ width, height, transform: `scale(${scale})`, transformOrigin: '0 0', border: 0 }} className="bg-white rounded-[inherit]" />
    </div>
  );
}

export default function Studio() {
  const { id } = useParams();
  const nav = useNavigate();
  const toast = useToast();
  const { data: c, error, reload } = useApi(`/api/contacts/${id}`);
  const [view, setView] = useState(() => (window.innerWidth < 1024 ? 'phone' : 'both'));
  const [busy, setBusy] = useState('');
  const [tpl, setTpl] = useState('');
  const [tone, setTone] = useState('');
  const [nonce, setNonce] = useState(0);

  if (error) return <ErrorNote error={error} />;
  if (!c) return <Spinner />;
  if (!c.site) {
    return (
      <div className="flex flex-col gap-4 max-w-lg">
        <h1 className="font-display text-4xl">No site yet</h1>
        <p className="text-muted">Review {c.fullName}'s profile and build the site first.</p>
        <Button to={`/people/${id}/review`} variant="primary">Go to review</Button>
      </div>
    );
  }

  const site = c.site;
  const src = `${API_BASE}/p/${site.previewToken}/?frame=1&n=${nonce}`;
  const live = c.deployments.find((d) => d.status === 'live');
  const counted = site.qaReport.filter((r) => r.status !== 'skip');
  const passed = counted.filter((r) => r.status === 'pass').length;

  const act = async (key, fn, ok) => {
    setBusy(key);
    try { await fn(); if (ok) toast(ok); await reload(); setNonce((n) => n + 1); } catch (e) { toast(e.message, 'error'); } finally { setBusy(''); }
  };
  const rebuild = () => act('rebuild', () => api(`/api/contacts/${id}/build`, {
    method: 'POST', body: { templateId: tpl || site.templateId, tone: tone || site.content?.tone || 'confident' },
  }), 'Rebuilt and re-checked');
  const approvePreview = () => act('approve', async () => {
    await api(`/api/sites/${site.id}/approve-preview`, { method: 'POST' });
    nav(`/send?contact=${id}`);
  }, 'Preview approved. Check the message next.');
  const publish = () => act('publish', () => api(`/api/sites/${site.id}/approve-publish`, { method: 'POST' }), 'Published to GitHub Pages');
  const takedown = () => {
    if (!window.confirm(`Take ${c.fullName}'s site offline and delete its GitHub repo?`)) return;
    act('takedown', () => api(`/api/sites/${site.id}/takedown`, { method: 'POST' }), 'Site taken down');
  };
  const copyLink = async () => { await navigator.clipboard.writeText(site.previewUrl); toast('Preview link copied'); };
  const consentMsg = c.activity.find((a) => a.event?.startsWith('consent_'))?.payload?.message;

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-wrap items-center gap-3">
        <div className="flex flex-col gap-1 mr-auto min-w-0">
          <nav aria-label="Breadcrumb" className="text-[13px] text-muted flex gap-2"><Link to="/people" className="hover:text-ink">People</Link><span aria-hidden="true">/</span><Link to={`/people/${id}/review`} className="hover:text-ink truncate">{c.fullName}</Link></nav>
          <h1 className="text-[22px] font-semibold tracking-tight flex flex-wrap items-center gap-2.5">{c.fullName}
            <span className="text-xs font-mono text-muted border border-line-2 rounded-md px-2 py-0.5 capitalize">{site.templateId} · v{site.version}</span>
            <StatusPill status={c.status} />
          </h1>
        </div>
        <Segmented label="Preview size" value={view} onChange={setView}
          options={[{ value: 'both', label: 'Both' }, { value: 'desktop', label: 'Desktop' }, { value: 'phone', label: 'Phone' }]} />
      </header>

      {c.status === 'changes_requested' && (
        <div className="rounded-xl border border-[#4A3A1A] bg-[#1C160B] text-[#F7CF85] text-sm px-4 py-3 flex flex-wrap gap-3 items-center">
          <span className="flex-1 min-w-[200px]">They asked for changes{consentMsg ? `: “${consentMsg}”` : '.'} Edit the profile, rebuild, then approve the new preview.</span>
          <Button size="sm" to={`/people/${id}/review`}>Edit profile</Button>
        </div>
      )}
      {c.status === 'consented' && (
        <div className="rounded-xl border border-[#4A2A1A] bg-[#1F1611] text-[#FFD2C2] text-sm px-4 py-3">
          {c.fullName} tapped “Publish it”{consentMsg ? `: “${consentMsg}”` : '.'} Approve below to put it live.
        </div>
      )}

      <div className="flex flex-wrap gap-5 items-start">
        <section aria-label="Preview" className="flex-[999_1_560px] min-w-0 rounded-[18px] border border-[#1F1F25] bg-[#0D0D10] bg-[radial-gradient(#22222A_1px,transparent_1px)] [background-size:18px_18px] p-4 sm:p-8 flex flex-wrap gap-7 justify-center items-start">
          {view !== 'phone' && (
            <div className="flex-[1_1_460px] max-w-[760px] min-w-0 rounded-xl overflow-hidden border border-line-2 shadow-2xl shadow-black/60">
              <div className="h-8 bg-raise flex items-center gap-1.5 px-3"><span className="size-2.5 rounded-full bg-[#3A3A42]" /><span className="size-2.5 rounded-full bg-[#3A3A42]" /><span className="size-2.5 rounded-full bg-[#3A3A42]" /><span className="flex-1 text-center text-[11px] font-mono text-muted">preview · unlisted</span></div>
              <ScaledFrame title="Desktop preview" src={src} width={1280} height={800} />
            </div>
          )}
          {view !== 'desktop' && (
            <div className="shrink-0 w-[300px] rounded-[40px] p-2.5 bg-raise border border-line-2 shadow-2xl shadow-black/60">
              <div className="rounded-[31px] overflow-hidden"><ScaledFrame title="Phone preview" src={src} width={390} height={780} /></div>
            </div>
          )}
        </section>

        <aside className="flex-[1_1_300px] min-w-0 flex flex-col gap-4">
          <Card className="p-4 flex flex-col gap-3">
            {['built', 'reviewed'].includes(c.status) && (<>
              <Button variant="primary" size="lg" onClick={approvePreview} loading={busy === 'approve'}>Approve preview</Button>
              <p className="text-xs text-muted text-center">Nothing is sent yet. You'll check the message next.</p>
            </>)}
            {c.status === 'preview_approved' && <Button variant="primary" size="lg" to={`/send?contact=${id}`}>Write the message</Button>}
            {c.status === 'preview_sent' && (<>
              <p className="text-sm text-muted">Waiting for {c.fullName.split(' ')[0]} to answer on the preview page.</p>
              <Button onClick={() => act('reply', () => api(`/api/contacts/${id}/replied`, { method: 'POST' }), 'Marked as replied')} loading={busy === 'reply'}>They replied on WhatsApp</Button>
            </>)}
            {c.status === 'consented' && <Button variant="primary" size="lg" onClick={publish} loading={busy === 'publish'}>Approve & publish</Button>}
            {c.status === 'published' && live && (<>
              <Button variant="light" href={live.pagesUrl} target="_blank" rel="noreferrer"><ExternalLink className="size-4" />Open live site</Button>
              <Button onClick={publish} loading={busy === 'publish'}>Republish latest version</Button>
              <Button variant="danger" onClick={takedown} loading={busy === 'takedown'}>Take down</Button>
            </>)}
            <div className="flex gap-2">
              <Button size="sm" className="flex-1" onClick={copyLink}><Copy className="size-3.5" />Copy preview link</Button>
              <Button size="sm" className="flex-1" href={site.previewUrl} target="_blank" rel="noreferrer"><ExternalLink className="size-3.5" />Open</Button>
            </div>
          </Card>

          <Card className="p-4 flex flex-col gap-3">
            <div className="flex justify-between items-center">
              <h2 className="text-[15px] font-semibold">QA checks</h2>
              <span className={cx('text-xs font-mono rounded-full px-2.5 py-1', site.qaStatus === 'passed' ? 'text-ok bg-[#16231C]' : site.qaStatus === 'failed' ? 'text-bad bg-[#2A1414]' : 'text-warn bg-[#1C160B]')}>{passed} / {counted.length} passed</span>
            </div>
            {site.qaReport.map((r) => (
              <div key={r.id} className="flex items-center gap-2.5 text-[13px]">{QA_ICON[r.status]}<span className="flex-1">{r.label}</span><span className="font-mono text-xs text-muted truncate max-w-[40%]">{r.meta}</span></div>
            ))}
          </Card>

          <Card className="p-4 flex flex-col gap-3">
            <h2 className="text-[15px] font-semibold">Rebuild</h2>
            <div className="grid grid-cols-2 gap-2.5">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="tpl" className="text-xs text-muted">Template</label>
                <select id="tpl" value={tpl || site.templateId} onChange={(e) => setTpl(e.target.value)} className="h-10 px-2.5 rounded-[10px] border border-line-2 bg-[#0C0C0F] text-sm">
                  <option value="aurora">Aurora</option><option value="monolith">Monolith</option><option value="folio">Folio</option>
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="tone2" className="text-xs text-muted">Tone</label>
                <select id="tone2" value={tone || site.content?.tone || 'confident'} onChange={(e) => setTone(e.target.value)} className="h-10 px-2.5 rounded-[10px] border border-line-2 bg-[#0C0C0F] text-sm">
                  <option value="confident">Confident</option><option value="warm">Warm</option><option value="minimal">Minimal</option>
                </select>
              </div>
            </div>
            <div className="flex gap-2">
              <Button className="flex-1" onClick={rebuild} loading={busy === 'rebuild'}><RefreshCw className="size-4" />Rebuild</Button>
              <Button variant="ghost" to={`/people/${id}/review`}>Edit profile</Button>
            </div>
          </Card>
        </aside>
      </div>
    </div>
  );
}
