import { useMemo, useState } from 'react';
import { ArrowRight, Lightbulb, Rocket, Search, Sparkles, TrendingUp, Users, CircleCheck, Layers, Plus } from 'lucide-react';
import { useHub, useLookup } from '@/lib/store';
import { visibleProjects } from '@/lib/server';
import { ACTIVE_STATUSES } from '@/lib/meta';
import { Link, navigate } from '@/lib/router';
import { timeAgo } from '@/lib/format';
import { DeptIcon, PersonAvatar, ProjectCard, ProjectGlyph, SectionTitle, StatusBadge } from '@/components/hub';

const WEEK = 7 * 86_400_000;

export default function Home() {
  const { db, me } = useHub();
  const { person } = useLookup();
  const [q, setQ] = useState('');

  const projects = useMemo(() => visibleProjects(db, me).filter((p) => p.visibility !== 'draft'), [db, me]);
  const ids = new Set(projects.map((p) => p.id));

  const stats = useMemo(() => {
    const contributors = new Set(projects.flatMap((p) => [p.ownerId, ...p.contributorIds]));
    return [
      { label: 'AI projects', value: projects.length, icon: Layers, to: '/projects' },
      { label: 'Ideas proposed', value: projects.filter((p) => p.status === 'idea').length, icon: Lightbulb, to: '/projects?status=idea' },
      { label: 'In progress', value: projects.filter((p) => ACTIVE_STATUSES.includes(p.status)).length, icon: Rocket, to: '/projects?status=active' },
      { label: 'Completed', value: projects.filter((p) => p.status === 'completed').length, icon: CircleCheck, to: '/projects?status=completed' },
      { label: 'Active contributors', value: contributors.size, icon: Users, to: '/people' },
      { label: 'Updated this week', value: projects.filter((p) => Date.now() - +new Date(p.updatedAt) < WEEK).length, icon: TrendingUp, to: '/projects?sort=updated' },
    ];
  }, [projects]);

  const featured = projects.filter((p) => p.featured && p.status !== 'archived').slice(0, 3);
  const recent = [...projects].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 5);
  const updates = db.updates.filter((u) => ids.has(u.projectId)).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);
  const byId = new Map(projects.map((p) => [p.id, p]));

  const contributors = useMemo(() => {
    const count = new Map<string, number>();
    for (const p of projects) for (const id of [p.ownerId, ...p.contributorIds]) count.set(id, (count.get(id) ?? 0) + 1);
    return [...count.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
  }, [projects]);

  return (
    <div className="space-y-14">
      {/* Hero */}
      <section className="bg-ink relative overflow-hidden rounded-[1.75rem] px-6 py-12 text-white sm:px-12 sm:py-16">
        <div aria-hidden className="pointer-events-none absolute -top-24 -right-24 size-[28rem] rounded-full opacity-60 blur-3xl"
          style={{ background: 'radial-gradient(circle, rgba(255,204,42,.45), transparent 60%)' }} />
        <div aria-hidden className="pointer-events-none absolute -bottom-40 left-1/3 size-[26rem] rounded-full opacity-40 blur-3xl"
          style={{ background: 'radial-gradient(circle, rgba(15,150,136,.55), rgba(118,86,232,.25) 50%, transparent 70%)' }} />
        <div aria-hidden className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{ backgroundImage: 'radial-gradient(rgba(255,255,255,.9) 1px, transparent 1px)', backgroundSize: '22px 22px' }} />
        <div className="relative max-w-3xl">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs text-white/75">
            <Sparkles className="text-gold size-3.5" /> Hello {me.name.split(' ')[0]} — here’s what we’re building
          </div>
          <h1 className="display text-[2.6rem] leading-[1.05] sm:text-6xl">
            Welcome to <span className="text-gold italic">AnywhereWorks</span> AI Hub
          </h1>
          <p className="mt-5 max-w-xl text-base text-white/70 sm:text-lg">
            One place to explore ideas, discover innovations, and see what we’re building together.
          </p>
          <form className="mt-8 flex max-w-xl flex-col gap-2 sm:flex-row" onSubmit={(e) => { e.preventDefault(); navigate(`/projects${q.trim() ? `?q=${encodeURIComponent(q.trim())}` : ''}`); }}>
            <label className="relative flex-1">
              <span className="sr-only">Search the hub</span>
              <Search className="pointer-events-none absolute top-1/2 left-4 z-10 size-4 -translate-y-1/2 text-white/60" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Try “call quality”, “Claude” or a colleague’s name"
                className="focus:border-gold/70 h-12 w-full rounded-full border border-white/15 bg-white/10 pr-4 pl-11 text-sm text-white placeholder:text-white/45 outline-none backdrop-blur focus:bg-white/15" />
            </label>
            <button className="bg-gold h-12 cursor-pointer rounded-full px-6 text-sm font-semibold text-[#111] transition hover:brightness-95">Explore</button>
          </form>
          <div className="mt-6 flex flex-wrap gap-2 text-xs">
            {['Customer experience', 'Claude', 'RAG', 'Forecasting', 'Onboarding'].map((t) => (
              <Link key={t} to={`/projects?q=${encodeURIComponent(t)}`} className="rounded-full border border-white/15 px-3 py-1 text-white/70 transition hover:border-white/40 hover:text-white">{t}</Link>
            ))}
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {stats.map(({ label, value, icon: I, to }) => (
          <Link key={label} to={to} className="panel lift group flex flex-col gap-3 p-5">
            <span className="bg-secondary group-hover:bg-gold/30 inline-flex size-9 items-center justify-center rounded-lg transition-colors"><I className="size-4" /></span>
            <div>
              <div className="display text-4xl leading-none">{value}</div>
              <div className="text-muted-foreground mt-1.5 text-sm">{label}</div>
            </div>
          </Link>
        ))}
      </section>

      {/* Featured */}
      {featured.length > 0 && (
        <section>
          <SectionTitle title={<>Featured <span className="italic">projects</span></>} action={<Link to="/projects" className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm">All projects <ArrowRight className="size-4" /></Link>} />
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {featured.map((p) => <ProjectCard key={p.id} project={p} />)}
          </div>
        </section>
      )}

      {/* Updates + recent */}
      <section className="grid gap-6 xl:grid-cols-[1.35fr_1fr]">
        <div className="panel p-6">
          <SectionTitle title="Latest updates" />
          <ol className="relative space-y-6 before:absolute before:top-2 before:bottom-2 before:left-[17px] before:w-px before:bg-border">
            {updates.map((u) => {
              const p = byId.get(u.projectId)!;
              return (
                <li key={u.id} className="relative flex gap-4">
                  <PersonAvatar person={person(u.authorId)} className="relative z-10" />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm"><span className="font-medium">{person(u.authorId)?.name}</span> <span className="text-muted-foreground">· {timeAgo(u.date)}</span></div>
                    <Link to={`/projects/${p.id}`} className="mt-1.5 block rounded-xl border p-3.5 transition hover:border-foreground/20 hover:bg-accent/40">
                      <div className="font-medium">{u.title}</div>
                      <p className="text-muted-foreground mt-0.5 line-clamp-2 text-sm">{u.body}</p>
                      <div className="mt-2 flex items-center gap-2 text-xs">
                        <ProjectGlyph project={p} className="size-5 rounded-md [&_svg]:size-3" />
                        <span className="text-muted-foreground truncate">{p.name}</span>
                      </div>
                    </Link>
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
        <div className="panel p-6">
          <SectionTitle title="Recently added" />
          <ul className="-mx-2 divide-y">
            {recent.map((p) => (
              <li key={p.id}>
                <Link to={`/projects/${p.id}`} className="hover:bg-accent/50 flex items-center gap-3 rounded-xl px-2 py-3">
                  <ProjectGlyph project={p} className="size-10" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{p.name}</div>
                    <div className="text-muted-foreground truncate text-xs">{person(p.ownerId)?.name} · {timeAgo(p.createdAt)}</div>
                  </div>
                  <StatusBadge status={p.status} className="hidden sm:inline-flex" />
                </Link>
              </li>
            ))}
          </ul>
          <Link to="/new" className="hover:border-foreground/30 hover:bg-accent/40 mt-4 flex items-center justify-center gap-2 rounded-xl border border-dashed py-3 text-sm font-medium">
            <Plus className="size-4" /> Share an idea
          </Link>
        </div>
      </section>

      {/* Explore by team */}
      <section>
        <SectionTitle title={<>Explore by <span className="italic">team</span></>} action={<Link to="/departments" className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm">All departments <ArrowRight className="size-4" /></Link>} />
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">
          {db.departments.map((d) => {
            const n = projects.filter((p) => p.departmentId === d.id).length;
            return (
              <Link key={d.id} to={`/departments/${d.id}`} className="panel lift flex flex-col gap-6 p-4">
                <span className="inline-flex size-10 items-center justify-center rounded-xl" style={{ background: `oklch(0.94 0.05 ${d.hue})`, color: `oklch(0.38 0.11 ${d.hue})` }}>
                  <DeptIcon id={d.id} className="size-5" />
                </span>
                <div>
                  <div className="text-sm leading-snug font-medium">{d.name}</div>
                  <div className="text-muted-foreground text-xs">{n} project{n === 1 ? '' : 's'}</div>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Contributors */}
      <section className="panel overflow-hidden">
        <div className="grid gap-8 p-6 sm:p-8 lg:grid-cols-[1fr_1.6fr] lg:items-center">
          <div>
            <div className="eyebrow mb-2">Meet our contributors</div>
            <h2 className="display text-3xl leading-tight">The people turning ideas into <span className="italic">tools we use.</span></h2>
            <Link to="/people" className="bg-foreground text-background mt-5 inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-medium hover:opacity-90">
              See everyone <ArrowRight className="size-4" />
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {contributors.map(([id, n]) => {
              const p = person(id)!;
              return (
                <Link key={id} to={`/people/${id}`} className="hover:bg-accent/50 flex flex-col items-center rounded-2xl p-3 text-center transition">
                  <PersonAvatar person={p} className="size-14 text-base" />
                  <div className="mt-2 truncate text-sm font-medium">{p.name}</div>
                  <div className="text-muted-foreground text-xs">{n} project{n === 1 ? '' : 's'}</div>
                </Link>
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
}
