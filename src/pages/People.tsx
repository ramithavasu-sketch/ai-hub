import { useMemo, useState } from 'react';
import { Mail, Pencil, Search, Users, ArrowLeft } from 'lucide-react';
import { useHub, useLookup } from '@/lib/store';
import { updateProfile, visibleProjects } from '@/lib/server';
import { ACTIVE_STATUSES } from '@/lib/meta';
import { Link } from '@/lib/router';
import { hueOf, splitList } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { Project } from '@/lib/types';
import { Chip, DeptIcon, EmailPopover, EmptyState, PageHeader, PersonAvatar, PersonCard, ProjectCard } from '@/components/hub';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PhotoPicker } from '@/components/uploads';

export function People() {
  const { db, me } = useHub();
  const { dept } = useLookup();
  const [q, setQ] = useState('');
  const [deptId, setDeptId] = useState('all');
  const projects = useMemo(() => visibleProjects(db, me).filter((p) => p.visibility !== 'draft'), [db, me]);
  const list = db.people
    .filter((p) => p.active)
    .filter((p) => deptId === 'all' || p.departmentId === deptId)
    .filter((p) => !q.trim() || [p.name, p.title, ...p.interests, dept(p.departmentId)?.name].join(' ').toLowerCase().includes(q.trim().toLowerCase()));

  return (
    <>
      <PageHeader eyebrow="People" title={<>Our <span className="italic">contributors</span></>}
        description="Click anyone to see what they’ve proposed, built and collaborated on." />
      <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center">
        <label className="relative md:w-80">
          <span className="sr-only">Search people</span>
          <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name, role or interest"
            className="bg-card focus:border-ring focus:ring-ring/30 h-10 w-full rounded-full border pr-4 pl-10 text-sm outline-none focus:ring-[3px]" />
        </label>
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:px-0">
          {[{ id: 'all', name: 'Everyone' }, ...db.departments].map((d) => (
            <button key={d.id} onClick={() => setDeptId(d.id)}
              className={cn('shrink-0 cursor-pointer rounded-full border px-3.5 py-1.5 text-sm transition', deptId === d.id ? 'bg-foreground text-background border-foreground' : 'bg-card hover:border-foreground/30')}>
              {d.name}
            </button>
          ))}
        </div>
      </div>
      {list.length ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {list.map((p) => <PersonCard key={p.id} person={p} projects={projects} />)}
        </div>
      ) : <EmptyState icon={Users} title="No one found">Try another name or department.</EmptyState>}
    </>
  );
}

function Group({ title, list, empty }: { title: string; list: Project[]; empty: string }) {
  return (
    <section>
      <h2 className="display mb-4 text-2xl">{title} <span className="text-muted-foreground text-lg">({list.length})</span></h2>
      {list.length ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{list.map((p) => <ProjectCard key={p.id} project={p} />)}</div>
      ) : <p className="text-muted-foreground rounded-2xl border border-dashed px-5 py-6 text-sm">{empty}</p>}
    </section>
  );
}

