import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  Bell, Building2, Compass, FolderKanban, House, Library, LogOut, Menu, Moon, Plus, Search, ShieldCheck, Sun, Users, X, Monitor,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Link, navigate } from '@/lib/router';
import { useHub, useLookup } from '@/lib/store';
import { canView, isAdmin, isMember, visibleProjects } from '@/lib/server';
import { timeAgo } from '@/lib/format';
import { PersonAvatar, ProjectGlyph } from './hub';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from './ui/dropdown-menu';

const NAV = [
  { to: '/', label: 'Home', icon: House },
  { to: '/projects', label: 'Explore Projects', icon: Compass },
  { to: '/people', label: 'Our Contributors', icon: Users },
  { to: '/departments', label: 'Departments', icon: Building2 },
  { to: '/resources', label: 'Resource Library', icon: Library },
  { to: '/mine', label: 'My Projects', icon: FolderKanban },
];

function active(path: string, to: string) {
  return to === '/' ? path === '/' : path === to || path.startsWith(to + '/');
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <Link to="/" className={cn('flex items-center gap-2.5 outline-none', className)}>
      <span className="bg-gold relative inline-flex size-9 items-center justify-center rounded-xl text-[#111]">
        <span className="display text-xl leading-none font-semibold italic">A</span>
        <span className="absolute -top-0.5 -right-0.5 size-2.5 rounded-full border-2 border-sidebar bg-white" />
      </span>
      <span className="leading-tight">
        <span className="block text-[13px] font-semibold tracking-wide text-white">AnywhereWorks</span>
        <span className="display block text-[15px] text-white/70 italic">AI Hub</span>
      </span>
    </Link>
  );
}

function Sidebar({ path, onNavigate }: { path: string; onNavigate?: () => void }) {
  const { me } = useHub();
  const items = [...NAV, ...(isAdmin(me) ? [{ to: '/admin', label: 'Admin Panel', icon: ShieldCheck }] : [])];
  return (
    <div className="bg-sidebar flex h-full flex-col text-white/80">
      <div className="px-5 pt-6 pb-8"><Wordmark /></div>
      <nav className="flex flex-col gap-0.5 px-3" onClick={onNavigate}>
        {items.map(({ to, label, icon: I }) => {
          const on = active(path, to);
          return (
            <Link key={to} to={to}
              className={cn('group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors outline-none focus-visible:ring-2 focus-visible:ring-gold/60',
                on ? 'bg-white/10 text-white' : 'hover:bg-white/5 hover:text-white')}>
              {on && <span className="bg-gold absolute top-2 bottom-2 -left-3 w-1 rounded-r-full" />}
              <I className={cn('size-[18px]', on ? 'text-gold' : 'text-white/50 group-hover:text-white/80')} />
              {label}
            </Link>
          );
        })}
        <Link to="/new" className="bg-gold mt-4 flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold text-[#111] transition hover:brightness-95 outline-none focus-visible:ring-2 focus-visible:ring-white/60">
          <Plus className="size-4" /> Add Project
        </Link>
      </nav>
      <div className="mt-auto p-4">
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
          <div className="display text-lg leading-snug text-white">Discover. Collaborate. <span className="text-gold italic">Innovate.</span></div>
          <p className="mt-1.5 text-xs leading-relaxed text-white/50">Got an idea, even a rough one? Share it — early ideas are welcome here.</p>
        </div>
      </div>
    </div>
  );
}

