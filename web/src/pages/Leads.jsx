import { useState } from 'react';
import { Phone, MessageCircle, X } from 'lucide-react';
import { api } from '../api.js';
import { useApi, Spinner, ErrorNote, PageTitle, Button, Avatar, Field, TextArea, useToast, inr, cx } from '../ui.jsx';

const STAGES = [
  ['new', 'New', '#7AA2FF'], ['talking', 'Talking', '#F5B544'], ['proposal', 'Proposal', '#FF8A63'], ['won', 'Won', '#3DD68C'], ['lost', 'Lost', '#6A6A74'],
];
const NEEDS = [['website', 'Website'], ['web_app', 'Web app'], ['mobile_app', 'Mobile app'], ['software', 'Software'], ['referral', 'Referral'], ['other', 'Other']];
const needLabel = Object.fromEntries(NEEDS);
const digits = (s) => String(s || '').replace(/\D/g, '');

function LeadCard({ l, onOpen }) {
  const phone = digits(l.contact?.whatsapp || l.contact?.phone);
  return (
    <article className="rounded-xl border border-[#24242A] bg-[#141418] p-3.5 flex flex-col gap-2.5">
      <button type="button" onClick={() => onOpen(l)} className="flex items-center gap-2.5 text-left">
        <Avatar name={l.contact?.fullName || l.title} size={30} />
        <span className="flex-1 min-w-0 text-sm font-semibold truncate">{l.contact?.fullName || l.title}</span>
        <span className="text-sm font-semibold tabular-nums">{l.valueInr ? inr(l.valueInr) : '—'}</span>
      </button>
      {l.title && <span className="text-[13px] text-[#C4C4CC] leading-snug">{l.title}</span>}
      <div className="flex items-center gap-2">
        <span className="text-xs border border-line-2 rounded-full px-2.5 py-0.5 text-muted whitespace-nowrap">{needLabel[l.need]}</span>
        <span className="ml-auto flex gap-1.5">
          {phone && <a href={`tel:+${phone}`} aria-label={`Call ${l.contact?.fullName}`} className="size-9 rounded-full border border-line-2 flex items-center justify-center hover:bg-raise"><Phone className="size-3.5" /></a>}
          {phone && <a href={`https://wa.me/${phone}`} target="_blank" rel="noreferrer" aria-label={`Message ${l.contact?.fullName}`} className="size-9 rounded-full bg-ink text-bg flex items-center justify-center"><MessageCircle className="size-3.5" /></a>}
        </span>
      </div>
      {(l.nextStep || l.nextStepDate) && <div className="border-t border-line pt-2.5 text-xs font-mono text-muted">{[l.nextStep, l.nextStepDate].filter(Boolean).join(' · ')}</div>}
    </article>
  );
}

function LeadDialog({ lead, onClose, onSaved }) {
  const toast = useToast();
  const { data: people } = useApi('/api/contacts');
  const [f, setF] = useState(() => ({
    contactId: lead?.contactId || '', title: lead?.title || '', need: lead?.need || 'website', stage: lead?.stage || 'new',
    valueInr: lead?.valueInr || '', nextStep: lead?.nextStep || '', nextStepDate: lead?.nextStepDate || '', notes: lead?.notes || '',
  }));
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  const save = async (e) => {
    e.preventDefault(); setBusy(true);
    try {
      const body = { ...f, valueInr: Number(f.valueInr) || 0, contactId: f.contactId || null };
      if (lead?.id) await api(`/api/leads/${lead.id}`, { method: 'PATCH', body });
      else await api('/api/leads', { method: 'POST', body });
      toast('Saved'); onSaved();
    } catch (err) { toast(err.message, 'error'); } finally { setBusy(false); }
  };
  const remove = async () => {
    if (!window.confirm('Delete this lead?')) return;
    await api(`/api/leads/${lead.id}`, { method: 'DELETE' }); onSaved();
  };
  const sel = 'h-11 px-3 rounded-[10px] border border-line-2 bg-[#0C0C0F] text-[15px]';
  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center" role="dialog" aria-modal="true" aria-label={lead?.id ? 'Edit lead' : 'New lead'}>
      <form onSubmit={save} className="w-full sm:max-w-lg max-h-[92dvh] overflow-y-auto rounded-t-3xl sm:rounded-2xl bg-panel border border-line p-5 flex flex-col gap-4 pb-[calc(20px+env(safe-area-inset-bottom))]">
        <div className="flex items-center justify-between"><h2 className="text-lg font-semibold">{lead?.id ? 'Edit lead' : 'New lead'}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="size-10 rounded-full flex items-center justify-center text-muted hover:text-ink"><X className="size-5" /></button></div>
        <div className="flex flex-col gap-1.5"><label htmlFor="who" className="text-[13px] text-muted">Person</label>
          <select id="who" value={f.contactId} onChange={set('contactId')} className={sel}><option value="">Not linked</option>{people?.map((p) => <option key={p.id} value={p.id}>{p.fullName}</option>)}</select></div>
        <Field id="title" label="What do they need?" placeholder="Booking app for his clinic" value={f.title} onChange={set('title')} />
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5"><label htmlFor="need" className="text-[13px] text-muted">Type</label><select id="need" value={f.need} onChange={set('need')} className={sel}>{NEEDS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>
          <div className="flex flex-col gap-1.5"><label htmlFor="stage" className="text-[13px] text-muted">Stage</label><select id="stage" value={f.stage} onChange={set('stage')} className={sel}>{STAGES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>
          <Field id="value" label="Value (₹)" type="number" inputMode="numeric" min="0" value={f.valueInr} onChange={set('valueInr')} />
          <Field id="date" label="Next step date" type="date" value={f.nextStepDate || ''} onChange={set('nextStepDate')} />
        </div>
        <Field id="next" label="Next step" placeholder="Scope call" value={f.nextStep} onChange={set('nextStep')} />
        <TextArea id="notes" label="Notes" rows={3} value={f.notes} onChange={set('notes')} />
        <div className="flex gap-2.5">
          {lead?.id && <Button variant="danger" onClick={remove}>Delete</Button>}
          <Button type="submit" variant="primary" className="flex-1" loading={busy}>Save</Button>
        </div>
      </form>
    </div>
  );
}

