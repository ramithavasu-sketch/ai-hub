import { cloneElement, isValidElement, useId, useMemo, useState, type ReactNode } from 'react';
import { ArrowLeft, Check, ChevronDown, FilePen, Globe, Lock, Megaphone, X, Lightbulb } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useHub } from '@/lib/store';
import * as server from '@/lib/server';
import { STATUSES } from '@/lib/meta';
import { Link, navigate } from '@/lib/router';
import { splitList } from '@/lib/format';
import type { Status, Visibility } from '@/lib/types';
import { EmptyState, PersonAvatar } from '@/components/hub';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

function Field({ label, hint, required, children, className }: { label: string; hint?: string; required?: boolean; children: ReactNode; className?: string }) {
  // Point the label at the field so screen readers announce it.
  const id = useId();
  const child = isValidElement<{ id?: string }>(children) ? cloneElement(children, { id }) : children;
  return (
    <div className={cn('space-y-1.5', className)}>
      <Label htmlFor={id} className="text-sm">{label}{required ? <span className="text-destructive">*</span> : <span className="text-muted-foreground font-normal">(optional)</span>}</Label>
      {child}
      {hint && <p className="text-muted-foreground text-xs">{hint}</p>}
    </div>
  );
}

function Section({ n, title, description, children }: { n: number; title: string; description: string; children: ReactNode }) {
  return (
    <section className="panel grid gap-6 p-6 sm:p-8 lg:grid-cols-[15rem_1fr]">
      <div>
        <span className="bg-gold/25 text-gold-ink display mb-3 inline-flex size-8 items-center justify-center rounded-full text-sm font-semibold">{n}</span>
        <h2 className="display text-xl">{title}</h2>
        <p className="text-muted-foreground mt-1 text-sm">{description}</p>
      </div>
      <div className="space-y-5">{children}</div>
    </section>
  );
}

