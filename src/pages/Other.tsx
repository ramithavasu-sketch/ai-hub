import { useMemo, useState } from 'react';
import { ArrowLeft, FilePen, FolderKanban, Library, Plus, Search, ShieldCheck, Archive, RotateCcw, Star } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useHub, useLookup } from '@/lib/store';
import * as server from '@/lib/server';
import { RESOURCE_TYPES, STATUSES } from '@/lib/meta';
import { Link } from '@/lib/router';
import { timeAgo } from '@/lib/format';
import type { AccessRole, ResourceType } from '@/lib/types';
import {
  AvatarStack, DeptIcon, EmptyState, PageHeader, PersonAvatar, ProjectCard, ProjectGlyph, ResourceCard, ResourceIcon, StatusBadge,
} from '@/components/hub';
import { FilterBar, ProjectResults, useProjectFilter, useView, ViewToggle } from './Explore';
import { Button } from '@/components/ui/button';
import { askConfirm } from '@/components/confirm';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

// ---------- Departments ----------

export function Departments() {
  const { db, me } = useHub();
  const projects = server.visibleProjects(db, me).filter((p) => p.visibility !== 'draft');
  return (
    <>
      <PageHeader eyebrow="Departments" title={<>AI across <span className="italic">every team</span></>} description="See where ideas are coming from and what each team is exploring." />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {db.departments.map((d) => {
          const list = projects.filter((p) => p.departmentId === d.id);
          const people = [...new Set(list.flatMap((p) => [p.ownerId, ...p.contributorIds]))];
          const counts = STATUSES.map((s) => ({ s, n: list.filter((p) => p.status === s.key).length })).filter((x) => x.n);
          return (
            <Link key={d.id} to={`/departments/${d.id}`} className="panel lift flex flex-col gap-5 overflow-hidden p-6">
              <div className="flex items-start justify-between">
                <span className="inline-flex size-12 items-center justify-center rounded-2xl" style={{ background: `oklch(0.94 0.05 ${d.hue})`, color: `oklch(0.38 0.11 ${d.hue})` }}><DeptIcon id={d.id} className="size-6" /></span>
                <div className="text-right"><div className="display text-4xl leading-none">{list.length}</div><div className="text-muted-foreground text-xs">projects</div></div>
              </div>
              <div>
                <h3 className="display text-2xl">{d.name}</h3>
                <p className="text-muted-foreground text-sm">{d.description}</p>
              </div>
              {list.length > 0 && (
                <div className="bg-muted flex h-1.5 overflow-hidden rounded-full" aria-label="Status mix">
                  {counts.map(({ s, n }) => <span key={s.key} className={s.dot} style={{ width: `${(n / list.length) * 100}%` }} title={`${s.label}: ${n}`} />)}
                </div>
              )}
              <div className="mt-auto flex items-center justify-between">
                {people.length ? <AvatarStack ids={people} max={5} /> : <span className="text-muted-foreground text-sm">No projects yet — be the first.</span>}
              </div>
            </Link>
          );
        })}
      </div>
    </>
  );
}

export function DepartmentPage({ id, query }: { id: string; query: URLSearchParams }) {
  const { db, me } = useHub();
  const d = db.departments.find((x) => x.id === id);
  const projects = useMemo(() => server.visibleProjects(db, me).filter((p) => p.departmentId === id && p.visibility !== 'draft'), [db, me, id]);
  const f = useProjectFilter(projects, query);
  const [view, setView] = useView();
  if (!d) return <EmptyState title="Department not found" />;
  const people = db.people.filter((p) => p.departmentId === id && p.active);
  return (
    <>
      <Link to="/departments" className="text-muted-foreground hover:text-foreground mb-6 inline-flex items-center gap-1.5 text-sm"><ArrowLeft className="size-4" />All departments</Link>
      <PageHeader eyebrow="Department" title={d.name} description={d.description}
        actions={<div className="flex items-center gap-3"><AvatarStack ids={people.map((p) => p.id)} max={6} size="size-9" /><span className="text-muted-foreground text-sm">{people.length} people</span></div>} />
      <div className="mb-6 space-y-4">
        <FilterBar f={f} hideDept />
        <div className="flex justify-end"><ViewToggle view={view} setView={setView} /></div>
      </div>
      <ProjectResults list={f.list} view={view} onClear={f.clear} />
    </>
  );
}

