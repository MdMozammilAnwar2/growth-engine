import { useCallback, useEffect, useRef, useState, createContext, useContext } from 'react';
import { Link } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { api, fetchBlobUrl } from './api.js';

export const cx = (...c) => c.filter(Boolean).join(' ');

// ── Data hooks ─────────────────────────────────────────
export function useApi(path, { poll } = {}) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(Boolean(path));
  const alive = useRef(true);
  const load = useCallback(async () => {
    if (!path) return;
    try {
      const d = await api(path);
      if (alive.current) { setData(d); setError(null); }
    } catch (e) {
      if (alive.current) setError(e);
    } finally {
      if (alive.current) setLoading(false);
    }
  }, [path]);
  useEffect(() => {
    alive.current = true;
    setLoading(true);
    load();
    return () => { alive.current = false; };
  }, [load]);
  useEffect(() => {
    if (!poll) return undefined;
    const t = setInterval(load, poll);
    return () => clearInterval(t);
  }, [poll, load]);
  return { data, error, loading, reload: load, setData };
}

export function useBlobUrl(path) {
  const [url, setUrl] = useState(null);
  useEffect(() => {
    let u = null; let live = true;
    if (path) fetchBlobUrl(path).then((x) => { u = x; if (live) setUrl(x); }).catch(() => live && setUrl(null));
    else setUrl(null);
    return () => { live = false; if (u) URL.revokeObjectURL(u); };
  }, [path]);
  return url;
}

