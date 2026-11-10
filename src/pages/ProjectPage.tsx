import { useMemo, useState } from 'react';
import {
  ArrowLeft, Mail, Pencil, Plus, Star, Trash2, Send, ChevronDown, Lock, Globe, FilePen, MessageSquare, History, Library, Megaphone, Rocket,
  FileUp, Loader2, Paperclip,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useHub, useLookup } from '@/lib/store';
import * as server from '@/lib/server';
import { RESOURCE_TYPES, STAGES, STATUSES, resourceLabel } from '@/lib/meta';
import { Link, navigate } from '@/lib/router';
import { longDate, shortDate, timeAgo } from '@/lib/format';
import type { Comment, Resource, ResourceType, StageKey, Update } from '@/lib/types';
import {
  Chip, EmailPopover, EmptyState, Journey, PersonAvatar, ProjectCard, ProjectGlyph, ResourceCard, StatusBadge, VisibilityBadge,
} from '@/components/hub';
import { Button } from '@/components/ui/button';
import { askConfirm } from '@/components/confirm';
import { fileSize, titleFromFile, useFilePicker } from '@/components/uploads';
import { MAX_UPLOAD_MB } from '@/lib/api';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

export default function ProjectPage({ id, tab }: { id: string; tab?: string }) {
  const { db, me, act } = useHub();
  const { person, dept } = useLookup();
  const bundle = useMemo(() => server.projectBundle(db, me, id), [db, me, id]);
  const [resOpen, setResOpen] = useState<Resource | 'new' | null>(null);
  const [stage, setStage] = useState<StageKey | null>(null);

  const related = useMemo(() => {
    if (!bundle) return [];
    const p = bundle.project;
    const words = new Set([...p.technologies, ...p.tags].map((x) => x.toLowerCase()));
    return server.visibleProjects(db, me)
      .filter((x) => x.id !== p.id && x.visibility === 'published')
      .map((x) => ({ x, score: [...x.technologies, ...x.tags].filter((t) => words.has(t.toLowerCase())).length + (x.departmentId === p.departmentId ? 1 : 0) }))
      .filter((r) => r.score > 0).sort((a, b) => b.score - a.score).slice(0, 3).map((r) => r.x);
  }, [bundle, db, me]);

  if (!bundle)
    return (
      <EmptyState icon={Lock} title="This project isn’t available" action={<Link to="/projects" className="text-sm underline underline-offset-4">Back to all projects</Link>}>
        It may be a draft or restricted to its team. Ask the owner if you need access.
      </EmptyState>
    );

  const { project: p, resources, updates, comments, activity } = bundle;
  const editable = server.canEdit(me, p);
  const owner = person(p.ownerId);
  const team = [p.ownerId, ...p.contributorIds];

  return (
    <div className="space-y-6">
      <Link to="/projects" className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-sm"><ArrowLeft className="size-4" />All projects</Link>

      {p.visibility === 'draft' && (
        <div className="bg-gold/15 border-gold/40 flex flex-col gap-3 rounded-2xl border px-5 py-4 sm:flex-row sm:items-center">
          <FilePen className="text-gold-ink size-5 shrink-0" />
          <div className="flex-1 text-sm"><span className="font-medium">This is a draft.</span> Only you, your contributors and admins can see it. Publish when you’re ready to share.</div>
          {editable && <Button size="sm" onClick={() => act((api) => api.publish(p.id), 'Published — everyone can see it now')}><Megaphone />Publish</Button>}
        </div>
      )}

      {/* Header */}
      <section className="panel relative overflow-hidden p-6 sm:p-8">
        <div aria-hidden className="pointer-events-none absolute -top-32 -right-24 size-80 rounded-full opacity-30 blur-3xl" style={{ background: `radial-gradient(circle, oklch(0.85 0.12 ${dept(p.departmentId)?.hue ?? 80}), transparent 65%)` }} />
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex min-w-0 gap-5">
            <ProjectGlyph project={p} className="size-16 rounded-2xl [&_svg]:size-7" />
            <div className="min-w-0">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <StatusBadge status={p.status} />
                <VisibilityBadge project={p} />
                {p.featured && <span className="bg-gold/20 text-gold-ink inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium"><Star className="fill-current size-3" />Featured</span>}
              </div>
              <h1 className="display text-[2.1rem] leading-tight sm:text-5xl">{p.name}</h1>
              {p.tagline && <p className="text-muted-foreground mt-2 text-lg">{p.tagline}</p>}
              <div className="text-muted-foreground mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
                <Link to={`/people/${p.ownerId}`} className="hover:text-foreground inline-flex items-center gap-2"><PersonAvatar person={owner} className="size-6 text-[10px]" /><span><span className="text-foreground font-medium">{owner?.name}</span> · Owner</span></Link>
                <Link to={`/departments/${p.departmentId}`} className="hover:text-foreground">{dept(p.departmentId)?.name}</Link>
                <span>Updated {timeAgo(p.updatedAt)}</span>
              </div>
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            {owner && <EmailPopover name={owner.name} email={owner.email}><button className="bg-card hover:bg-accent inline-flex h-9 cursor-pointer items-center gap-2 rounded-full border px-4 text-sm font-medium"><Mail className="size-4" />Contact owner</button></EmailPopover>}
            {editable && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild><Button variant="outline">Status <ChevronDown /></Button></DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-60">
                  <DropdownMenuRadioGroup value={p.status} onValueChange={(v) => act((api) => api.setStatus(p.id, v as typeof p.status), 'Status updated')}>
                    {STATUSES.map((s) => <DropdownMenuRadioItem key={s.key} value={s.key}><span className={cn('size-2 rounded-full', s.dot)} />{s.label}</DropdownMenuRadioItem>)}
                  </DropdownMenuRadioGroup>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            {editable && <Button onClick={() => navigate(`/projects/${p.id}/edit`)}><Pencil />Edit</Button>}
            {server.isAdmin(me) && (
              <Button variant="ghost" size="icon" aria-label={p.featured ? 'Unfeature' : 'Feature on home'} title={p.featured ? 'Remove from featured' : 'Feature on home page'}
                onClick={() => act((api) => api.toggleFeatured(p.id), p.featured ? 'Removed from featured' : 'Featured on the home page')}>
                <Star className={cn(p.featured && 'fill-gold text-gold')} />
              </Button>
            )}
          </div>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        {/* Main */}
        <div className="min-w-0">
          <Tabs defaultValue={tab ?? 'overview'}>
            <TabsList className="mb-2">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="resources">Resources <Count n={resources.length} /></TabsTrigger>
              <TabsTrigger value="updates">Updates <Count n={updates.length} /></TabsTrigger>
              <TabsTrigger value="discussion">Discussion <Count n={comments.length} /></TabsTrigger>
              <TabsTrigger value="activity">History</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-5">
              <div className="panel p-6">
                <div className="eyebrow mb-2">About this project</div>
                <p className="text-[15px] leading-relaxed whitespace-pre-line">{p.description || <span className="text-muted-foreground">No description yet.</span>}</p>
              </div>
              <div className="grid gap-4 md:grid-cols-3">
                {[
                  { k: 'The problem', v: p.problem, c: 'var(--destructive)' },
                  { k: 'Proposed solution', v: p.solution, c: 'var(--blue)' },
                  { k: 'Expected benefits', v: p.benefits, c: 'var(--success)' },
                ].map(({ k, v, c }) => (
                  <div key={k} className="panel relative overflow-hidden p-5">
                    <span className="absolute inset-x-0 top-0 h-1" style={{ background: c }} />
                    <div className="eyebrow mb-2">{k}</div>
                    <p className="text-sm leading-relaxed whitespace-pre-line">{v || <span className="text-muted-foreground">Not added yet.</span>}</p>
                  </div>
                ))}
              </div>
              {(p.technologies.length > 0 || p.tags.length > 0) && (
                <div className="panel grid gap-5 p-6 sm:grid-cols-2">
                  <div>
                    <div className="eyebrow mb-2">AI tools & technologies</div>
                    <div className="flex flex-wrap gap-1.5">{p.technologies.map((t) => <Link key={t} to={`/projects?tech=${encodeURIComponent(t)}`}><Chip className="bg-foreground text-background px-3 py-1 text-sm">{t}</Chip></Link>)}</div>
                  </div>
                  <div>
                    <div className="eyebrow mb-2">Keywords</div>
                    <div className="flex flex-wrap gap-1.5">{p.tags.map((t) => <Link key={t} to={`/projects?q=${encodeURIComponent(t)}`}><Chip className="px-3 py-1 text-sm">#{t}</Chip></Link>)}</div>
                  </div>
                </div>
              )}
              {p.notes && <div className="panel p-6"><div className="eyebrow mb-2">Notes</div><p className="text-sm whitespace-pre-line">{p.notes}</p></div>}
              {resources.length > 0 && (
                <div>
                  <div className="mb-3 flex items-center justify-between"><h3 className="display text-xl">Key resources</h3></div>
                  <div className="grid gap-3 md:grid-cols-2">{resources.slice(0, 4).map((r) => <ResourceCard key={r.id} resource={r} />)}</div>
                </div>
              )}
            </TabsContent>

            <TabsContent value="resources">
              <ResourcesTab resources={resources} editable={editable} onAdd={() => setResOpen('new')} onEdit={setResOpen}
                onDelete={(r) => act((api) => api.deleteResource(p.id, r.id), 'Resource removed')} />
            </TabsContent>

            <TabsContent value="updates">
              <UpdatesTab projectId={p.id} updates={updates} editable={editable} />
            </TabsContent>

            <TabsContent value="discussion">
              <DiscussionTab projectId={p.id} comments={comments} />
            </TabsContent>

            <TabsContent value="activity">
              <div className="panel p-6">
                {activity.length === 0 ? <p className="text-muted-foreground text-sm">No activity yet.</p> : (
                  <ul className="space-y-4">
                    {activity.map((a) => (
                      <li key={a.id} className="flex items-start gap-3 text-sm">
                        <History className="text-muted-foreground mt-0.5 size-4 shrink-0" />
                        <div><span className="font-medium">{person(a.actorId)?.name}</span> <span className="text-muted-foreground">{a.action}</span>
                          <div className="text-muted-foreground text-xs">{longDate(a.date)} · {timeAgo(a.date)}</div></div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </div>

        {/* Side */}
        <aside className="space-y-5">
          <div className="panel p-6">
            <div className="mb-5 flex items-center justify-between">
              <h3 className="display text-xl">Project journey</h3>
              <Rocket className="text-muted-foreground size-4" />
            </div>
            <Journey project={p} onEdit={editable ? setStage : undefined} />
            {(p.status === 'on_hold' || p.status === 'archived') && (
              <p className="bg-secondary text-muted-foreground mt-5 rounded-xl px-3 py-2 text-xs">This project is {p.status === 'on_hold' ? 'on hold' : 'archived'}; the journey shows where it stopped.</p>
            )}
          </div>

          <div className="panel p-6">
            <h3 className="display mb-4 text-xl">Team <span className="text-muted-foreground text-base">({team.length})</span></h3>
            <ul className="space-y-3">
              {team.map((tid, i) => {
                const t = person(tid);
                if (!t) return null;
                return (
                  <li key={tid} className="flex items-center gap-3">
                    <Link to={`/people/${tid}`}><PersonAvatar person={t} /></Link>
                    <div className="min-w-0 flex-1">
                      <Link to={`/people/${tid}`} className="block truncate text-sm font-medium hover:underline">{t.name}</Link>
                      <div className="text-muted-foreground truncate text-xs">{i === 0 ? 'Project owner' : 'Contributor'} · {t.title}</div>
                    </div>
                    <EmailPopover name={t.name} email={t.email}><button className="text-muted-foreground hover:text-foreground hover:bg-accent cursor-pointer rounded-full p-2" aria-label={`Email ${t.name}`}><Mail className="size-4" /></button></EmailPopover>
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="panel p-6 text-sm">
            <h3 className="display mb-4 text-xl">Details</h3>
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2.5">
              <dt className="text-muted-foreground">Department</dt><dd className="text-right">{dept(p.departmentId)?.name}</dd>
              <dt className="text-muted-foreground">Proposed</dt><dd className="text-right">{longDate(p.proposedAt)}</dd>
              <dt className="text-muted-foreground">Last updated</dt><dd className="text-right">{longDate(p.updatedAt)}</dd>
              <dt className="text-muted-foreground">Visibility</dt>
              <dd className="flex items-center justify-end gap-1">
                {p.visibility === 'published' ? <><Globe className="size-3.5" />All employees</> : p.visibility === 'draft' ? <><FilePen className="size-3.5" />Draft</> : <><Lock className="size-3.5" />Team only</>}
              </dd>
            </dl>
            {editable && p.visibility === 'draft' && p.ownerId === me.id && (
              <button className="text-destructive mt-5 inline-flex cursor-pointer items-center gap-1.5 text-xs hover:underline"
                onClick={async () => { if (await askConfirm('Delete this draft?', 'This removes the draft and its links for good.', 'Delete draft') && await act((api) => api.deleteProject(p.id), 'Draft deleted')) navigate('/mine'); }}>
                <Trash2 className="size-3.5" />Delete draft
              </button>
            )}
          </div>
        </aside>
      </div>

      {related.length > 0 && (
        <section className="pt-6">
          <h2 className="display mb-4 text-2xl">Related <span className="italic">projects</span></h2>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{related.map((r) => <ProjectCard key={r.id} project={r} />)}</div>
        </section>
      )}

      <ResourceDialog projectId={p.id} value={resOpen} onClose={() => setResOpen(null)} />
      <StageDialog projectId={p.id} stage={stage} initial={stage ? p.journey[stage]?.note ?? '' : ''} onClose={() => setStage(null)} />
    </div>
  );
}

function Count({ n }: { n: number }) {
  return <span className="bg-secondary text-muted-foreground ml-0.5 rounded-full px-1.5 text-[11px] font-medium">{n}</span>;
}

function ResourcesTab({ resources, editable, onAdd, onEdit, onDelete }: {
  resources: Resource[]; editable: boolean; onAdd: () => void; onEdit: (r: Resource) => void; onDelete: (r: Resource) => void;
}) {
  const groups = RESOURCE_TYPES.map((t) => ({ ...t, items: resources.filter((r) => r.type === t.key) })).filter((g) => g.items.length);
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <p className="text-muted-foreground text-sm">Confluence pages, designs, prototypes, repos and anything else that helps people understand this project.</p>
        {editable && <Button onClick={onAdd} className="shrink-0"><Plus />Add resource</Button>}
      </div>
      {groups.length === 0 ? (
        <EmptyState icon={Library} title="No resources yet" action={editable && <Button onClick={onAdd}><Plus />Add the first link</Button>}>
          {editable ? 'Add a Confluence page, Figma file, prototype or demo so others can dive in.' : 'The team hasn’t added links yet — check back soon.'}
        </EmptyState>
      ) : groups.map((g) => (
        <div key={g.key}>
          <div className="eyebrow mb-2">{g.label} · {g.items.length}</div>
          <div className="grid gap-3 md:grid-cols-2">
            {g.items.map((r) => (
              <ResourceCard key={r.id} resource={r} actions={editable && (
                <>
                  <button onClick={() => onEdit(r)} className="text-muted-foreground hover:text-foreground hover:bg-accent cursor-pointer rounded-full p-1.5" aria-label={`Edit ${r.title}`}><Pencil className="size-3.5" /></button>
                  <button onClick={async () => { if (await askConfirm(`Remove “${r.title}”?`, undefined, 'Remove')) onDelete(r); }} className="text-muted-foreground hover:text-destructive hover:bg-accent cursor-pointer rounded-full p-1.5" aria-label={`Remove ${r.title}`}><Trash2 className="size-3.5" /></button>
                </>
              )} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function ResourceDialog({ projectId, value, onClose }: { projectId: string; value: Resource | 'new' | null; onClose: () => void }) {
  const { act, live } = useHub();
  const editing = value && value !== 'new' ? value : null;
  const [form, setForm] = useState({ title: '', type: 'confluence' as ResourceType, description: '', url: '' });
  // New resources can be a link or (on the live site) an uploaded file.
  const [mode, setMode] = useState<'link' | 'file'>('link');
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [lastKey, setLastKey] = useState<string | null>(null);
  const key = value === 'new' ? 'new' : editing?.id ?? null;
  if (key !== lastKey) {
    setLastKey(key);
    setForm(editing ? { title: editing.title, type: editing.type, description: editing.description, url: editing.url } : { title: '', type: 'confluence', description: '', url: '' });
    setMode('link');
    setFile(null);
  }
  const urlBad = mode === 'link' && form.url.length > 0 && !server.validUrl(form.url);
  const [pick, fileInput] = useFilePicker(([f]) => {
    setFile(f);
    setForm((x) => ({ ...x, title: x.title.trim() ? x.title : titleFromFile(f.name), type: server.resourceTypeFor(f.name, f.type) }));
  });

  const submit = async () => {
    setSaving(true);
    const ok = await act(async (api) => {
      if (mode === 'file') {
        if (!file) throw new server.Invalid('Choose a file to upload.');
        const up = await api.uploadFile(file);
        await api.saveResource(projectId, { ...form, url: up.url });
      } else await api.saveResource(projectId, form, editing?.id);
    }, editing ? 'Resource updated' : mode === 'file' ? 'File uploaded' : 'Resource added');
    setSaving(false);
    if (ok) onClose();
  };

  return (
    <Dialog open={!!value} onOpenChange={(o) => !o && !saving && onClose()}>
      <DialogContent>
        {fileInput}
        <DialogHeader>
          <DialogTitle>{editing ? 'Edit resource' : 'Add a resource'}</DialogTitle>
          <DialogDescription>
            {mode === 'file'
              ? 'The file is saved in the AI Hub’s Google Drive folder. Anyone at AnywhereWorks with the link can open it.'
              : 'Links open in a new tab. Access to the linked tool still follows that tool’s own sharing settings.'}
          </DialogDescription>
        </DialogHeader>
        <form className="min-w-0 space-y-4" onSubmit={(e) => { e.preventDefault(); submit(); }}>
          {!editing && live && (
            <div role="radiogroup" aria-label="Resource kind" className="bg-secondary grid grid-cols-2 gap-1 rounded-lg p-1">
              {([['link', 'Add a link'], ['file', 'Upload a file']] as const).map(([k, label]) => (
                <button type="button" role="radio" aria-checked={mode === k} key={k} onClick={() => setMode(k)}
                  className={cn('cursor-pointer rounded-md px-3 py-1.5 text-sm font-medium transition', mode === k ? 'bg-foreground text-background shadow-sm' : 'text-muted-foreground hover:text-foreground')}>
                  {label}
                </button>
              ))}
            </div>
          )}
          {mode === 'file' && (
            <div className="flex items-center gap-3 rounded-xl border border-dashed p-3">
              <Paperclip className="text-muted-foreground size-4 shrink-0" />
              <span className="min-w-0 flex-1 truncate text-sm">{file ? <>{file.name} <span className="text-muted-foreground">· {fileSize(file.size)}</span></> : <span className="text-muted-foreground">PDF, slides, image or document, up to {MAX_UPLOAD_MB} MB</span>}</span>
              <Button type="button" variant="outline" size="sm" onClick={pick}><FileUp />{file ? 'Change' : 'Choose file'}</Button>
            </div>
          )}
          <div className="grid gap-4 sm:grid-cols-[1fr_11rem]">
            <div className="space-y-1.5"><Label htmlFor="rt">Title</Label><Input id="rt" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Project brief" autoFocus /></div>
            <div className="space-y-1.5"><Label>Type</Label>
              <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v as ResourceType })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{RESOURCE_TYPES.map((t) => <SelectItem key={t.key} value={t.key}>{t.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          {mode === 'link' && (
            <div className="space-y-1.5">
              <Label htmlFor="ru">Link</Label>
              <Input id="ru" value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} placeholder="https://" aria-invalid={urlBad} />
              {urlBad && <p className="text-destructive text-xs">Enter a full link that starts with https://</p>}
            </div>
          )}
          <div className="space-y-1.5"><Label htmlFor="rd">Short description <span className="text-muted-foreground font-normal">(optional)</span></Label><Textarea id="rd" rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
            <Button type="submit" disabled={saving}>
              {saving ? <><Loader2 className="animate-spin" />{mode === 'file' ? 'Uploading…' : 'Saving…'}</> : editing ? 'Save changes' : mode === 'file' ? 'Upload file' : `Add ${resourceLabel(form.type).toLowerCase()}`}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function StageDialog({ projectId, stage, initial, onClose }: { projectId: string; stage: StageKey | null; initial: string; onClose: () => void }) {
  const { act } = useHub();
  const [note, setNote] = useState('');
  const [last, setLast] = useState<StageKey | null>(null);
  if (stage !== last) { setLast(stage); setNote(initial); }
  const label = STAGES.find((s) => s.key === stage)?.label;
  return (
    <Dialog open={!!stage} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>{label}</DialogTitle><DialogDescription>What happened at this stage? Keep it to a sentence or two.</DialogDescription></DialogHeader>
        <Textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} autoFocus />
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={async () => { if (stage && await act((api) => api.setJourneyNote(projectId, stage, note), 'Journey updated')) onClose(); }}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function UpdatesTab({ projectId, updates, editable }: { projectId: string; updates: Update[]; editable: boolean }) {
  const { act } = useHub();
  const { person } = useLookup();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  return (
    <div className="space-y-6">
      {editable && (
        <form className="panel space-y-3 p-5" onSubmit={async (e) => { e.preventDefault(); if (await act((api) => api.addUpdate(projectId, title, body), 'Update posted')) { setTitle(''); setBody(''); } }}>
          <div className="eyebrow">Post a progress update</div>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Headline, e.g. “Prototype ready for feedback”" aria-label="Update headline" />
          <Textarea rows={2} value={body} onChange={(e) => setBody(e.target.value)} placeholder="A few words on what changed (optional)" aria-label="Update details" />
          <div className="flex justify-end"><Button type="submit" disabled={!title.trim()}><Send />Post update</Button></div>
        </form>
      )}
      {updates.length === 0 ? <EmptyState icon={Megaphone} title="No updates yet">Progress updates from the team will appear here.</EmptyState> : (
        <ol className="relative space-y-5 before:absolute before:top-3 before:bottom-3 before:left-[5.5rem] before:hidden before:w-px before:bg-border sm:before:block">
          {updates.map((u) => (
            <li key={u.id} className="flex gap-4 sm:gap-6">
              <div className="text-muted-foreground hidden w-16 shrink-0 pt-4 text-right text-xs sm:block">{shortDate(u.date)}</div>
              <span className="bg-gold ring-background relative z-10 mt-5 hidden size-2.5 shrink-0 rounded-full ring-4 sm:block" style={{ marginLeft: '-0.2rem' }} />
              <div className="panel min-w-0 flex-1 p-5">
                <div className="font-medium">{u.title}</div>
                {u.body && <p className="text-muted-foreground mt-1 text-sm whitespace-pre-line">{u.body}</p>}
                <div className="text-muted-foreground mt-3 flex items-center gap-2 text-xs"><PersonAvatar person={person(u.authorId)} className="size-5 text-[9px]" />{person(u.authorId)?.name} · {timeAgo(u.date)}<span className="sm:hidden">· {shortDate(u.date)}</span></div>
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function DiscussionTab({ projectId, comments }: { projectId: string; comments: Comment[] }) {
  const { me, act } = useHub();
  const { person } = useLookup();
  const [body, setBody] = useState('');
  return (
    <div className="space-y-5">
      {comments.length === 0 && <EmptyState icon={MessageSquare} title="Start the conversation">Questions, ideas and suggestions are welcome.</EmptyState>}
      <ul className="space-y-4">
        {comments.map((c) => (
          <li key={c.id} className="flex gap-3">
            <PersonAvatar person={person(c.authorId)} />
            <div className="panel min-w-0 flex-1 px-4 py-3">
              <div className="flex items-center justify-between gap-2 text-sm">
                <span><span className="font-medium">{person(c.authorId)?.name}</span> <span className="text-muted-foreground text-xs">· {timeAgo(c.date)}</span></span>
                {(c.authorId === me.id || server.isAdmin(me)) && (
                  <button onClick={() => act((api) => api.deleteComment(projectId, c.id), 'Comment removed')} className="text-muted-foreground hover:text-destructive cursor-pointer" aria-label="Delete comment"><Trash2 className="size-3.5" /></button>
                )}
              </div>
              <p className="mt-1 text-sm whitespace-pre-line">{c.body}</p>
            </div>
          </li>
        ))}
      </ul>
      <form className="flex gap-3" onSubmit={async (e) => { e.preventDefault(); if (await act((api) => api.addComment(projectId, body))) { setBody(''); toast.success('Comment posted'); } }}>
        <PersonAvatar person={me} />
        <div className="flex-1 space-y-2">
          <Textarea rows={2} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Share a suggestion or ask a question…" aria-label="Comment" />
          <div className="flex justify-end"><Button type="submit" size="sm" disabled={!body.trim()}><Send />Comment</Button></div>
        </div>
      </form>
    </div>
  );
}