// ---------- Resource library ----------

export function Resources() {
  const { db, me } = useHub();
  const [q, setQ] = useState('');
  const [type, setType] = useState<ResourceType | 'all'>('all');
  const projects = new Map(server.visibleProjects(db, me).map((p) => [p.id, p]));
  const all = server.visibleResources(db, me).sort((a, b) => b.addedAt.localeCompare(a.addedAt));
  const list = all.filter((r) => (type === 'all' || r.type === type) &&
    (!q.trim() || [r.title, r.description, projects.get(r.projectId)?.name].join(' ').toLowerCase().includes(q.trim().toLowerCase())));
  const counts = new Map<string, number>();
  for (const r of all) counts.set(r.type, (counts.get(r.type) ?? 0) + 1);

  return (
    <>
      <PageHeader eyebrow="Resource library" title={<>Docs, designs & <span className="italic">demos</span></>}
        description="Every Confluence page, Figma file, prototype and repo shared on the hub — in one searchable place." />
      <div className="grid gap-6 lg:grid-cols-[15rem_1fr]">
        <aside className="space-y-1 lg:sticky lg:top-24 lg:self-start">
          <button onClick={() => setType('all')} className={cn('flex w-full cursor-pointer items-center justify-between rounded-xl px-3 py-2 text-sm', type === 'all' ? 'bg-foreground text-background' : 'hover:bg-card')}>
            All resources <span className="opacity-60">{all.length}</span>
          </button>
          <div className="flex gap-1 overflow-x-auto pb-1 lg:block lg:space-y-1">
            {RESOURCE_TYPES.filter((t) => counts.get(t.key)).map((t) => (
              <button key={t.key} onClick={() => setType(t.key)} className={cn('flex shrink-0 cursor-pointer items-center gap-2.5 rounded-xl px-3 py-2 text-sm lg:w-full', type === t.key ? 'bg-card shadow-panel border' : 'hover:bg-card')}>
                <ResourceIcon type={t.key} className="size-7 rounded-md [&_svg]:size-3.5" />
                <span className="flex-1 text-left">{t.label}</span>
                <span className="text-muted-foreground text-xs">{counts.get(t.key)}</span>
              </button>
            ))}
          </div>
        </aside>
        <div>
          <label className="relative mb-5 block">
            <span className="sr-only">Search resources</span>
            <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by title, description or project"
              className="bg-card focus:border-ring focus:ring-ring/30 h-10 w-full rounded-full border pr-4 pl-10 text-sm outline-none focus:ring-[3px]" />
          </label>
          {list.length ? (
            <div className="grid gap-3 md:grid-cols-2">{list.map((r) => <ResourceCard key={r.id} resource={r} project={projects.get(r.projectId)} />)}</div>
          ) : <EmptyState icon={Library} title="No resources found">Try another search or type.</EmptyState>}
        </div>
      </div>
    </>
  );
}

// ---------- My projects ----------

export function MyProjects() {
  const { db, me } = useHub();
  const all = db.projects.filter((p) => server.isMember(me, p));
  const owned = all.filter((p) => p.ownerId === me.id && p.visibility !== 'draft');
  const collab = all.filter((p) => p.ownerId !== me.id);
  const drafts = all.filter((p) => p.visibility === 'draft');
  const tabs = [
    { k: 'owned', label: 'I own', list: owned, empty: 'You don’t own any published projects yet.' },
    { k: 'collab', label: 'I contribute to', list: collab, empty: 'You’re not a contributor on other projects yet.' },
    { k: 'drafts', label: 'Drafts', list: drafts, empty: 'No drafts. Ideas you save as drafts appear here, visible only to you and your contributors.' },
  ];
  return (
    <>
      <PageHeader eyebrow="My projects" title={<>Your <span className="italic">workspace</span></>} description="Everything you own, contribute to, or are still drafting."
        actions={<Link to="/new" className="bg-gold inline-flex items-center gap-1.5 rounded-full px-5 py-2.5 text-sm font-semibold text-[#111] hover:brightness-95"><Plus className="size-4" />Add Project</Link>} />
      <Tabs defaultValue={drafts.length && !owned.length ? 'drafts' : 'owned'}>
        <TabsList className="mb-4">
          {tabs.map((t) => <TabsTrigger key={t.k} value={t.k}>{t.k === 'drafts' && <FilePen />}{t.label} <span className="bg-secondary rounded-full px-1.5 text-[11px]">{t.list.length}</span></TabsTrigger>)}
        </TabsList>
        {tabs.map((t) => (
          <TabsContent key={t.k} value={t.k}>
            {t.list.length ? <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{t.list.map((p) => <ProjectCard key={p.id} project={p} />)}</div>
              : <EmptyState icon={FolderKanban} title="Nothing here yet" action={<Link to="/new" className="bg-foreground text-background inline-flex rounded-full px-4 py-2 text-sm">Share an idea</Link>}>{t.empty}</EmptyState>}
          </TabsContent>
        ))}
      </Tabs>
    </>
  );
}