// ── Toasts ─────────────────────────────────────────────
const ToastCtx = createContext(() => {});
export const useToast = () => useContext(ToastCtx);
export function ToastProvider({ children }) {
  const [items, setItems] = useState([]);
  const push = useCallback((text, kind = 'ok') => {
    const id = Math.random();
    setItems((x) => [...x, { id, text, kind }]);
    setTimeout(() => setItems((x) => x.filter((i) => i.id !== id)), 4200);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div aria-live="polite" className="fixed inset-x-0 bottom-24 lg:bottom-6 z-50 flex flex-col items-center gap-2 px-4 pointer-events-none">
        {items.map((t) => (
          <div key={t.id} className={cx('pointer-events-auto max-w-md rounded-xl px-4 py-3 text-sm shadow-2xl border',
            t.kind === 'error' ? 'bg-[#2A1414] border-[#5A2A2A] text-[#FFC9C9]' : 'bg-raise border-line-2 text-ink')}>
            {t.text}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

// ── Building blocks ────────────────────────────────────
const BTN = {
  primary: 'bg-accent text-bg hover:bg-accent-soft font-semibold',
  light: 'bg-ink text-bg hover:bg-white font-semibold',
  secondary: 'border border-line-2 bg-panel text-ink hover:bg-raise',
  ghost: 'text-muted hover:text-ink hover:bg-raise',
  danger: 'border border-[#5A2A2A] text-[#FF9B9B] hover:bg-[#2A1414]',
};

export function Button({ variant = 'secondary', size = 'md', loading, className, children, to, href, ...rest }) {
  const cls = cx('inline-flex items-center justify-center gap-2 rounded-[10px] text-sm transition-colors disabled:opacity-50 disabled:pointer-events-none whitespace-nowrap',
    size === 'lg' ? 'min-h-[52px] px-5 text-base rounded-[14px]' : size === 'sm' ? 'min-h-9 px-3 text-[13px]' : 'min-h-11 px-4',
    BTN[variant], className);
  const inner = <>{loading && <Loader2 className="size-4 animate-spin" />}{children}</>;
  if (to) return <Link to={to} className={cls} {...rest}>{inner}</Link>;
  if (href) return <a href={href} className={cls} {...rest}>{inner}</a>;
  return <button type="button" className={cls} disabled={loading || rest.disabled} {...rest}>{inner}</button>;
}

export function Card({ className, children, ...rest }) {
  return <section className={cx('rounded-2xl border border-line bg-panel', className)} {...rest}>{children}</section>;
}

export function Spinner({ label = 'Loading' }) {
  return <div className="flex items-center gap-2 text-sm text-muted p-6"><Loader2 className="size-4 animate-spin" />{label}…</div>;
}

export function ErrorNote({ error }) {
  if (!error) return null;
  return <div className="rounded-xl border border-[#5A2A2A] bg-[#2A1414] text-[#FFC9C9] text-sm px-4 py-3">{error.message || String(error)}</div>;
}

export function Empty({ title, children, action }) {
  return (
    <div className="rounded-2xl border border-dashed border-line-2 px-6 py-10 text-center flex flex-col items-center gap-2">
      <p className="text-[15px] font-medium">{title}</p>
      {children && <p className="text-sm text-muted max-w-sm">{children}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export function PageTitle({ title, sub, children }) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div className="flex flex-col gap-2 min-w-0">
        <h1 className="font-display text-[38px] sm:text-5xl leading-none">{title}</h1>
        {sub && <p className="text-[15px] text-muted">{sub}</p>}
      </div>
      {children && <div className="flex flex-wrap gap-2">{children}</div>}
    </header>
  );
}

const TINTS = ['#FFB59C', '#9FB8FF', '#8FE3B8', '#F7CF85', '#C9B6FF', '#8FD3FF', '#FFB3C7'];
export const initials = (n = '') => n.split(/\s+/).filter(Boolean).map((w) => w[0]).slice(0, 2).join('').toUpperCase() || '?';
export const tintFor = (s = '') => TINTS[[...s].reduce((a, c) => a + c.charCodeAt(0), 0) % TINTS.length];

export function Avatar({ name, size = 40, src }) {
  return src
    ? <img src={src} alt="" className="rounded-full object-cover shrink-0" style={{ width: size, height: size }} />
    : <span aria-hidden="true" className="rounded-full shrink-0 flex items-center justify-center font-semibold text-bg"
        style={{ width: size, height: size, background: tintFor(name), fontSize: Math.round(size / 3) }}>{initials(name)}</span>;
}

export const STATUS = {
  imported: { label: 'Reading files', color: '#A1A1AA' },
  extracted: { label: 'Needs review', color: '#F5B544' },
  reviewed: { label: 'Ready to build', color: '#A1A1AA' },
  built: { label: 'Awaiting your OK', color: '#7AA2FF' },
  preview_approved: { label: 'Ready to send', color: '#FF8A63' },
  preview_sent: { label: 'Preview sent', color: '#F5B544' },
  changes_requested: { label: 'Wants changes', color: '#F5B544' },
  consented: { label: 'Said yes', color: '#FF8A63' },
  declined: { label: 'No thanks', color: '#6A6A74' },
  published: { label: 'Live', color: '#3DD68C' },
  failed: { label: 'Needs attention', color: '#FF6B6B' },
};

export function StatusPill({ status }) {
  const s = STATUS[status] || { label: status, color: '#A1A1AA' };
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-line-2 px-2.5 py-1 text-xs font-mono whitespace-nowrap" style={{ color: s.color }}>
      <span className="size-1.5 rounded-full" style={{ background: s.color }} />{s.label}
    </span>
  );
}

export function Field({ label, hint, id, className, ...rest }) {
  return (
    <div className={cx('flex flex-col gap-1.5', className)}>
      <label htmlFor={id} className="text-[13px] text-muted flex justify-between gap-2">{label}{hint && <span className="text-warn">{hint}</span>}</label>
      <input id={id} className="h-11 px-3 rounded-[10px] border border-line-2 bg-[#0C0C0F] text-[15px] outline-none focus:border-accent" {...rest} />
    </div>
  );
}

export function TextArea({ label, id, className, ...rest }) {
  return (
    <div className={cx('flex flex-col gap-1.5', className)}>
      <label htmlFor={id} className="text-[13px] text-muted">{label}</label>
      <textarea id={id} className="px-3 py-2.5 rounded-[10px] border border-line-2 bg-[#0C0C0F] text-[15px] leading-relaxed outline-none focus:border-accent resize-y" {...rest} />
    </div>
  );
}

export function Segmented({ options, value, onChange, label }) {
  return (
    <div role="group" aria-label={label} className="inline-flex p-[3px] rounded-[10px] bg-panel-2 border border-line">
      {options.map((o) => (
        <button key={o.value} type="button" aria-pressed={value === o.value} onClick={() => onChange(o.value)}
          className={cx('min-h-9 px-3.5 rounded-[7px] text-[13px] font-medium', value === o.value ? 'bg-line-2 text-ink' : 'text-muted hover:text-ink')}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export const inr = (n) => {
  const v = Number(n || 0);
  if (v >= 1e5) return `₹${(v / 1e5).toFixed(v % 1e5 ? 2 : 0).replace(/\.?0+$/, '')}L`;
  if (v >= 1e3) return `₹${Math.round(v / 1e3)}k`;
  return `₹${v}`;
};

export const ago = (d) => {
  if (!d) return '';
  const s = (Date.now() - new Date(d).getTime()) / 1000;
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
};
