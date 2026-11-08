import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, ChevronRight } from 'lucide-react';
import { useApi, Spinner, ErrorNote, Avatar, StatusPill, PageTitle, Button, Empty, ago, cx } from '../ui.jsx';

const FILTERS = [
  ['', 'All'],
  ['imported,extracted,reviewed,failed', 'To review'],
  ['built,preview_approved', 'To approve'],
  ['preview_sent,changes_requested,consented', 'With friend'],
  ['published', 'Live'],
  ['declined', 'Declined'],
];

const nextFor = (c) => (['built', 'preview_approved', 'preview_sent', 'consented', 'changes_requested', 'published'].includes(c.status)
  ? `/people/${c.id}/studio` : `/people/${c.id}/review`);

export default function People() {
  const [filter, setFilter] = useState('');
  const [q, setQ] = useState('');
  const qs = new URLSearchParams({ ...(filter && { status: filter }), ...(q && { q }) }).toString();
  const { data, error, loading } = useApi(`/api/contacts${qs ? `?${qs}` : ''}`, { poll: 10000 });

  return (
    <div className="flex flex-col gap-6">
      <PageTitle title="People" sub="Everyone in the Growth Engine, newest activity first.">
        <Button to="/add" variant="primary">Add a person</Button>
      </PageTitle>

      <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
        <div className="flex items-center gap-2 h-11 px-3 rounded-[10px] border border-line bg-panel sm:w-72">
          <Search className="size-4 text-muted" />
          <label htmlFor="q" className="sr-only">Search people</label>
          <input id="q" type="search" placeholder="Search by name" value={q} onChange={(e) => setQ(e.target.value)} className="flex-1 bg-transparent outline-none text-sm" />
        </div>
        <div className="flex gap-2 overflow-x-auto scrollbar-none -mx-4 px-4 sm:mx-0 sm:px-0">
          {FILTERS.map(([v, label]) => (
            <button key={label} type="button" aria-pressed={filter === v} onClick={() => setFilter(v)}
              className={cx('shrink-0 min-h-9 px-3.5 rounded-full border text-[13px] font-medium', filter === v ? 'bg-ink text-bg border-ink' : 'border-line-2 text-muted hover:text-ink')}>
              {label}
            </button>
          ))}
        </div>
      </div>

      <ErrorNote error={error} />
      {loading && !data ? <Spinner /> : data?.length === 0 ? (
        <Empty title="No one here yet" action={<Button to="/add" variant="primary">Add a person</Button>}>Add a LinkedIn PDF or screenshots to start.</Empty>
      ) : (
        <div className="rounded-2xl border border-line bg-panel overflow-hidden">
          {data?.map((c) => (
            <Link key={c.id} to={nextFor(c)} className="flex items-center gap-3.5 px-4 sm:px-5 py-3.5 border-t first:border-t-0 border-[#1C1C22] hover:bg-panel-2">
              <Avatar name={c.fullName} />
              <span className="flex-1 min-w-0 flex flex-col gap-0.5">
                <span className="text-[15px] font-medium truncate">{c.fullName}</span>
                <span className="text-[13px] text-muted truncate">{c.relationshipNote || c.slug} · {ago(c.statusChangedAt)}</span>
              </span>
              <StatusPill status={c.status} />
              <ChevronRight className="size-[18px] text-muted hidden sm:block" />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
