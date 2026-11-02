import { useMemo, useState } from 'react';
import { LayoutGrid, List, Search, X, Compass } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useHub, useLookup } from '@/lib/store';
import { visibleProjects } from '@/lib/server';
import { ACTIVE_STATUSES, STATUSES } from '@/lib/meta';
import { Link } from '@/lib/router';
import type { Project } from '@/lib/types';
import { EmptyState, PageHeader, ProjectCard, ProjectRow } from '@/components/hub';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

type Sort = 'updated' | 'newest' | 'oldest' | 'name';
const ALL = 'all';

export function useProjectFilter(projects: Project[], initial: URLSearchParams) {
  const { dept, person } = useLookup();
  const [q, setQ] = useState(initial.get('q') ?? '');
  const [status, setStatus] = useState(initial.get('status') ?? ALL);
  const [deptId, setDeptId] = useState(initial.get('dept') ?? ALL);
  const [tech, setTech] = useState(initial.get('tech') ?? ALL);
  const [sort, setSort] = useState<Sort>((initial.get('sort') as Sort) ?? 'updated');

  const technologies = useMemo(() => [...new Set(projects.flatMap((p) => p.technologies))].sort(), [projects]);

  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    const out = projects.filter((p) => {
      if (status === 'active' ? !ACTIVE_STATUSES.includes(p.status) : status !== ALL && p.status !== status) return false;
      if (deptId !== ALL && p.departmentId !== deptId) return false;
      if (tech !== ALL && !p.technologies.includes(tech)) return false;
      if (!s) return true;
      const people = [p.ownerId, ...p.contributorIds].map((id) => person(id)?.name ?? '');
      return [p.name, p.tagline, p.description, p.problem, p.solution, ...p.technologies, ...p.tags, ...people, dept(p.departmentId)?.name ?? '']
        .join(' ').toLowerCase().includes(s);
    });
    const cmp: Record<Sort, (a: Project, b: Project) => number> = {
      updated: (a, b) => b.updatedAt.localeCompare(a.updatedAt),
      newest: (a, b) => b.createdAt.localeCompare(a.createdAt),
      oldest: (a, b) => a.createdAt.localeCompare(b.createdAt),
      name: (a, b) => a.name.localeCompare(b.name),
    };
    return out.sort(cmp[sort]);
  }, [projects, q, status, deptId, tech, sort, dept, person]);

  const active = (q ? 1 : 0) + (status !== ALL ? 1 : 0) + (deptId !== ALL ? 1 : 0) + (tech !== ALL ? 1 : 0);
  const clear = () => { setQ(''); setStatus(ALL); setDeptId(ALL); setTech(ALL); };

  return { q, setQ, status, setStatus, deptId, setDeptId, tech, setTech, sort, setSort, technologies, list, active, clear };
}

