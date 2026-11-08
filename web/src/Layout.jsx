import { NavLink, Outlet, Link, useNavigate } from 'react-router-dom';
import { Home, FileCheck2, ShieldCheck, Send, Columns3, Users, SlidersHorizontal, Plus, TrendingUp, LogOut } from 'lucide-react';
import { useApi, cx } from './ui.jsx';
import { setToken } from './api.js';

const NAV = [
  { to: '/', label: 'Home', icon: Home, end: true },
  { to: '/people', label: 'People', icon: Users },
  { to: '/approvals', label: 'Approvals', icon: ShieldCheck, badge: 'approvals' },
  { to: '/send', label: 'Send', icon: Send, badge: 'send' },
  { to: '/leads', label: 'Leads', icon: Columns3 },
  { to: '/settings', label: 'Settings', icon: SlidersHorizontal },
];

function Logo() {
  return (
    <Link to="/" className="flex items-center gap-2.5">
      <span className="size-8 rounded-lg bg-accent flex items-center justify-center"><TrendingUp className="size-4 text-bg" strokeWidth={2.6} /></span>
      <span className="flex flex-col leading-tight"><span className="text-[15px] font-semibold tracking-tight">Growth Engine</span><span className="text-xs text-muted">by Anwar</span></span>
    </Link>
  );
}

export default function Layout() {
  const nav = useNavigate();
  const { data: counts } = useApi('/api/dashboard', { poll: 30000 });
  const badges = {
    approvals: (counts?.byStatus?.built || 0) + (counts?.byStatus?.consented || 0),
    send: counts?.byStatus?.preview_approved || 0,
  };
  const logout = () => { setToken(null); nav('/login'); };

  return (
    <div className="min-h-dvh flex">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-[248px] shrink-0 flex-col gap-6 border-r border-[#1F1F25] bg-side px-4 py-6 sticky top-0 h-dvh">
        <div className="px-1.5"><Logo /></div>
        <Link to="/add" className="flex items-center justify-center gap-2 min-h-11 rounded-[10px] bg-accent text-bg text-sm font-semibold hover:bg-accent-soft">
          <Plus className="size-4" strokeWidth={2.4} />Add a person
        </Link>
        <nav aria-label="Main" className="flex flex-col gap-0.5">
          {NAV.map(({ to, label, icon: Icon, end, badge }) => (
            <NavLink key={to} to={to} end={end}
              className={({ isActive }) => cx('flex items-center gap-3 min-h-10 px-2.5 rounded-lg text-sm font-medium', isActive ? 'bg-raise text-ink' : 'text-muted hover:text-ink hover:bg-panel')}>
              {({ isActive }) => (<>
                <Icon className={cx('size-[18px]', isActive && 'text-accent')} strokeWidth={1.8} />{label}
                {badge && badges[badge] > 0 && <span className={cx('ml-auto text-xs font-mono rounded-md px-1.5 py-0.5', badge === 'approvals' ? 'bg-accent text-bg' : 'bg-line-2 text-ink')}>{badges[badge]}</span>}
              </>)}
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto rounded-xl border border-line p-3.5 flex items-center gap-2.5">
          <span className="size-8 rounded-full bg-line-2 flex items-center justify-center text-[13px] font-semibold">A</span>
          <span className="flex flex-col leading-tight min-w-0"><span className="text-sm font-medium">Anwar</span><span className="text-xs text-muted">Founder</span></span>
          <button type="button" onClick={logout} aria-label="Sign out" className="ml-auto size-9 rounded-lg text-muted hover:text-ink hover:bg-raise flex items-center justify-center"><LogOut className="size-4" /></button>
        </div>
      </aside>

      <div className="flex-1 min-w-0 flex flex-col">
        {/* Mobile top bar */}
        <header className="lg:hidden sticky top-0 z-30 flex items-center justify-between gap-3 px-4 h-14 bg-bg/90 backdrop-blur border-b border-[#1F1F25]">
          <Logo />
          <div className="flex items-center gap-1">
            <NavLink to="/people" aria-label="People" className="size-11 rounded-full flex items-center justify-center text-muted hover:text-ink"><Users className="size-5" /></NavLink>
            <NavLink to="/settings" aria-label="Settings" className="size-11 rounded-full flex items-center justify-center text-muted hover:text-ink"><SlidersHorizontal className="size-5" /></NavLink>
          </div>
        </header>

        <main className="flex-1 w-full max-w-[1180px] mx-auto px-4 sm:px-6 lg:px-10 pt-5 lg:pt-8 pb-32 lg:pb-16">
          <Outlet />
        </main>

        {/* Mobile tab bar */}
        <nav aria-label="Main" className="lg:hidden fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 items-start bg-side/95 backdrop-blur border-t border-[#1F1F25] pt-2 pb-safe">
          {[NAV[0], NAV[2], null, NAV[3], NAV[4]].map((item) => item === null ? (
            <Link key="add" to="/add" aria-label="Add a person" className="justify-self-center -mt-1 size-[52px] rounded-2xl bg-accent text-bg flex items-center justify-center shadow-lg shadow-accent/20">
              <Plus className="size-6" strokeWidth={2.4} />
            </Link>
          ) : (
            <NavLink key={item.to} to={item.to} end={item.end}
              className={({ isActive }) => cx('relative flex flex-col items-center justify-center gap-1 min-h-12 text-[11px] pb-2', isActive ? 'text-ink' : 'text-muted')}>
              {({ isActive }) => (<>
                <item.icon className={cx('size-[22px]', isActive && 'text-accent')} strokeWidth={1.8} />
                {item.label === 'Approvals' ? 'Queue' : item.label}
                {item.badge && badges[item.badge] > 0 && <span className="absolute top-0 left-1/2 ml-1.5 min-w-4 h-4 px-1 rounded-full bg-accent text-bg text-[10px] font-semibold flex items-center justify-center">{badges[item.badge]}</span>}
              </>)}
            </NavLink>
          ))}
        </nav>
      </div>
    </div>
  );
}
