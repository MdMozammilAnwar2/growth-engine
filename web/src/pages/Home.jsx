import { Link } from 'react-router-dom';
import { ChevronRight, ExternalLink, UploadCloud } from 'lucide-react';
import { useApi, Card, Spinner, ErrorNote, Avatar, StatusPill, Button, Empty, inr, ago } from '../ui.jsx';

const STAGES = [
  ['imported', 'Reading', '#3A3A42'], ['extracted', 'Review', '#4C4C55'], ['reviewed', 'Ready', '#6A6A74'],
  ['built', 'Built', '#7AA2FF'], ['preview_sent', 'Sent', '#F5B544'], ['consented', 'Said yes', '#FF8A63'], ['published', 'Live', '#FF6B3D'],
];
const ACTOR_COLOR = { Publisher: '#FF6B3D', QA: '#3DD68C', Extractor: '#7AA2FF', Writer: '#C9B6FF', Outreach: '#F5B544', person: '#FF8A63' };

const greeting = () => {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
};

export default function Home() {
  const { data, error, loading } = useApi('/api/dashboard', { poll: 15000 });
  if (loading && !data) return <Spinner />;
  if (error && !data) return <ErrorNote error={error} />;
  const { kpis, byStatus, todos, activity, recentLive } = data;
  const inMotion = STAGES.reduce((a, [k]) => a + (byStatus[k] || 0), 0) + (byStatus.preview_approved || 0) + (byStatus.changes_requested || 0);
  const tiles = [
    ['Previews sent', kpis.previewsSent],
    ['Said yes', kpis.consentRate == null ? '—' : `${kpis.consentRate}%`, `${kpis.yes} of ${kpis.previewsSent}`],
    ['Sites live', kpis.sitesLive, 'on GitHub Pages'],
    ['Replies', kpis.replies],
    ['Leads won', inr(kpis.wonValue), `${kpis.wonCount} project${kpis.wonCount === 1 ? '' : 's'}`],
  ];

  return (
    <div className="flex flex-col gap-7">
      <section className="flex flex-wrap items-end justify-between gap-5">
        <div className="flex flex-col gap-2.5">
          <span className="font-mono text-[11px] tracking-[0.08em] uppercase text-muted">
            {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}
          </span>
          <h1 className="font-display text-[40px] sm:text-6xl leading-none">{greeting()}, <em className="text-accent-soft">Anwar.</em></h1>
          <p className="text-muted">{todos.length ? `${todos.length} thing${todos.length > 1 ? 's' : ''} need you. The agents handled the rest.` : 'Nothing needs you right now.'}</p>
        </div>
        <div className="flex gap-2.5">
          <Button to="/people">All people</Button>
          <Button to="/add" variant="light">Add a person</Button>
        </div>
      </section>

      <section aria-label="Key numbers" className="flex lg:grid lg:grid-cols-5 gap-px overflow-x-auto scrollbar-none rounded-2xl border border-line bg-line -mx-4 sm:mx-0 rounded-none sm:rounded-2xl">
        {tiles.map(([label, value, note]) => (
          <div key={label} className="bg-panel px-5 py-4 lg:py-5 flex flex-col gap-1.5 min-w-[150px] flex-1">
            <span className="text-[13px] text-muted">{label}</span>
            <span className="text-3xl lg:text-[34px] font-semibold tracking-tight tabular-nums">{value}</span>
            {note && <span className="text-xs text-muted font-mono truncate">{note}</span>}
          </div>
        ))}
      </section>

      <Card className="p-5 flex flex-col gap-4">
        <div className="flex justify-between items-baseline gap-2 flex-wrap">
          <h2 className="text-base font-semibold">Pipeline</h2>
          <span className="text-[13px] text-muted">{inMotion} people · {byStatus.published || 0} live</span>
        </div>
        <div className="flex gap-1 h-2.5">
          {STAGES.map(([k, , c]) => (byStatus[k] ? <div key={k} className="rounded-[3px]" style={{ flex: `${byStatus[k]} 1 0`, background: c }} /> : null))}
          {!inMotion && !byStatus.published && <div className="flex-1 rounded-[3px] bg-line" />}
        </div>
        <div className="grid grid-cols-4 sm:grid-cols-7 gap-3">
          {STAGES.map(([k, label, c]) => (
            <div key={k} className="flex flex-col gap-1">
              <span className="flex items-center gap-1.5 text-xs text-muted"><span className="size-2 rounded-sm" style={{ background: c }} />{label}</span>
              <span className="text-xl font-semibold tabular-nums">{byStatus[k] || 0}</span>
            </div>
          ))}
        </div>
      </Card>

      <div className="flex flex-wrap gap-5 items-start">
        <Card className="flex-[3_1_440px] min-w-0 overflow-hidden">
          <div className="flex justify-between items-center px-5 pt-5 pb-3"><h2 className="text-base font-semibold">Needs you</h2><span className="text-xs text-muted">Oldest first</span></div>
          {todos.length === 0 && <p className="px-5 pb-6 text-sm text-muted">All clear. Add people to start a new batch.</p>}
          {todos.map((t) => (
            <Link key={`${t.id}-${t.task}`} to={t.to} className="flex items-center gap-3.5 px-5 py-4 border-t border-[#1C1C22] hover:bg-panel-2">
              <Avatar name={t.name} />
              <span className="flex-1 min-w-0 flex flex-col gap-0.5">
                <span className="text-[15px] font-medium truncate">{t.task} <span className="text-muted font-normal">· {t.name}</span></span>
                <span className="text-[13px] text-muted">waiting {ago(t.since)}</span>
              </span>
              <span className="hidden sm:block"><StatusPill status={t.status} /></span>
              <ChevronRight className="size-[18px] text-muted" />
            </Link>
          ))}
        </Card>

        <div className="flex-[2_1_320px] min-w-0 flex flex-col gap-5">
          <Link to="/add" className="rounded-2xl border-[1.5px] border-dashed border-[#34343C] bg-side px-5 py-6 flex flex-col items-center gap-2 text-center hover:border-accent">
            <span className="size-11 rounded-xl bg-[#1F1611] flex items-center justify-center"><UploadCloud className="size-5 text-accent" /></span>
            <span className="text-[15px] font-semibold">Add LinkedIn PDFs or screenshots</span>
            <span className="text-[13px] text-muted">Profile › More › Save to PDF, or share screenshots from your phone.</span>
          </Link>
          <Card className="p-5 flex flex-col gap-3.5">
            <h2 className="text-base font-semibold">Agent activity</h2>
            {activity.length === 0 && <p className="text-sm text-muted">Nothing yet.</p>}
            {activity.map((a) => (
              <div key={a.id} className="flex gap-3">
                <span className="mt-1.5 size-2 rounded-full shrink-0" style={{ background: ACTOR_COLOR[a.actor] || '#A1A1AA' }} />
                <div className="min-w-0 flex flex-col">
                  <span className="text-sm">{a.text}</span>
                  <span className="text-xs text-muted font-mono">{a.actor === 'you' ? 'You' : a.actor} · {ago(a.at)}</span>
                </div>
              </div>
            ))}
          </Card>
        </div>
      </div>

      <section className="flex flex-col gap-3.5">
        <h2 className="text-base font-semibold">Recently live</h2>
        {recentLive.length === 0
          ? <Empty title="No live sites yet">Sites appear here once a friend says yes and you approve publishing.</Empty>
          : (
            <div className="grid grid-cols-[repeat(auto-fit,minmax(260px,1fr))] gap-4">
              {recentLive.map((s) => (
                <a key={s.id} href={s.url} target="_blank" rel="noreferrer" className="rounded-2xl border border-line bg-panel overflow-hidden hover:border-line-2">
                  <div className="h-28 bg-[#E9E4DA] px-4 py-4 flex items-end"><span className="font-display text-[28px] leading-none text-[#141413]">{s.name}</span></div>
                  <div className="px-4 py-3.5 flex justify-between items-center gap-2">
                    <span className="text-xs font-mono text-muted truncate">{s.url?.replace(/^https?:\/\//, '')}</span>
                    <ExternalLink className="size-4 text-ok shrink-0" />
                  </div>
                </a>
              ))}
            </div>
          )}
      </section>
    </div>
  );
}