// ---------- Admin ----------

export function Admin() {
  const { db, me, act, resetData, live } = useHub();
  const { person, dept } = useLookup();
  const [deptName, setDeptName] = useState('');
  const [deptDesc, setDeptDesc] = useState('');
  if (!server.isAdmin(me))
    return <EmptyState icon={ShieldCheck} title="Admins only">Switch to an admin in the profile menu to try the Admin Panel in development mode.</EmptyState>;

  const stale = db.projects.filter((p) => p.visibility !== 'draft' && !['completed', 'archived'].includes(p.status) && Date.now() - +new Date(p.updatedAt) > 30 * 86_400_000);
  const roles: { k: AccessRole; label: string }[] = [{ k: 'admin', label: 'Admin' }, { k: 'contributor', label: 'Contributor' }, { k: 'viewer', label: 'Viewer' }];

  return (
    <>
      <PageHeader eyebrow="Admin panel" title={<>Keep the hub <span className="italic">healthy</span></>} description="Manage access, departments and project upkeep." />
      <Tabs defaultValue="projects">
        <TabsList className="mb-4">
          <TabsTrigger value="projects">Projects</TabsTrigger>
          <TabsTrigger value="people">People & access</TabsTrigger>
          <TabsTrigger value="departments">Departments</TabsTrigger>
        </TabsList>

        <TabsContent value="projects" className="space-y-6">
          {stale.length > 0 && (
            <div className="bg-warning/10 border-warning/30 rounded-2xl border p-5">
              <div className="font-medium">{stale.length} project{stale.length > 1 ? 's' : ''} not updated in 30+ days</div>
              <p className="text-muted-foreground text-sm">Consider nudging the owner, or archiving if the work has stopped.</p>
              <div className="mt-3 flex flex-wrap gap-2">{stale.map((p) => <Link key={p.id} to={`/projects/${p.id}`} className="bg-card rounded-full border px-3 py-1 text-sm hover:underline">{p.name}</Link>)}</div>
            </div>
          )}
          <div className="panel overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="text-muted-foreground border-b text-left text-xs">
                <tr><th className="px-5 py-3 font-medium">Project</th><th className="px-3 font-medium">Owner</th><th className="px-3 font-medium">Status</th><th className="px-3 font-medium">Visibility</th><th className="px-3 font-medium">Updated</th><th className="px-5 text-right font-medium">Actions</th></tr>
              </thead>
              <tbody className="divide-y">
                {[...db.projects].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).map((p) => (
                  <tr key={p.id} className="hover:bg-accent/40">
                    <td className="px-5 py-3"><Link to={`/projects/${p.id}`} className="flex items-center gap-3 font-medium hover:underline"><ProjectGlyph project={p} className="size-8 rounded-lg [&_svg]:size-4" />{p.name}</Link></td>
                    <td className="px-3"><span className="flex items-center gap-2"><PersonAvatar person={person(p.ownerId)} className="size-6 text-[10px]" />{person(p.ownerId)?.name}</span></td>
                    <td className="px-3"><StatusBadge status={p.status} /></td>
                    <td className="text-muted-foreground px-3 capitalize">{p.visibility}</td>
                    <td className="text-muted-foreground px-3">{timeAgo(p.updatedAt)}</td>
                    <td className="px-5">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon-sm" title={p.featured ? 'Unfeature' : 'Feature'} aria-label="Toggle featured" onClick={() => act((api) => api.toggleFeatured(p.id))}><Star className={cn(p.featured && 'fill-gold text-gold')} /></Button>
                        {p.status === 'archived'
                          ? <Button variant="ghost" size="sm" onClick={() => act((api) => api.setStatus(p.id, 'on_hold'), `Restored “${p.name}” as On Hold`)}><RotateCcw />Restore</Button>
                          : <Button variant="ghost" size="sm" onClick={() => act((api) => api.setStatus(p.id, 'archived'), `Archived “${p.name}”`)}><Archive />Archive</Button>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>

        <TabsContent value="people">
          <div className="panel overflow-x-auto">
            <table className="w-full min-w-[680px] text-sm">
              <thead className="text-muted-foreground border-b text-left text-xs">
                <tr><th className="px-5 py-3 font-medium">Person</th><th className="px-3 font-medium">Department</th><th className="px-3 font-medium">Access</th><th className="px-5 text-right font-medium">Status</th></tr>
              </thead>
              <tbody className="divide-y">
                {db.people.map((p) => (
                  <tr key={p.id} className={cn(!p.active && 'opacity-55')}>
                    <td className="px-5 py-3"><span className="flex items-center gap-3"><PersonAvatar person={p} className="size-8" /><span><span className="block font-medium">{p.name}</span><span className="text-muted-foreground text-xs">{p.title}</span></span></span></td>
                    <td className="text-muted-foreground px-3">{dept(p.departmentId)?.name}</td>
                    <td className="px-3">
                      <Select value={p.accessRole} onValueChange={(v) => act((api) => api.setAccess(p.id, v as AccessRole), `${p.name} is now ${v}`)}>
                        <SelectTrigger className="h-8! w-36"><SelectValue /></SelectTrigger>
                        <SelectContent>{roles.map((r) => <SelectItem key={r.k} value={r.k}>{r.label}</SelectItem>)}</SelectContent>
                      </Select>
                    </td>
                    <td className="px-5 text-right">
                      <Button variant="ghost" size="sm" disabled={p.id === me.id} onClick={() => act((api) => api.setActive(p.id, !p.active), p.active ? `${p.name} deactivated` : `${p.name} reactivated`)}>
                        {p.active ? 'Deactivate' : 'Reactivate'}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-muted-foreground mt-3 text-xs">Admins manage the platform · Contributors create and edit their own projects · Viewers can browse, search and comment.</p>
        </TabsContent>

        <TabsContent value="departments" className="grid gap-6 lg:grid-cols-[1fr_22rem]">
          <div className="panel divide-y">
            {db.departments.map((d) => (
              <div key={d.id} className="flex items-center gap-3 px-5 py-3">
                <span className="inline-flex size-9 items-center justify-center rounded-xl" style={{ background: `oklch(0.94 0.05 ${d.hue})`, color: `oklch(0.38 0.11 ${d.hue})` }}><DeptIcon id={d.id} className="size-4" /></span>
                <div className="flex-1"><div className="font-medium">{d.name}</div><div className="text-muted-foreground text-xs">{d.description}</div></div>
                <span className="text-muted-foreground text-sm">{db.projects.filter((p) => p.departmentId === d.id).length} projects</span>
              </div>
            ))}
          </div>
          <form className="panel space-y-3 self-start p-5" onSubmit={async (e) => { e.preventDefault(); if (await act((api) => api.addDepartment(deptName, deptDesc), 'Department added')) { setDeptName(''); setDeptDesc(''); } }}>
            <div className="font-medium">Add a department</div>
            <Input value={deptName} onChange={(e) => setDeptName(e.target.value)} placeholder="Name" aria-label="Department name" />
            <Input value={deptDesc} onChange={(e) => setDeptDesc(e.target.value)} placeholder="Short description" aria-label="Department description" />
            <Button type="submit" className="w-full" disabled={!deptName.trim()}><Plus />Add department</Button>
          </form>
        </TabsContent>
      </Tabs>

      {!live && (
      <div className="mt-10 flex items-center justify-between rounded-2xl border border-dashed p-5 text-sm">
        <div><div className="font-medium">Development data</div><div className="text-muted-foreground">Restore the original sample projects and people in this browser.</div></div>
        <Button variant="outline" onClick={async () => { if (await askConfirm('Reset sample data?', 'Your changes in this browser will be replaced with the original sample projects.', 'Reset')) resetData(); }}>Reset sample data</Button>
      </div>
      )}
    </>
  );
}

