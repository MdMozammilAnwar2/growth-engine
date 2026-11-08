import { useEffect, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { AlertTriangle, ChevronDown, Plus, Trash2, RefreshCw, FileText, ImagePlus } from 'lucide-react';
import { api } from '../api.js';
import {
  useApi, useBlobUrl, Card, Spinner, ErrorNote, Avatar, StatusPill, Button, Field, TextArea, cx, useToast,
} from '../ui.jsx';

const TEMPLATE_LOOK = {
  aurora: { bg: '#E9E4DA', ink: '#141413', font: 'var(--font-display)' },
  monolith: { bg: '#0F0F12', ink: '#F2F2F2', font: 'var(--font-sans)' },
  folio: { bg: '#1E2A4A', ink: '#F1F4FF', font: 'var(--font-sans)' },
};

function SourceViewer({ contactId, sources }) {
  const [i, setI] = useState(0);
  const s = sources[i];
  const url = useBlobUrl(s ? `/api/contacts/${contactId}/sources/${s.id}` : null);
  if (!sources.length) return <p className="text-sm text-muted p-4">No files. You added this person by hand.</p>;
  return (
    <div className="flex flex-col gap-3">
      {sources.length > 1 && (
        <div className="flex gap-2 overflow-x-auto scrollbar-none">
          {sources.map((x, k) => (
            <button key={x.id} type="button" onClick={() => setI(k)} aria-pressed={k === i}
              className={cx('shrink-0 min-h-9 px-3 rounded-full border text-xs flex items-center gap-1.5', k === i ? 'border-accent text-ink' : 'border-line-2 text-muted')}>
              {x.kind === 'profile_pdf' ? <FileText className="size-3.5" /> : <ImagePlus className="size-3.5" />}{x.originalName || `File ${k + 1}`}
            </button>
          ))}
        </div>
      )}
      {!url ? <Spinner label="Opening file" /> : s.mimeType === 'application/pdf'
        ? <iframe title="LinkedIn PDF" src={url} className="w-full h-[70vh] rounded-lg bg-white" />
        : <img src={url} alt="Profile screenshot" className="w-full rounded-lg" />}
    </div>
  );
}

function Section({ title, children, defaultOpen = true, count }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-t border-line pt-4">
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="w-full flex items-center justify-between min-h-10 text-left">
        <span className="text-[15px] font-semibold">{title}{count != null && <span className="text-muted font-normal"> · {count}</span>}</span>
        <ChevronDown className={cx('size-4 text-muted transition-transform', open && 'rotate-180')} />
      </button>
      {open && <div className="pt-3 flex flex-col gap-3">{children}</div>}
    </div>
  );
}