function GlobalSearch() {
  const { db, me } = useHub();
  const { dept } = useLookup();
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); ref.current?.focus(); }
    };
    window.addEventListener('keydown', on);
    return () => window.removeEventListener('keydown', on);
  }, []);

  const results = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return { projects: [], people: [] };
    const projects = visibleProjects(db, me).filter((p) =>
      [p.name, p.tagline, p.description, ...p.technologies, ...p.tags, dept(p.departmentId)?.name ?? ''].join(' ').toLowerCase().includes(s)).slice(0, 5);
    const people = db.people.filter((p) => [p.name, p.title, ...p.interests, dept(p.departmentId)?.name ?? ''].join(' ').toLowerCase().includes(s)).slice(0, 4);
    return { projects, people };
  }, [q, db, me, dept]);

  const go = (to: string) => { setOpen(false); setQ(''); navigate(to); };
  const has = results.projects.length + results.people.length > 0;

  return (
    <div className="relative w-full max-w-md">
      <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2" />
      <input
        ref={ref} value={q}
        onChange={(e) => { setQ(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={(e) => { if (e.key === 'Enter' && q.trim()) go(`/projects?q=${encodeURIComponent(q.trim())}`); if (e.key === 'Escape') ref.current?.blur(); }}
        placeholder="Search people, projects, tech…"
        aria-label="Search"
        className="bg-card placeholder:text-muted-foreground focus:border-ring focus:ring-ring/30 h-10 w-full rounded-full border pr-14 pl-10 text-sm shadow-xs outline-none focus:ring-[3px]"
      />
      <kbd className="text-muted-foreground bg-secondary pointer-events-none absolute top-1/2 right-3 hidden -translate-y-1/2 rounded-md px-1.5 py-0.5 text-[10px] font-medium sm:block">⌘K</kbd>
      {open && q.trim() && (
        <div className="bg-popover absolute top-12 right-0 left-0 z-50 overflow-hidden rounded-2xl border shadow-lift">
          {!has && <div className="text-muted-foreground p-4 text-sm">No matches for “{q}”.</div>}
          {results.projects.length > 0 && <div className="eyebrow px-4 pt-3 pb-1">Projects</div>}
          {results.projects.map((p) => (
            <button key={p.id} onMouseDown={() => go(`/projects/${p.id}`)} className="hover:bg-accent flex w-full cursor-pointer items-center gap-3 px-4 py-2 text-left">
              <ProjectGlyph project={p} className="size-8 rounded-lg [&_svg]:size-4" />
              <span className="min-w-0"><span className="block truncate text-sm font-medium">{p.name}</span><span className="text-muted-foreground block truncate text-xs">{p.tagline}</span></span>
            </button>
          ))}
          {results.people.length > 0 && <div className="eyebrow px-4 pt-3 pb-1">People</div>}
          {results.people.map((p) => (
            <button key={p.id} onMouseDown={() => go(`/people/${p.id}`)} className="hover:bg-accent flex w-full cursor-pointer items-center gap-3 px-4 py-2 text-left">
              <PersonAvatar person={p} className="size-8" />
              <span className="min-w-0"><span className="block truncate text-sm font-medium">{p.name}</span><span className="text-muted-foreground block truncate text-xs">{p.title}</span></span>
            </button>
          ))}
          {has && (
            <button onMouseDown={() => go(`/projects?q=${encodeURIComponent(q.trim())}`)} className="hover:bg-accent text-muted-foreground mt-1 w-full cursor-pointer border-t px-4 py-2.5 text-left text-xs">
              See all results for “{q}” →
            </button>
          )}
        </div>
      )}
    </div>
  );
}

const SEEN_KEY = 'aihub.seen';

function Notifications() {
  const { db, me } = useHub();
  const { person } = useLookup();
  const [seen, setSeen] = useState(() => { try { return localStorage.getItem(`${SEEN_KEY}.${me.id}`) ?? ''; } catch { return ''; } });
  useEffect(() => { try { setSeen(localStorage.getItem(`${SEEN_KEY}.${me.id}`) ?? ''); } catch { /* ignore */ } }, [me.id]);

  const items = useMemo(() => {
    const mine = new Map(db.projects.filter((p) => isMember(me, p) && canView(me, p)).map((p) => [p.id, p]));
    const acts = db.activity.filter((a) => mine.has(a.projectId) && a.actorId !== me.id)
      .map((a) => ({ id: a.id, date: a.date, who: a.actorId, text: a.action, project: mine.get(a.projectId)! }));
    const coms = db.comments.filter((c) => mine.has(c.projectId) && c.authorId !== me.id)
      .map((c) => ({ id: c.id, date: c.date, who: c.authorId, text: 'commented', project: mine.get(c.projectId)! }));
    return [...acts, ...coms].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 12);
  }, [db, me]);
  const unread = items.filter((i) => i.date > seen).length;

  const markRead = () => {
    const t = new Date().toISOString();
    setSeen(t);
    try { localStorage.setItem(`${SEEN_KEY}.${me.id}`, t); } catch { /* ignore */ }
  };

  return (
    <Popover onOpenChange={(o) => { if (!o) markRead(); }}>
      <PopoverTrigger asChild>
        <button className="bg-card hover:bg-accent relative inline-flex size-10 cursor-pointer items-center justify-center rounded-full border outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40" aria-label={`Notifications${unread ? `, ${unread} new` : ''}`}>
          <Bell className="size-[18px]" />
          {unread > 0 && <span className="bg-gold absolute -top-0.5 -right-0.5 inline-flex min-w-5 items-center justify-center rounded-full px-1 text-[10px] font-bold text-[#111]">{unread}</span>}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[22rem] rounded-2xl p-0">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <span className="font-semibold">Notifications</span>
          <span className="text-muted-foreground text-xs">On projects you’re part of</span>
        </div>
        <div className="max-h-96 overflow-y-auto">
          {items.length === 0 && <div className="text-muted-foreground p-6 text-center text-sm">You’re all caught up.</div>}
          {items.map((i) => (
            <Link key={i.id} to={`/projects/${i.project.id}`} className={cn('hover:bg-accent flex gap-3 px-4 py-3', i.date > seen && 'bg-gold/[0.07]')}>
              <PersonAvatar person={person(i.who)} className="size-8" />
              <div className="min-w-0 text-sm">
                <span className="font-medium">{person(i.who)?.name}</span> <span className="text-muted-foreground">{i.text}</span>
                <div className="text-muted-foreground truncate text-xs">{i.project.name} · {timeAgo(i.date)}</div>
              </div>
            </Link>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

type Theme = 'light' | 'dark' | 'system';
function useTheme(): [Theme, (t: Theme) => void] {
  const [t, setT] = useState<Theme>(() => { try { return (localStorage.getItem('aihub.theme') as Theme) || 'system'; } catch { return 'system'; } });
  useEffect(() => {
    // 'system' leaves the viewer's own theme in charge.
    const root = document.documentElement;
    if (t === 'system') root.removeAttribute('data-theme'); else root.setAttribute('data-theme', t);
    try { localStorage.setItem('aihub.theme', t); } catch { /* ignore */ }
  }, [t]);
  return [t, setT];
}

function ProfileMenu() {
  const { db, me, live, signIn, signOut, resetData } = useHub();
  const [theme, setTheme] = useTheme();
  const roleLabel = { admin: 'Admin', contributor: 'Contributor', viewer: 'Viewer' };
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="hover:bg-card flex cursor-pointer items-center gap-2 rounded-full py-1 pr-3 pl-1 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40">
          <PersonAvatar person={me} />
          <span className="hidden text-left leading-tight whitespace-nowrap xl:block">
            <span className="block text-sm font-medium">{me.name}</span>
            <span className="text-muted-foreground block text-xs">{roleLabel[me.accessRole]}</span>
          </span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64 rounded-xl">
        <DropdownMenuItem onSelect={() => navigate(`/people/${me.id}`)}>My profile</DropdownMenuItem>
        <DropdownMenuItem onSelect={() => navigate('/mine')}>My projects</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="text-muted-foreground text-xs font-normal">Theme</DropdownMenuLabel>
        <div className="grid grid-cols-3 gap-1 px-1 pb-1">
          {([['light', Sun], ['dark', Moon], ['system', Monitor]] as const).map(([k, I]) => (
            <button key={k} onClick={() => setTheme(k)} className={cn('flex cursor-pointer flex-col items-center gap-1 rounded-lg py-2 text-xs capitalize', theme === k ? 'bg-secondary text-foreground' : 'text-muted-foreground hover:bg-accent')}>
              <I className="size-4" />{k}
            </button>
          ))}
        </div>
        <DropdownMenuSeparator />
        {live ? (
          <DropdownMenuItem onSelect={signOut}><LogOut className="size-4" />Sign out</DropdownMenuItem>
        ) : (
          <>
          <DropdownMenuLabel className="text-muted-foreground text-xs font-normal">Development sign-in · switch person</DropdownMenuLabel>
          <div className="max-h-56 overflow-y-auto">
            <DropdownMenuRadioGroup value={me.id} onValueChange={signIn}>
              {db.people.filter((p) => p.active).map((p) => (
                <DropdownMenuRadioItem key={p.id} value={p.id}>
                  <span className="truncate">{p.name}</span>
                  <span className="text-muted-foreground ml-auto text-[11px]">{roleLabel[p.accessRole]}</span>
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </div>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={resetData}><LogOut className="size-4" />Reset sample data</DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function Shell({ path, children }: { path: string; children: ReactNode }) {
  const { live } = useHub();
  const [drawer, setDrawer] = useState(false);
  useEffect(() => setDrawer(false), [path]);
  return (
    <div className="min-h-dvh">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 lg:block"><Sidebar path={path} /></aside>
      {drawer && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="animate-in fade-in-0 absolute inset-0 bg-black/50" onClick={() => setDrawer(false)} />
          <div className="animate-in slide-in-from-left absolute inset-y-0 left-0 w-72 shadow-2xl">
            <Sidebar path={path} onNavigate={() => setDrawer(false)} />
            <button onClick={() => setDrawer(false)} className="absolute top-5 right-4 cursor-pointer rounded-full p-1.5 text-white/70 hover:bg-white/10" aria-label="Close menu"><X className="size-5" /></button>
          </div>
        </div>
      )}
      <div className="lg:pl-64">
        {!live && <div className="bg-ink text-ink-foreground/80 flex items-center justify-center gap-2 px-4 py-1.5 text-center text-[11px] tracking-wide">
          <span className="bg-gold size-1.5 rounded-full" />
          Development mode · sample data, saved only in this browser · switch person from your profile menu
        </div>}
        <header className="bg-background/85 sticky top-[env(safe-area-inset-top,0px)] z-20 flex items-center gap-3 border-b px-4 py-3 backdrop-blur-md sm:px-8">
          <button onClick={() => setDrawer(true)} className="hover:bg-accent -ml-1 cursor-pointer rounded-full p-2 lg:hidden" aria-label="Open menu"><Menu className="size-5" /></button>
          <GlobalSearch />
          <div className="ml-auto flex items-center gap-2">
            <Link to="/new" className="hidden items-center gap-1.5 rounded-full bg-foreground px-4 py-2 text-sm font-medium whitespace-nowrap text-background transition hover:opacity-90 md:inline-flex lg:hidden xl:inline-flex">
              <Plus className="size-4" /> Add Project
            </Link>
            <Notifications />
            <ProfileMenu />
          </div>
        </header>
        <main key={path} className="page-in mx-auto max-w-[1280px] px-4 py-8 sm:px-8 sm:py-10">{children}</main>
      </div>
    </div>
  );
}