function PeoplePicker({ value, onChange, exclude, placeholder }: { value: string[]; onChange: (v: string[]) => void; exclude?: string; placeholder: string }) {
  const { db } = useHub();
  const [q, setQ] = useState('');
  const options = db.people.filter((p) => p.active && p.id !== exclude && p.name.toLowerCase().includes(q.toLowerCase()));
  const toggle = (id: string) => onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id]);
  return (
    <div className="space-y-2">
      <Popover>
        <PopoverTrigger asChild>
          <button type="button" className="border-input hover:bg-accent/40 flex h-10 w-full cursor-pointer items-center justify-between rounded-md border bg-transparent px-3 text-sm">
            <span className="text-muted-foreground">{value.length ? `${value.length} selected` : placeholder}</span>
            <ChevronDown className="size-4 opacity-50" />
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-(--radix-popover-trigger-width) p-0">
          <div className="border-b p-2"><Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search people" className="h-8" /></div>
          <div className="max-h-64 overflow-y-auto p-1">
            {options.map((p) => (
              <button type="button" key={p.id} onClick={() => toggle(p.id)} className="hover:bg-accent flex w-full cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-sm">
                <PersonAvatar person={p} className="size-7 text-[10px]" />
                <span className="min-w-0 flex-1"><span className="block truncate">{p.name}</span><span className="text-muted-foreground block truncate text-xs">{p.title}</span></span>
                {value.includes(p.id) && <Check className="size-4" />}
              </button>
            ))}
          </div>
        </PopoverContent>
      </Popover>
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {value.map((id) => {
            const p = db.people.find((x) => x.id === id);
            return p && (
              <span key={id} className="bg-secondary inline-flex items-center gap-1.5 rounded-full py-0.5 pr-1 pl-0.5 text-xs">
                <PersonAvatar person={p} className="size-5 text-[9px] ring-0" />{p.name}
                <button type="button" onClick={() => toggle(id)} className="hover:bg-background cursor-pointer rounded-full p-0.5" aria-label={`Remove ${p.name}`}><X className="size-3" /></button>
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function ProjectForm({ id }: { id?: string }) {
  const { db, me, act } = useHub();
  const existing = id ? db.projects.find((p) => p.id === id) : undefined;

  const [f, setF] = useState(() => ({
    name: existing?.name ?? '',
    tagline: existing?.tagline ?? '',
    description: existing?.description ?? '',
    problem: existing?.problem ?? '',
    solution: existing?.solution ?? '',
    benefits: existing?.benefits ?? '',
    ownerId: existing?.ownerId ?? me.id,
    contributorIds: existing?.contributorIds ?? [],
    departmentId: existing?.departmentId ?? me.departmentId,
    status: existing?.status ?? ('idea' as Status),
    technologies: existing?.technologies.join(', ') ?? '',
    tags: existing?.tags.join(', ') ?? '',
    notes: existing?.notes ?? '',
    access: (existing?.visibility === 'restricted' ? 'restricted' : 'published') as Exclude<Visibility, 'draft'>,
    allowedIds: existing?.allowedIds ?? [],
    confluence: '', prototype: '', live: '',
  }));
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((x) => ({ ...x, [k]: v }));

  const missing = useMemo(() => {
    const m: string[] = [];
    if (!f.name.trim()) m.push('name');
    if (!f.description.trim()) m.push('description');
    if (!f.problem.trim()) m.push('problem');
    if (!f.solution.trim()) m.push('solution');
    return m;
  }, [f]);

  if (id && (!existing || !server.canEdit(me, existing)))
    return <EmptyState icon={Lock} title="You can’t edit this project" action={<Link to={id ? `/projects/${id}` : '/'} className="text-sm underline">Go back</Link>}>Only the owner, contributors and admins can make changes.</EmptyState>;
  if (!id && !server.canCreate(me))
    return <EmptyState icon={Lock} title="Viewer access only">Ask an admin for contributor access to share projects.</EmptyState>;

  const canChangeOwner = server.isAdmin(me) || (!!existing && existing.ownerId === me.id);
  const links = [['confluence', f.confluence, 'Confluence documentation'], ['prototype', f.prototype, 'Prototype'], ['live', f.live, 'Project link']] as const;
  const badLink = links.find(([, u]) => u.trim() && !server.validUrl(u));

  const submit = async (asDraft: boolean) => {
    if (badLink) return void act(async () => { throw new server.Invalid(`The ${badLink[2]} link should start with https://`); });
    let saved = '';
    const ok = await act(async (api) => {
      saved = await api.saveProject({
        ...f,
        technologies: splitList(f.technologies),
        tags: splitList(f.tags),
        visibility: asDraft ? 'draft' : f.access,
        allowedIds: f.access === 'restricted' ? f.allowedIds : [],
      }, id);
      for (const [type, url, title] of links)
        if (url.trim()) await api.saveResource(saved, { type, url, title, description: '' });
    }, asDraft ? 'Draft saved — you can finish it any time' : id ? 'Project updated' : 'Project published 🎉');
    if (ok) navigate(`/projects/${saved}`);
  };

  return (
    <div className="mx-auto max-w-5xl">
      <Link to={id ? `/projects/${id}` : '/projects'} className="text-muted-foreground hover:text-foreground mb-6 inline-flex items-center gap-1.5 text-sm"><ArrowLeft className="size-4" />{id ? 'Back to project' : 'All projects'}</Link>
      <div className="mb-8">
        <div className="eyebrow mb-2">{id ? 'Edit project' : 'New project'}</div>
        <h1 className="display text-4xl sm:text-5xl">{id ? existing!.name : <>Share an <span className="italic">AI idea</span></>}</h1>
        {!id && (
          <div className="bg-card mt-5 flex items-start gap-3 rounded-2xl border p-4 text-sm">
            <Lightbulb className="text-gold-ink mt-0.5 size-5 shrink-0" />
            <p className="text-muted-foreground"><span className="text-foreground font-medium">Early ideas are welcome.</span> You don’t need documentation or a prototype to start. Save a draft with just a name, and come back when you’re ready.</p>
          </div>
        )}
      </div>

      <form className="space-y-5" onSubmit={(e) => { e.preventDefault(); submit(false); }}>
        <Section n={1} title="The basics" description="What is it, and who is behind it?">
          <Field label="Project name" required><Input value={f.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. AI Call Evaluation Assistant" className="h-11 text-base" /></Field>
          <Field label="One-line summary" hint="Shown on project cards."><Input value={f.tagline} onChange={(e) => set('tagline', e.target.value)} placeholder="e.g. First-pass QA scoring for every support call" maxLength={140} /></Field>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Department" required>
              <Select value={f.departmentId} onValueChange={(v) => set('departmentId', v)}>
                <SelectTrigger className="h-10!" aria-label="Department"><SelectValue placeholder="Choose" /></SelectTrigger>
                <SelectContent>{db.departments.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label="Current status" required>
              <Select value={f.status} onValueChange={(v) => set('status', v as Status)}>
                <SelectTrigger className="h-10!" aria-label="Current status"><SelectValue /></SelectTrigger>
                <SelectContent>{STATUSES.map((s) => <SelectItem key={s.key} value={s.key}><span className={cn('size-2 rounded-full', s.dot)} />{s.label}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Project owner" required hint={!id && !server.isAdmin(me) ? 'You’ll be the owner. Admins can reassign later.' : !canChangeOwner ? 'Only the owner or an admin can change this.' : undefined}>
              <Select value={f.ownerId} onValueChange={(v) => set('ownerId', v)} disabled={!canChangeOwner || (!id && !server.isAdmin(me))}>
                <SelectTrigger className="h-10!" aria-label="Project owner"><SelectValue /></SelectTrigger>
                <SelectContent>{db.people.filter((p) => p.active).map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label="Contributors">
              <PeoplePicker value={f.contributorIds} onChange={(v) => set('contributorIds', v)} exclude={f.ownerId} placeholder="Add colleagues" />
            </Field>
          </div>
        </Section>

        <Section n={2} title="The story" description="Help colleagues understand it without a meeting.">
          <Field label="Short description" required><Textarea rows={3} value={f.description} onChange={(e) => set('description', e.target.value)} placeholder="What does it do, in plain words?" /></Field>
          <Field label="Problem being addressed" required><Textarea rows={3} value={f.problem} onChange={(e) => set('problem', e.target.value)} placeholder="What’s slow, painful or missing today?" /></Field>
          <Field label="Proposed solution" required><Textarea rows={3} value={f.solution} onChange={(e) => set('solution', e.target.value)} placeholder="How could AI help?" /></Field>
          <Field label="Expected outcome"><Textarea rows={2} value={f.benefits} onChange={(e) => set('benefits', e.target.value)} placeholder="What gets better if this works?" /></Field>
        </Section>

        <Section n={3} title="Tools & links" description="All optional — add what you have now, more later.">
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="AI tools / technologies" hint="Comma separated, e.g. Claude, Whisper, React"><Input value={f.technologies} onChange={(e) => set('technologies', e.target.value)} /></Field>
            <Field label="Keywords" hint="Comma separated, helps people find it"><Input value={f.tags} onChange={(e) => set('tags', e.target.value)} /></Field>
          </div>
          {!id && (
            <div className="grid gap-5 sm:grid-cols-3">
              <Field label="Confluence link"><Input value={f.confluence} onChange={(e) => set('confluence', e.target.value)} placeholder="https://" /></Field>
              <Field label="Prototype link"><Input value={f.prototype} onChange={(e) => set('prototype', e.target.value)} placeholder="https://" /></Field>
              <Field label="Project link"><Input value={f.live} onChange={(e) => set('live', e.target.value)} placeholder="https://" /></Field>
            </div>
          )}
          {!id && <p className="text-muted-foreground -mt-2 text-xs">More links — Figma, GitHub, demos, screenshots, meeting notes — can be added from the project’s Resources tab.</p>}
          <Field label="Additional notes"><Textarea rows={2} value={f.notes} onChange={(e) => set('notes', e.target.value)} /></Field>
        </Section>

        <Section n={4} title="Who can see it" description="Published projects are visible to every signed-in employee.">
          <div className="grid gap-3 sm:grid-cols-2">
            {([['published', Globe, 'All employees', 'Recommended. Anyone at AnywhereWorks can find and learn from it.'], ['restricted', Lock, 'Team only', 'Only the owner, contributors, admins and people you add.']] as const).map(([k, I, t, d]) => (
              <button type="button" key={k} onClick={() => set('access', k)}
                className={cn('flex cursor-pointer gap-3 rounded-xl border p-4 text-left transition', f.access === k ? 'border-foreground ring-foreground/10 ring-4' : 'hover:border-foreground/30')}>
                <I className="mt-0.5 size-5 shrink-0" />
                <span><span className="block font-medium">{t}</span><span className="text-muted-foreground text-sm">{d}</span></span>
              </button>
            ))}
          </div>
          {f.access === 'restricted' && (
            <Field label="Also share with"><PeoplePicker value={f.allowedIds} onChange={(v) => set('allowedIds', v)} placeholder="Add people who may view it" /></Field>
          )}
        </Section>

        <div className="bg-background/90 sticky bottom-0 z-10 -mx-4 flex flex-col-reverse gap-2 border-t px-4 py-4 backdrop-blur sm:mx-0 sm:flex-row sm:items-center sm:justify-end sm:rounded-2xl sm:border sm:px-5">
          <span className="text-muted-foreground mr-auto hidden text-xs sm:block">
            {missing.length && f.name.trim() ? `To publish, add: ${missing.join(', ')}` : 'Fields marked * are needed to publish.'}
          </span>
          {(!existing || existing.visibility === 'draft') && (
            <Button type="button" variant="outline" size="lg" onClick={() => submit(true)} disabled={!f.name.trim()}><FilePen />Save as draft</Button>
          )}
          <Button type="submit" size="lg" disabled={missing.length > 0} className="bg-gold hover:bg-gold text-[#111] hover:brightness-95">
            <Megaphone />{existing && existing.visibility !== 'draft' ? 'Save changes' : 'Publish project'}
          </Button>
        </div>
      </form>
    </div>
  );
}