export default function Review() {
  const { id } = useParams();
  const nav = useNavigate();
  const toast = useToast();
  const { data: c, error, reload } = useApi(`/api/contacts/${id}`);
  const { data: settings } = useApi('/api/settings');
  const [draft, setDraft] = useState(null);
  const [templateId, setTemplateId] = useState('aurora');
  const [tone, setTone] = useState('confident');
  const [busy, setBusy] = useState('');
  const [newSkill, setNewSkill] = useState('');
  const [showSource, setShowSource] = useState(false);
  const photo = useBlobUrl(c?.photoUrl || null);

  // poll while the Extractor works
  useEffect(() => {
    if (c?.status !== 'imported') return undefined;
    const t = setInterval(reload, 2000);
    return () => clearInterval(t);
  }, [c?.status, reload]);

  useEffect(() => {
    if (c?.profile && (!draft || draft.__v !== c.profile.version)) setDraft({ ...structuredClone(c.profile.data), __v: c.profile.version });
    if (c?.site?.templateId) setTemplateId(c.site.templateId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [c?.profile?.version]);

  if (error) return <ErrorNote error={error} />;
  if (!c) return <Spinner />;

  if (c.status === 'imported' || !draft) {
    return (
      <div className="max-w-xl flex flex-col gap-4 py-10">
        <h1 className="font-display text-4xl">Reading the profile…</h1>
        <p className="text-muted">The Extractor is turning {c.sources.length} file(s) into structured data. This usually takes a few seconds.</p>
        <Spinner label="Working" />
      </div>
    );
  }

  const set = (k, v) => setDraft((d) => ({ ...d, [k]: v }));
  const setItem = (list, i, k, v) => setDraft((d) => ({ ...d, [list]: d[list].map((x, j) => (j === i ? { ...x, [k]: v } : x)) }));
  const removeItem = (list, i) => setDraft((d) => ({ ...d, [list]: d[list].filter((_, j) => j !== i) }));
  const addItem = (list, item) => setDraft((d) => ({ ...d, [list]: [...d[list], item] }));
  const flagged = (field) => c.profile.flags?.find((f) => f.field === field || f.field?.startsWith(`${field}`));

  const save = async (reviewed) => {
    const { __v, ...data } = draft;
    await api(`/api/contacts/${id}/profile`, { method: 'PUT', body: { data, reviewed, flags: reviewed ? [] : c.profile.flags } });
  };

  const onSave = async () => {
    setBusy('save');
    try { await save(false); toast('Saved'); await reload(); } catch (e) { toast(e.message, 'error'); } finally { setBusy(''); }
  };
  const onBuild = async () => {
    setBusy('build');
    try {
      await save(true);
      await api(`/api/contacts/${id}/build`, { method: 'POST', body: { templateId, tone } });
      toast('Site built and checked');
      nav(`/people/${id}/studio`);
    } catch (e) { toast(e.message, 'error'); setBusy(''); }
  };
  const onPhoto = async (file) => {
    const fd = new FormData(); fd.append('photo', file);
    try { await api(`/api/contacts/${id}/photo`, { method: 'POST', form: fd }); toast('Photo updated'); reload(); } catch (e) { toast(e.message, 'error'); }
  };

  return (
    <div className="flex flex-col gap-6 pb-20">
      <header className="flex flex-col gap-4">
        <nav aria-label="Breadcrumb" className="text-[13px] text-muted flex gap-2"><Link to="/people" className="hover:text-ink">People</Link><span aria-hidden="true">/</span><span className="text-ink truncate">{c.fullName}</span></nav>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4 min-w-0">
            <Avatar name={c.fullName} size={56} src={photo} />
            <div className="min-w-0 flex flex-col gap-1">
              <h1 className="font-display text-4xl leading-none truncate">{draft.fullName || c.fullName}</h1>
              <span className="text-sm text-muted truncate">{c.relationshipNote || 'No note'} · extracted by {c.profile.extractedBy}</span>
            </div>
          </div>
          <div className="flex items-center gap-2"><StatusPill status={c.status} />
            {c.sources.length > 0 && <Button size="sm" variant="ghost" onClick={async () => { await api(`/api/contacts/${id}/extract`, { method: 'POST' }); reload(); }}><RefreshCw className="size-3.5" />Re-read</Button>}
          </div>
        </div>
      </header>

      {c.status === 'failed' && <ErrorNote error={{ message: c.activity.find((a) => a.event.endsWith('failed'))?.text || 'A step failed.' }} />}
      {c.status === 'changes_requested' && (
        <div className="rounded-xl border border-[#4A3A1A] bg-[#1C160B] text-[#F7CF85] text-sm px-4 py-3">
          They asked for changes: “{c.activity.find((a) => a.event === 'consent_changes')?.payload?.message || 'see their message'}”
        </div>
      )}
      {c.profile.flags?.length > 0 && (
        <div className="rounded-xl border border-[#4A3A1A] bg-[#1C160B] px-4 py-3 flex gap-3 text-sm text-[#F7CF85]">
          <AlertTriangle className="size-4 shrink-0 mt-0.5" />
          <span>{c.profile.flags.length} thing{c.profile.flags.length > 1 ? 's' : ''} to check: {c.profile.flags.map((f) => `${f.field} (${f.reason})`).join('; ')}</span>
        </div>
      )}

      <div className="flex flex-wrap gap-5 items-start">
        <Card className="flex-[1_1_360px] min-w-0 p-4 lg:sticky lg:top-6">
          <button type="button" className="lg:hidden w-full flex items-center justify-between min-h-10 text-sm font-medium" onClick={() => setShowSource(!showSource)} aria-expanded={showSource}>
            Source files ({c.sources.length})<ChevronDown className={cx('size-4 text-muted', showSource && 'rotate-180')} />
          </button>
          <div className={cx(showSource ? 'block pt-3' : 'hidden', 'lg:block lg:pt-0')}><SourceViewer contactId={id} sources={c.sources} /></div>
        </Card>

        <Card className="flex-[1.4_1_440px] min-w-0 p-5 flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-4">
            <Avatar name={c.fullName} size={72} src={photo} />
            <div className="flex-1 min-w-[180px] flex flex-col gap-0.5">
              <span className="text-sm font-medium">{c.photoUrl ? 'Photo saved' : 'No photo yet'}</span>
              <span className="text-[13px] text-muted">{c.photoUrl ? 'Used on the site in a fixed frame.' : 'The site will show initials until you add one.'}</span>
            </div>
            <input id="photo-up" type="file" accept="image/*" className="sr-only" onChange={(e) => e.target.files?.[0] && onPhoto(e.target.files[0])} />
            <label htmlFor="photo-up" className="inline-flex items-center min-h-10 px-3.5 rounded-[10px] border border-line-2 text-[13px] cursor-pointer hover:bg-raise">{c.photoUrl ? 'Replace' : 'Upload'}</label>
          </div>

          <div className="grid sm:grid-cols-2 gap-3.5">
            <Field id="fullName" label="Full name" hint={flagged('fullName') && 'check'} value={draft.fullName} onChange={(e) => set('fullName', e.target.value)} />
            <Field id="location" label="Location" hint={flagged('location') && 'check'} value={draft.location} onChange={(e) => set('location', e.target.value)} />
          </div>
          <Field id="headline" label="Headline" hint={flagged('headline') && 'check'} value={draft.headline} onChange={(e) => set('headline', e.target.value)} />
          <TextArea id="about" label="About" rows={4} value={draft.about} onChange={(e) => set('about', e.target.value)} />
          <div className="grid sm:grid-cols-3 gap-3.5">
            <Field id="email" label="Email" type="email" value={draft.email} onChange={(e) => set('email', e.target.value)} />
            <Field id="linkedinUrl" label="LinkedIn URL" value={draft.linkedinUrl} onChange={(e) => set('linkedinUrl', e.target.value)} />
            <Field id="website" label="Website" value={draft.website} onChange={(e) => set('website', e.target.value)} />
          </div>

          <Section title="Experience" count={draft.experience.length}>
            {draft.experience.map((x, i) => (
              <div key={i} className={cx('rounded-xl border bg-[#0C0C0F] p-3.5 flex flex-col gap-3', flagged(`experience`) ? 'border-[#4A3A1A]' : 'border-line-2')}>
                <div className="flex items-center gap-3">
                  <input id={`feat-${i}`} type="checkbox" checked={x.featured !== false} onChange={(e) => setItem('experience', i, 'featured', e.target.checked)} className="size-[18px] accent-accent" />
                  <label htmlFor={`feat-${i}`} className="text-[13px] text-muted flex-1">Show on site</label>
                  <button type="button" aria-label="Remove role" onClick={() => removeItem('experience', i)} className="size-9 rounded-lg text-muted hover:text-bad flex items-center justify-center"><Trash2 className="size-4" /></button>
                </div>
                <div className="grid sm:grid-cols-2 gap-3">
                  <Field id={`t-${i}`} label="Title" value={x.title} onChange={(e) => setItem('experience', i, 'title', e.target.value)} />
                  <Field id={`co-${i}`} label="Company" value={x.company} onChange={(e) => setItem('experience', i, 'company', e.target.value)} />
                  <Field id={`s-${i}`} label="Start" value={x.start} onChange={(e) => setItem('experience', i, 'start', e.target.value)} />
                  <Field id={`e-${i}`} label="End" value={x.end} onChange={(e) => setItem('experience', i, 'end', e.target.value)} />
                </div>
                <TextArea id={`d-${i}`} label="Description" rows={2} value={x.description} onChange={(e) => setItem('experience', i, 'description', e.target.value)} />
              </div>
            ))}
            <Button size="sm" onClick={() => addItem('experience', { title: '', company: '', start: '', end: '', description: '', featured: true })}><Plus className="size-4" />Add role</Button>
          </Section>

          <Section title="Skills" count={draft.skills.filter((s) => s.featured !== false).length}>
            <div className="flex flex-wrap gap-2">
              {draft.skills.map((s, i) => (
                <button key={`${s.name}-${i}`} type="button" aria-pressed={s.featured !== false} onClick={() => setItem('skills', i, 'featured', s.featured === false)}
                  className={cx('min-h-9 px-3 rounded-full border text-[13px]', s.featured !== false ? 'border-accent bg-[#2A1A13] text-[#FFB59C]' : 'border-line-2 text-muted')}>{s.name}</button>
              ))}
            </div>
            <div className="flex gap-2">
              <label htmlFor="new-skill" className="sr-only">New skill</label>
              <input id="new-skill" value={newSkill} onChange={(e) => setNewSkill(e.target.value)} placeholder="Add a skill"
                onKeyDown={(e) => { if (e.key === 'Enter' && newSkill.trim()) { e.preventDefault(); addItem('skills', { name: newSkill.trim(), featured: true }); setNewSkill(''); } }}
                className="h-10 px-3 rounded-[10px] border border-line-2 bg-[#0C0C0F] text-sm flex-1 outline-none focus:border-accent" />
              <Button size="sm" onClick={() => { if (newSkill.trim()) { addItem('skills', { name: newSkill.trim(), featured: true }); setNewSkill(''); } }}>Add</Button>
            </div>
          </Section>

          <Section title="Education" count={draft.education.length} defaultOpen={false}>
            {draft.education.map((x, i) => (
              <div key={i} className="grid sm:grid-cols-[1fr_1fr_90px_90px_40px] gap-2.5 items-end">
                <Field id={`sc-${i}`} label="School" value={x.school} onChange={(e) => setItem('education', i, 'school', e.target.value)} />
                <Field id={`dg-${i}`} label="Degree" value={x.degree} onChange={(e) => setItem('education', i, 'degree', e.target.value)} />
                <Field id={`es-${i}`} label="Start" value={x.start} onChange={(e) => setItem('education', i, 'start', e.target.value)} />
                <Field id={`ee-${i}`} label="End" value={x.end} onChange={(e) => setItem('education', i, 'end', e.target.value)} />
                <button type="button" aria-label="Remove" onClick={() => removeItem('education', i)} className="size-11 rounded-lg text-muted hover:text-bad flex items-center justify-center"><Trash2 className="size-4" /></button>
              </div>
            ))}
            <Button size="sm" onClick={() => addItem('education', { school: '', degree: '', start: '', end: '' })}><Plus className="size-4" />Add school</Button>
          </Section>

          <Section title="Projects" count={draft.projects.length} defaultOpen={false}>
            {draft.projects.map((x, i) => (
              <div key={i} className="grid sm:grid-cols-[1fr_1fr_40px] gap-2.5 items-end">
                <Field id={`pn-${i}`} label="Name" value={x.name} onChange={(e) => setItem('projects', i, 'name', e.target.value)} />
                <Field id={`pu-${i}`} label="Link" value={x.url} onChange={(e) => setItem('projects', i, 'url', e.target.value)} />
                <button type="button" aria-label="Remove" onClick={() => removeItem('projects', i)} className="size-11 rounded-lg text-muted hover:text-bad flex items-center justify-center"><Trash2 className="size-4" /></button>
                <TextArea id={`pd-${i}`} className="sm:col-span-3" label="Description" rows={2} value={x.description} onChange={(e) => setItem('projects', i, 'description', e.target.value)} />
              </div>
            ))}
            <Button size="sm" onClick={() => addItem('projects', { name: '', description: '', url: '' })}><Plus className="size-4" />Add project</Button>
          </Section>

          <Section title="Template and tone">
            <div role="radiogroup" aria-label="Template" className="grid grid-cols-3 gap-2.5">
              {(settings?.templates || [{ id: 'aurora', name: 'Aurora' }, { id: 'monolith', name: 'Monolith' }, { id: 'folio', name: 'Folio' }]).map((t) => {
                const look = TEMPLATE_LOOK[t.id] || TEMPLATE_LOOK.aurora;
                return (
                  <button key={t.id} type="button" role="radio" aria-checked={templateId === t.id} onClick={() => setTemplateId(t.id)}
                    className={cx('rounded-xl border-[1.5px] p-2 flex flex-col gap-2 text-left', templateId === t.id ? 'border-accent' : 'border-line-2')}>
                    <span className="h-16 rounded-lg p-2.5 flex items-end" style={{ background: look.bg }}>
                      <span style={{ color: look.ink, fontFamily: look.font }} className="text-lg leading-none">{(draft.fullName || 'Name').split(' ')[0]}</span>
                    </span>
                    <span className="text-[13px] px-0.5">{t.name}</span>
                  </button>
                );
              })}
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="tone" className="text-[13px] text-muted">Writer tone</label>
              <select id="tone" value={tone} onChange={(e) => setTone(e.target.value)} className="h-11 px-3 rounded-[10px] border border-line-2 bg-[#0C0C0F] text-[15px]">
                <option value="confident">Confident and clear</option>
                <option value="warm">Warm and personal</option>
                <option value="minimal">Minimal</option>
              </select>
              <span className="text-xs text-muted">{settings?.ai?.enabled ? 'The Writer only rephrases. It never adds jobs, dates or claims.' : 'AI is off: the site uses the profile text as written.'}</span>
            </div>
          </Section>
        </Card>
      </div>

      <div className="fixed lg:sticky inset-x-0 bottom-[calc(64px+env(safe-area-inset-bottom))] lg:bottom-4 z-20 px-4 lg:px-0">
        <div className="flex gap-2.5 rounded-2xl border border-line bg-bg/90 backdrop-blur p-3 max-w-[1180px] mx-auto">
          <Button variant="ghost" onClick={onSave} loading={busy === 'save'}>Save</Button>
          <Button variant="primary" className="flex-1" onClick={onBuild} loading={busy === 'build'}>Looks good · build site</Button>
        </div>
      </div>
    </div>
  );
}