export function FilterBar({ f, hideDept }: { f: ReturnType<typeof useProjectFilter>; hideDept?: boolean }) {
  const { db } = useHub();
  return (
    <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
      <label className="relative flex-1">
        <span className="sr-only">Filter projects</span>
        <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2" />
        <input value={f.q} onChange={(e) => f.setQ(e.target.value)} placeholder="Filter by name, person, keyword or tech"
          className="bg-card focus:border-ring focus:ring-ring/30 h-10 w-full rounded-full border pr-4 pl-10 text-sm outline-none focus:ring-[3px]" />
      </label>
      <div className="grid grid-cols-2 gap-2 sm:flex">
        <Select value={f.status} onValueChange={f.setStatus}>
          <SelectTrigger className="bg-card h-10! rounded-full sm:w-44" aria-label="Status"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All statuses</SelectItem>
            <SelectItem value="active">Any active stage</SelectItem>
            {STATUSES.map((s) => <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>)}
          </SelectContent>
        </Select>
        {!hideDept && (
          <Select value={f.deptId} onValueChange={f.setDeptId}>
            <SelectTrigger className="bg-card h-10! rounded-full sm:w-44" aria-label="Department"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All departments</SelectItem>
              {db.departments.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
        <Select value={f.tech} onValueChange={f.setTech}>
          <SelectTrigger className="bg-card h-10! rounded-full sm:w-40" aria-label="Technology"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Any technology</SelectItem>
            {f.technologies.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={f.sort} onValueChange={(v) => f.setSort(v as Sort)}>
          <SelectTrigger className="bg-card h-10! rounded-full sm:w-40" aria-label="Sort"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="updated">Recently updated</SelectItem>
            <SelectItem value="newest">Newest first</SelectItem>
            <SelectItem value="oldest">Oldest first</SelectItem>
            <SelectItem value="name">Name A–Z</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

export function ProjectResults({ list, view, onClear }: { list: Project[]; view: 'grid' | 'list'; onClear?: () => void }) {
  if (!list.length)
    return <EmptyState icon={Compass} title="Nothing matches yet" action={onClear && <button onClick={onClear} className="cursor-pointer text-sm underline underline-offset-4">Clear filters</button>}>Try a different keyword, or share this idea yourself.</EmptyState>;
  if (view === 'list')
    return <div className="panel divide-y overflow-hidden">{list.map((p) => <ProjectRow key={p.id} project={p} />)}</div>;
  return <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{list.map((p) => <ProjectCard key={p.id} project={p} />)}</div>;
}

export function ViewToggle({ view, setView }: { view: 'grid' | 'list'; setView: (v: 'grid' | 'list') => void }) {
  return (
    <div className="bg-card inline-flex rounded-full border p-1" role="group" aria-label="View">
      {([['grid', LayoutGrid], ['list', List]] as const).map(([k, I]) => (
        <button key={k} onClick={() => setView(k)} aria-pressed={view === k} aria-label={`${k} view`}
          className={cn('inline-flex size-8 cursor-pointer items-center justify-center rounded-full transition', view === k ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground')}>
          <I className="size-4" />
        </button>
      ))}
    </div>
  );
}

export function useView(): ['grid' | 'list', (v: 'grid' | 'list') => void] {
  const [v, setV] = useState<'grid' | 'list'>(() => { try { return (localStorage.getItem('aihub.view') as 'grid' | 'list') || 'grid'; } catch { return 'grid'; } });
  return [v, (x) => { setV(x); try { localStorage.setItem('aihub.view', x); } catch { /* ignore */ } }];
}

export default function Explore({ query }: { query: URLSearchParams }) {
  const { db, me } = useHub();
  const projects = useMemo(() => visibleProjects(db, me).filter((p) => p.visibility !== 'draft' || p.ownerId === me.id), [db, me]);
  const f = useProjectFilter(projects, query);
  const [view, setView] = useView();

  return (
    <>
      <PageHeader eyebrow="Explore" title={<>Every AI project, <span className="italic">in one place</span></>}
        description="Browse ideas, prototypes and finished tools from across AnywhereWorks."
        actions={<Link to="/new" className="bg-gold inline-flex items-center rounded-full px-5 py-2.5 text-sm font-semibold text-[#111] hover:brightness-95">+ Add Project</Link>} />
      <div className="mb-6 space-y-4">
        <FilterBar f={f} />
        <div className="flex items-center justify-between gap-3">
          <div className="text-muted-foreground flex items-center gap-3 text-sm">
            <span><span className="text-foreground font-medium">{f.list.length}</span> of {projects.length} projects</span>
            {f.active > 0 && <button onClick={f.clear} className="hover:text-foreground inline-flex cursor-pointer items-center gap-1"><X className="size-3.5" />Clear filters</button>}
          </div>
          <ViewToggle view={view} setView={setView} />
        </div>
      </div>
      <ProjectResults list={f.list} view={view} onClear={f.clear} />
    </>
  );
}