export default function Leads() {
  const { data, error, loading, reload } = useApi('/api/leads');
  const [filter, setFilter] = useState('all');
  const [editing, setEditing] = useState(null);
  if (error) return <ErrorNote error={error} />;
  if (loading && !data) return <Spinner />;
  const { leads, totals } = data;
  const open = totals.new + totals.talking + totals.proposal;
  const closed = leads.filter((l) => ['won', 'lost'].includes(l.stage));
  const won = leads.filter((l) => l.stage === 'won').length;

  return (
    <div className="flex flex-col gap-6">
      <PageTitle title="Leads" sub="Work that came back from the gifts.">
        <Button variant="light" onClick={() => setEditing({})}>Add lead</Button>
      </PageTitle>
      <div className="grid grid-cols-3 gap-3 sm:max-w-xl">
        {[['Open pipeline', inr(open)], ['Won', inr(totals.won), 'text-accent-soft'], ['Closed won', closed.length ? `${won} of ${closed.length}` : '—']].map(([l, v, c]) => (
          <div key={l} className="rounded-2xl border border-line bg-panel px-4 py-3 flex flex-col gap-1"><span className="text-xs text-muted">{l}</span><span className={cx('text-2xl font-semibold tracking-tight', c)}>{v}</span></div>
        ))}
      </div>

      {/* Phone: filter + list */}
      <div className="lg:hidden flex flex-col gap-3">
        <div className="flex gap-2 overflow-x-auto scrollbar-none -mx-4 px-4">
          {[['all', 'All'], ...STAGES].map(([v, l]) => (
            <button key={v} type="button" aria-pressed={filter === v} onClick={() => setFilter(v)}
              className={cx('shrink-0 min-h-9 px-3.5 rounded-full border text-[13px] font-medium', filter === v ? 'bg-ink text-bg border-ink' : 'border-line-2 text-muted')}>{l}</button>
          ))}
        </div>
        {leads.filter((l) => filter === 'all' || l.stage === filter).map((l) => <LeadCard key={l.id} l={l} onOpen={setEditing} />)}
        {!leads.length && <p className="text-sm text-muted">No leads yet. When a friend asks about work, add it here.</p>}
      </div>

      {/* Desktop: board */}
      <div className="hidden lg:block overflow-x-auto pb-2">
        <div className="grid grid-cols-5 gap-3.5 min-w-[1100px] items-start">
          {STAGES.map(([k, label, color]) => {
            const col = leads.filter((l) => l.stage === k);
            return (
              <section key={k} aria-label={label} className="rounded-2xl border border-[#1F1F25] bg-side p-3 flex flex-col gap-2.5">
                <div className="flex items-center gap-2 px-1 pb-1">
                  <span className="size-2 rounded-full" style={{ background: color }} />
                  <h2 className="text-sm font-semibold">{label}</h2>
                  <span className="text-xs font-mono text-muted">{col.length}</span>
                  <span className="ml-auto text-xs text-muted">{totals[k] ? inr(totals[k]) : ''}</span>
                </div>
                {col.map((l) => <LeadCard key={l.id} l={l} onOpen={setEditing} />)}
              </section>
            );
          })}
        </div>
      </div>

      {editing && <LeadDialog lead={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); reload(); }} />}
    </div>
  );
}
