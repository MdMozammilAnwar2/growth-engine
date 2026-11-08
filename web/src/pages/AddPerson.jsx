import { useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { FileText, ImagePlus, X, Smartphone, Laptop } from 'lucide-react';
import { api } from '../api.js';
import { Button, Field, ErrorNote, PageTitle, cx, useToast } from '../ui.jsx';

export default function AddPerson() {
  const nav = useNavigate();
  const toast = useToast();
  const filesRef = useRef(null);
  const photoRef = useRef(null);
  const [files, setFiles] = useState([]);
  const [photo, setPhoto] = useState(null);
  const [params] = useSearchParams();
  // Shared from the LinkedIn app (Android share sheet): pick the profile link out of the shared text
  const shared = `${params.get('url') || ''} ${params.get('text') || ''}`.match(/https?:\/\/[^\s]*linkedin\.com\/in\/[^\s]+/i)?.[0] || '';
  const [form, setForm] = useState({ fullName: '', relationshipNote: '', whatsapp: '', email: '', linkedinUrl: shared, photoUrl: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [dragging, setDragging] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const addFiles = (list) => {
    const ok = [...list].filter((f) => f.type === 'application/pdf' || f.type.startsWith('image/'));
    setFiles((x) => [...x, ...ok].slice(0, 10));
  };

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setError(null);
    try {
      const fd = new FormData();
      files.forEach((f) => fd.append('files', f));
      if (photo) fd.append('photo', photo);
      Object.entries(form).forEach(([k, v]) => v && fd.append(k, v));
      const c = await api('/api/contacts', { method: 'POST', form: fd });
      toast(files.length ? 'Uploaded. The Extractor is reading the profile.' : 'Added.');
      nav(`/people/${c.id}/review`);
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  const pdfs = files.filter((f) => f.type === 'application/pdf').length;
  const shots = files.length - pdfs;

  return (
    <form onSubmit={submit} className="flex flex-col gap-6 max-w-3xl">
      <PageTitle title="Add a person" sub="Who's getting a portfolio?" />

      <div className="grid sm:grid-cols-2 gap-3 text-[13px] text-muted">
        <div className="rounded-xl border border-line bg-panel p-4 flex gap-3"><Laptop className="size-5 text-accent shrink-0" /><span><span className="text-ink font-medium block mb-0.5">On a computer</span>Open their LinkedIn profile › More › Save to PDF, then drop the PDF below.</span></div>
        <div className="rounded-xl border border-line bg-panel p-4 flex gap-3"><Smartphone className="size-5 text-accent shrink-0" /><span><span className="text-ink font-medium block mb-0.5">On your phone</span>Take 2–3 screenshots of their profile in the LinkedIn app and add them below.</span></div>
      </div>

      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); addFiles(e.dataTransfer.files); }}
        className={cx('rounded-2xl border-[1.5px] border-dashed px-5 py-8 flex flex-col items-center gap-3 text-center transition-colors', dragging ? 'border-accent bg-[#16110E]' : 'border-[#34343C] bg-side')}>
        <span className="text-[15px] font-semibold">Drop the LinkedIn PDF or screenshots</span>
        <span className="text-[13px] text-muted">PDF, PNG, JPG · up to 10 files</span>
        <input ref={filesRef} id="files" type="file" accept="application/pdf,image/*" multiple className="sr-only" onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }} />
        <label htmlFor="files" className="inline-flex items-center gap-2 min-h-11 px-4 rounded-[10px] border border-line-2 bg-panel text-sm font-medium cursor-pointer hover:bg-raise">Choose files</label>
        {files.length > 0 && (
          <ul className="w-full flex flex-wrap justify-center gap-2 mt-2">
            {files.map((f, i) => (
              <li key={`${f.name}-${i}`} className="flex items-center gap-2 rounded-full border border-line-2 bg-panel pl-3 pr-1 py-1 text-[13px] max-w-full">
                {f.type === 'application/pdf' ? <FileText className="size-4 text-info shrink-0" /> : <ImagePlus className="size-4 text-accent-soft shrink-0" />}
                <span className="truncate max-w-[180px]">{f.name}</span>
                <button type="button" aria-label={`Remove ${f.name}`} onClick={() => setFiles((x) => x.filter((_, j) => j !== i))} className="size-8 rounded-full flex items-center justify-center text-muted hover:text-ink"><X className="size-3.5" /></button>
              </li>
            ))}
          </ul>
        )}
        {files.length > 0 && <span className="text-xs text-muted">{pdfs ? `${pdfs} PDF` : ''}{pdfs && shots ? ' · ' : ''}{shots ? `${shots} screenshot${shots > 1 ? 's' : ''}` : ''}</span>}
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <Field id="relationshipNote" label="How do you know them?" placeholder="College friend, NIT Patna" value={form.relationshipNote} onChange={set('relationshipNote')} />
        <Field id="whatsapp" label="WhatsApp number" type="tel" inputMode="tel" placeholder="+91" value={form.whatsapp} onChange={set('whatsapp')} />
        <Field id="fullName" label="Name (optional, read from the files)" value={form.fullName} onChange={set('fullName')} />
        <Field id="email" label="Email (optional)" type="email" value={form.email} onChange={set('email')} />
        <Field id="linkedinUrl" className="sm:col-span-2" label="LinkedIn profile link (optional)" placeholder="https://www.linkedin.com/in/…" value={form.linkedinUrl} onChange={set('linkedinUrl')} />
      </div>

      <fieldset className="rounded-2xl border border-line bg-panel p-4 sm:p-5 flex flex-col gap-4">
        <legend className="px-1 text-[13px] text-muted">Profile photo</legend>
        <div className="flex flex-wrap items-center gap-3">
          <input ref={photoRef} id="photo" type="file" accept="image/*" className="sr-only" onChange={(e) => setPhoto(e.target.files?.[0] || null)} />
          <label htmlFor="photo" className="inline-flex items-center gap-2 min-h-11 px-4 rounded-[10px] border border-line-2 text-sm cursor-pointer hover:bg-raise"><ImagePlus className="size-4" />{photo ? photo.name : 'Upload photo'}</label>
          {photo && <Button variant="ghost" size="sm" onClick={() => setPhoto(null)}>Remove</Button>}
          <span className="text-[13px] text-muted">or</span>
          <Field id="photoUrl" className="flex-1 min-w-[220px]" label="" aria-label="Photo link" placeholder="Paste the photo link (right-click photo › Copy image address)" value={form.photoUrl} onChange={set('photoUrl')} />
        </div>
        <p className="text-xs text-muted">The photo is downloaded and stored, because LinkedIn photo links expire.</p>
      </fieldset>

      <ErrorNote error={error} />
      <div className="sticky bottom-24 lg:bottom-4 z-10 flex gap-3 rounded-2xl border border-line bg-bg/90 backdrop-blur p-3">
        <Button variant="ghost" onClick={() => nav(-1)}>Cancel</Button>
        <Button type="submit" variant="primary" className="flex-1" loading={busy} disabled={!files.length && !form.fullName}>
          {files.length ? 'Extract profile' : 'Add without files'}
        </Button>
      </div>
    </form>
  );
}