export function Profile({ id }: { id: string }) {
  const { db, me, act } = useHub();
  const { dept } = useLookup();
  const person = db.people.find((p) => p.id === id);
  const [editing, setEditing] = useState(false);
  const [bio, setBio] = useState('');
  const [name, setName] = useState('');
  const [title, setTitle] = useState('');
  const [deptId, setDeptId] = useState('');
  const [interests, setInterests] = useState('');
  const [photo, setPhoto] = useState('');

  if (!person) return <EmptyState title="Person not found" action={<Link to="/people" className="underline">Back to contributors</Link>} />;

  const all = visibleProjects(db, me);
  const owned = all.filter((p) => p.ownerId === id);
  const proposed = owned.filter((p) => ['idea', 'discussion'].includes(p.status));
  const building = owned.filter((p) => ACTIVE_STATUSES.includes(p.status) && !['discussion'].includes(p.status));
  const done = owned.filter((p) => p.status === 'completed');
  const other = owned.filter((p) => ['on_hold', 'archived'].includes(p.status));
  const collab = all.filter((p) => p.contributorIds.includes(id));
  const h = hueOf(person.name);
  const d = dept(person.departmentId);

  return (
    <div className="space-y-12">
      <Link to="/people" className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-sm"><ArrowLeft className="size-4" />All contributors</Link>
      <section className="panel overflow-hidden">
        <div className="relative h-36 sm:h-44" style={{ background: `linear-gradient(120deg, #111 0%, #111 45%, oklch(0.55 0.12 ${h}) 130%)` }}>
          <div aria-hidden className="absolute inset-0 opacity-[0.08]" style={{ backgroundImage: 'radial-gradient(#fff 1px, transparent 1px)', backgroundSize: '20px 20px' }} />
        </div>
        <div className="relative px-6 pb-7 sm:px-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-5">
            <PersonAvatar person={person} className="-mt-14 size-28 text-3xl ring-[6px]" />
            <div className="flex-1 sm:pt-4">
              <h1 className="display text-4xl">{person.name}</h1>
              <div className="text-muted-foreground mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                <span>{person.title}</span>
                <span className="inline-flex items-center gap-1"><DeptIcon id={person.departmentId} className="size-3.5" />{d?.name}</span>
              </div>
            </div>
            <div className="flex gap-2 sm:pt-5">
              <EmailPopover name={person.name} email={person.email}><button className="bg-foreground text-background inline-flex cursor-pointer items-center gap-2 rounded-full px-4 py-2 text-sm font-medium hover:opacity-90"><Mail className="size-4" />Email</button></EmailPopover>
              {me.id === person.id && (
                <Button variant="outline" onClick={() => { setName(person.name); setBio(person.bio); setTitle(person.title); setDeptId(person.departmentId); setInterests(person.interests.join(', ')); setPhoto(person.photo ?? ''); setEditing(true); }}><Pencil />Edit profile</Button>
              )}
            </div>
          </div>
          <div className="mt-6 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
            <div>
              <div className="eyebrow mb-2">About</div>
              <p className="max-w-2xl leading-relaxed">{person.bio || 'No introduction yet.'}</p>
              <div className="mt-4 flex flex-wrap gap-1.5">{person.interests.map((t) => <Chip key={t} className="px-3 py-1 text-sm">{t}</Chip>)}</div>
            </div>
            <div className="grid grid-cols-4 gap-2 self-start rounded-2xl border p-4 text-center">
              {[['Proposed', proposed.length], ['Building', building.length], ['Completed', done.length], ['Collabs', collab.length]].map(([l, n]) => (
                <div key={l}><div className="display text-3xl">{n}</div><div className="text-muted-foreground text-xs">{l}</div></div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <Group title="Projects proposed" list={proposed} empty="No new ideas proposed right now." />
      <Group title="Currently being developed" list={building} empty="Nothing in development at the moment." />
      <Group title="Completed" list={done} empty="No completed projects yet." />
      <Group title="Collaborating on" list={collab} empty="Not collaborating on other projects yet." />
      {other.length > 0 && <Group title="On hold & archived" list={other} empty="" />}

      <Dialog open={editing} onOpenChange={setEditing}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit your profile</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <PhotoPicker name={name} value={photo} onChange={setPhoto} />
            <div className="space-y-1.5"><Label htmlFor="name">Name</Label><Input id="name" value={name} onChange={(e) => setName(e.target.value)} /></div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5"><Label htmlFor="title">Job title</Label><Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} /></div>
              <div className="space-y-1.5"><Label htmlFor="dept">Department</Label>
                <Select value={deptId} onValueChange={setDeptId}>
                  <SelectTrigger id="dept" className="h-10! w-full"><SelectValue placeholder="Choose" /></SelectTrigger>
                  <SelectContent>{db.departments.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5"><Label htmlFor="bio">Short introduction</Label><Textarea id="bio" rows={4} value={bio} onChange={(e) => setBio(e.target.value)} /></div>
            <div className="space-y-1.5"><Label htmlFor="int">AI interests & skills <span className="text-muted-foreground font-normal">(comma separated)</span></Label><Input id="int" value={interests} onChange={(e) => setInterests(e.target.value)} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(false)}>Cancel</Button>
            <Button onClick={async () => { if (await act((api) => api.updateProfile({ name, title, ...(deptId ? { departmentId: deptId } : {}), bio, interests: splitList(interests), photo }), 'Profile updated')) setEditing(false); }}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
