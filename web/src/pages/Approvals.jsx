import { useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { ShieldCheck } from 'lucide-react';
import { api } from '../api.js';
import { useApi, Spinner, ErrorNote, PageTitle, Button, Empty, useToast, cx, ago } from '../ui.jsx';

const LOOK = {
  aurora: { bg: '#E9E4DA', ink: '#141413', font: 'var(--font-display)' },
  monolith: { bg: '#0F0F12', ink: '#F2F2F2', font: 'var(--font-sans)' },
  folio: { bg: '#1E2A4A', ink: '#F1F4FF', font: 'var(--font-sans)' },
};

function Row({ item, tab, onDone }) {
  const toast = useToast();
  const nav = useNavigate();
  const [busy, setBusy] = useState('');
  const { contact, site, consent } = item;
  const look = LOOK[site?.templateId] || LOOK.aurora;
  const counted = (site?.qaReport || []).filter((r) => r.status !== 'skip');
  const passed = counted.filter((r) => r.status === 'pass').length;
  const issue = counted.find((r) => r.status !== 'pass');

  const run = async (key, path, ok, after) => {
    setBusy(key);
    try { await api(path, { method: 'POST' }); toast(ok); onDone(); after?.(); } catch (e) { toast(e.message, 'error'); } finally { setBusy(''); }
  };

  return (
    <article className="rounded-2xl border border-line bg-panel p-4 flex flex-wrap gap-5 items-center">
      <div className="shrink-0 w-full sm:w-[200px] h-[124px] rounded-xl p-3.5 flex flex-col justify-end gap-1.5" style={{ background: look.bg }}>
        <span className="text-[22px] leading-none" style={{ color: look.ink, fontFamily: look.font }}>{contact.fullName}</span>
        <span className="text-[10px] tracking-[0.1em] uppercase opacity-70 truncate" style={{ color: look.ink }}>{site?.eyebrow}</span>
      </div>
      <div className="flex-[1_1_260px] min-w-0 flex flex-col gap-2">
        <div className="flex items-center gap-2.5 flex-wrap">
          <h2 className="text-lg font-semibold">{contact.fullName}</h2>
          <span className="text-xs font-mono text-muted border border-line-2 rounded-md px-2 py-0.5 capitalize">{site?.templateId} · v{site?.version}</span>
        </div>
        {tab === 'preview' && (
          <span className={cx('text-[13px]', issue ? 'text-warn' : 'text-ok')}>{issue ? `! ${passed} of ${counted.length} passed · ${issue.label}: ${issue.meta}` : `✓ ${passed} of ${counted.length} QA checks passed`}</span>
        )}
        {consent && tab !== 'preview' && (
          <span className="text-[13px] text-ok">✓ {consent.decision === 'publish' ? 'Tapped “Publish it”' : 'Asked for changes'} {ago(consent.at)} ago</span>
        )}
        {consent?.message && tab !== 'preview' && <blockquote className="rounded-xl bg-[#1A1512] text-[#FFD2C2] text-sm px-3 py-2.5">“{consent.message}”</blockquote>}
        <span className="text-xs font-mono text-muted">waiting {ago(contact.statusChangedAt)}</span>
      </div>
      <div className="flex gap-2.5 flex-wrap w-full sm:w-auto">
        <Button className="flex-1 sm:flex-none" to={`/people/${contact.id}/studio`}>Open</Button>
        {tab === 'preview' && (<>
          <Button className="flex-1 sm:flex-none" variant="ghost" loading={busy === 'back'}
            onClick={() => run('back', `/api/sites/${site.id}/send-back`, 'Sent back to review', () => nav(`/people/${contact.id}/review`))}>Send back</Button>
          <Button className="flex-1 sm:flex-none" variant="primary" loading={busy === 'ok'}
            onClick={() => run('ok', `/api/sites/${site.id}/approve-preview`, 'Approved. Message drafted in Send.')}>{issue ? 'Approve anyway' : 'Approve preview'}</Button>
        </>)}
        {tab === 'publish' && (
          <Button className="flex-1 sm:flex-none" variant="primary" loading={busy === 'pub'}
            onClick={() => run('pub', `/api/sites/${site.id}/approve-publish`, 'Published to GitHub Pages')}>Approve & publish</Button>
        )}
        {tab === 'changes' && <Button className="flex-1 sm:flex-none" variant="primary" to={`/people/${contact.id}/review`}>Make changes</Button>}
      </div>
    </article>
  );
}

export default function Approvals() {
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') || 'preview';
  const { data, error, loading, reload } = useApi('/api/approvals', { poll: 15000 });
  const tabs = [
    ['preview', 'Preview approval', data?.preview.length],
    ['publish', 'Publish approval', data?.publish.length],
    ['changes', 'Changes requested', data?.changes.length],
  ];
  const rows = data?.[tab] || [];

  return (
    <div className="flex flex-col gap-6">
      <PageTitle title="Approvals" sub="Nothing reaches a friend, or the internet, without your yes." />
      <div role="tablist" aria-label="Approval stage" className="flex gap-6 border-b border-line overflow-x-auto scrollbar-none">
        {tabs.map(([k, label, n]) => (
          <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setParams({ tab: k })}
            className={cx('shrink-0 min-h-11 flex items-center gap-2 border-b-2 text-sm font-medium', tab === k ? 'border-accent text-ink' : 'border-transparent text-muted')}>
            {label}{n > 0 && <span className={cx('text-xs font-mono rounded-md px-1.5 py-0.5', k === 'publish' ? 'bg-accent text-bg' : 'bg-line-2')}>{n}</span>}
          </button>
        ))}
      </div>
      <p className="text-[13px] text-muted -mt-2">
        {tab === 'preview' && 'Approving sends nothing yet. It unlocks the private preview link and drafts the message.'}
        {tab === 'publish' && 'They said yes. Approving creates the GitHub repo, commits the site and turns on Pages.'}
        {tab === 'changes' && 'They asked for edits on the preview page.'}
      </p>
      <ErrorNote error={error} />
      {loading && !data ? <Spinner /> : rows.length === 0
        ? <Empty title="Queue clear"><ShieldCheck className="inline size-4 mr-1 text-ok" />You'll see sites here when the agents need your yes.</Empty>
        : <div className="flex flex-col gap-3.5">{rows.map((item) => <Row key={item.contact.id} item={item} tab={tab} onDone={reload} />)}</div>}
    </div>
  );
}
