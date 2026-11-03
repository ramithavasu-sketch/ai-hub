import { useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import {
  ArrowUpRight, BookOpen, Building2, ChartLine, CirclePlay, CodeXml, FileText, FolderOpen, GitBranch, Globe,
  Handshake, Headphones, Image, Link2, Lock, Megaphone, MousePointerClick, NotebookPen, PenTool, Presentation,
  Sparkles, Star, Users, FilePen, Check, Copy,
  BadgeCheck,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Link } from '@/lib/router';
import { useLookup } from '@/lib/store';
import { hueOf, initials, timeAgo } from '@/lib/format';
import { STAGES, resourceLabel, stageIndex, statusMeta } from '@/lib/meta';
import type { Person, Project, Resource, ResourceType, Status } from '@/lib/types';

// ---------- people ----------

export function PersonAvatar({ person, name, className }: { person?: Person; name?: string; className?: string }) {
  const n = person?.name ?? name ?? '?';
  const h = hueOf(n);
  return (
    <span
      className={cn('inline-flex size-9 shrink-0 select-none items-center justify-center rounded-full text-xs font-semibold ring-2 ring-card', className)}
      style={{ background: `oklch(0.9 0.06 ${h})`, color: `oklch(0.32 0.09 ${h})` }}
      title={n}
    >
      {initials(n)}
    </span>
  );
}

export function AvatarStack({ ids, max = 4, size = 'size-7' }: { ids: string[]; max?: number; size?: string }) {
  const { person } = useLookup();
  const shown = ids.slice(0, max);
  return (
    <div className="flex -space-x-2">
      {shown.map((id) => <PersonAvatar key={id} person={person(id)} className={cn(size, 'text-[10px]')} />)}
      {ids.length > max && (
        <span className={cn(size, 'bg-secondary text-muted-foreground ring-card inline-flex items-center justify-center rounded-full text-[10px] font-semibold ring-2')}>
          +{ids.length - max}
        </span>
      )}
    </div>
  );
}

/** Shows a work email to copy. Email links don't open reliably inside the artifact frame. */
export function EmailPopover({ name, email, children }: { name: string; email: string; children: ReactNode }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(email).then(
      () => { setCopied(true); toast.success(`Copied ${email}`); setTimeout(() => setCopied(false), 1500); },
      () => toast.message('Select the address to copy it.'),
    );
  };
  return (
    <Popover>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent align="end" className="w-72 rounded-xl">
        <div className="text-muted-foreground text-xs">Email {name}</div>
        <div className="mt-2 flex items-center gap-2">
          <span className="bg-secondary min-w-0 flex-1 truncate rounded-md px-2.5 py-1.5 font-mono text-xs select-all">{email}</span>
          <button onClick={copy} className="bg-foreground text-background inline-flex shrink-0 cursor-pointer items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-medium">
            {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}{copied ? 'Copied' : 'Copy'}
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ---------- status ----------

export function StatusBadge({ status, className }: { status: Status; className?: string }) {
  const m = statusMeta(status);
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium whitespace-nowrap', m.tone, className)}>
      <span className={cn('size-1.5 rounded-full', m.dot)} />
      {m.label}
    </span>
  );
}

export function VisibilityBadge({ project }: { project: Project }) {
  if (project.visibility === 'draft')
    return <span className="bg-secondary text-muted-foreground inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium"><FilePen className="size-3" />Draft</span>;
  if (project.visibility === 'restricted')
    return <span className="bg-secondary text-muted-foreground inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium"><Lock className="size-3" />Restricted</span>;
  return null;
}

// ---------- project visuals ----------

const DEPT_ICONS: Record<string, typeof Sparkles> = {
  'd-cs': Headphones, 'd-eng': CodeXml, 'd-design': PenTool, 'd-mkt': Megaphone,
  'd-sales': Handshake, 'd-people': Users, 'd-ops': ChartLine, 'd-qa': BadgeCheck,
};

export function DeptIcon({ id, className }: { id: string; className?: string }) {
  const I = DEPT_ICONS[id] ?? Building2;
  return <I className={className} />;
}

export function ProjectGlyph({ project, className }: { project: Project; className?: string }) {
  const { dept } = useLookup();
  const h = dept(project.departmentId)?.hue ?? hueOf(project.id);
  const I = DEPT_ICONS[project.departmentId] ?? Sparkles;
  return (
    <span
      className={cn('inline-flex size-11 shrink-0 items-center justify-center rounded-xl', className)}
      style={{ background: `linear-gradient(140deg, oklch(0.93 0.06 ${h}), oklch(0.85 0.09 ${(h + 40) % 360}))`, color: `oklch(0.3 0.1 ${h})` }}
    >
      <I className="size-5" />
    </span>
  );
}

export function JourneyMeter({ status }: { status: Status }) {
  const i = stageIndex(status);
  return (
    <div className="flex gap-1" aria-label={`Journey: ${i < 0 ? 'paused' : `${Math.min(i + 1, 5)} of 5`}`}>
      {STAGES.map((s, k) => (
        <span key={s.key} className={cn('h-1 flex-1 rounded-full',
          i < 0 ? 'bg-muted' : k < i || i === 5 ? 'bg-foreground/80' : k === i ? 'bg-gold' : 'bg-muted')} />
      ))}
    </div>
  );
}

export function ProjectCard({ project, className }: { project: Project; className?: string }) {
  const { person, dept } = useLookup();
  const owner = person(project.ownerId);
  return (
    <Link to={`/projects/${project.id}`} className={cn('panel lift group flex flex-col gap-4 p-5 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50', className)}>
      <div className="flex items-start justify-between gap-3">
        <ProjectGlyph project={project} />
        <div className="flex flex-wrap items-center justify-end gap-1.5">
          {project.featured && <Star className="fill-gold text-gold size-4" aria-label="Featured" />}
          <VisibilityBadge project={project} />
          <StatusBadge status={project.status} />
        </div>
      </div>
      <div className="min-w-0 flex-1">
        <h3 className="display text-[1.3rem] leading-snug">{project.name}</h3>
        <p className="text-muted-foreground mt-1.5 line-clamp-2 text-sm">{project.tagline || project.description}</p>
      </div>
      <JourneyMeter status={project.status} />
      <div className="flex items-center justify-between gap-3 text-xs">
        <div className="flex min-w-0 items-center gap-2">
          <PersonAvatar person={owner} className="size-6 text-[10px]" />
          <span className="truncate font-medium">{owner?.name}</span>
          <span className="text-muted-foreground hidden truncate sm:inline">· {dept(project.departmentId)?.name}</span>
        </div>
        <span className="text-muted-foreground shrink-0">{timeAgo(project.updatedAt)}</span>
      </div>
    </Link>
  );
}

export function ProjectRow({ project }: { project: Project }) {
  const { person, dept } = useLookup();
  return (
    <Link to={`/projects/${project.id}`} className="hover:bg-accent/60 group grid grid-cols-[auto_1fr_auto] items-center gap-4 px-5 py-4 outline-none focus-visible:bg-accent md:grid-cols-[auto_1fr_10rem_11rem_6rem]">
      <ProjectGlyph project={project} className="size-10" />
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="truncate font-medium">{project.name}</span>
          <VisibilityBadge project={project} />
        </div>
        <div className="text-muted-foreground truncate text-sm">{project.tagline}</div>
      </div>
      <div className="hidden items-center gap-2 text-sm md:flex">
        <PersonAvatar person={person(project.ownerId)} className="size-6 text-[10px]" />
        <span className="truncate">{person(project.ownerId)?.name}</span>
      </div>
      <div className="hidden md:block"><StatusBadge status={project.status} /></div>
      <div className="text-muted-foreground text-right text-xs">
        <span className="md:hidden"><StatusBadge status={project.status} /></span>
        <span className="hidden md:inline">{timeAgo(project.updatedAt)}</span>
        <div className="hidden truncate md:block">{dept(project.departmentId)?.name.split(' ')[0]}</div>
      </div>
    </Link>
  );
}

// ---------- contributors ----------

export function PersonCard({ person, projects }: { person: Person; projects: Project[] }) {
  const { dept } = useLookup();
  const mine = projects.filter((p) => p.ownerId === person.id || p.contributorIds.includes(person.id));
  const active = mine.filter((p) => !['completed', 'archived', 'on_hold'].includes(p.status));
  const h = hueOf(person.name);
  return (
    <Link to={`/people/${person.id}`} className="panel lift group flex flex-col overflow-hidden outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50">
      <div className="h-16" style={{ background: `linear-gradient(120deg, oklch(0.93 0.05 ${h}), oklch(0.96 0.03 ${(h + 60) % 360}))` }} />
      <div className="-mt-9 flex flex-1 flex-col items-center px-5 pb-5 text-center">
        <PersonAvatar person={person} className="size-[4.5rem] text-lg ring-4" />
        <div className="mt-3 font-semibold">{person.name}</div>
        <div className="text-muted-foreground text-sm">{person.title}</div>
        <div className="text-muted-foreground mt-1 inline-flex items-center gap-1 text-xs">
          <DeptIcon id={person.departmentId} className="size-3" />{dept(person.departmentId)?.name}
        </div>
        <div className="mt-3 flex flex-wrap justify-center gap-1">
          {person.interests.slice(0, 3).map((t) => <Chip key={t}>{t}</Chip>)}
        </div>
        <div className="mt-auto grid w-full grid-cols-2 divide-x border-t pt-3 mt-4 text-sm">
          <div><div className="display text-xl">{mine.length}</div><div className="text-muted-foreground text-xs">projects</div></div>
          <div><div className="display text-xl">{active.length}</div><div className="text-muted-foreground text-xs">active now</div></div>
        </div>
      </div>
    </Link>
  );
}

// ---------- resources ----------

const RESOURCE_ICONS: Record<ResourceType, typeof Link2> = {
  confluence: BookOpen, figma: PenTool, prototype: MousePointerClick, github: GitBranch, live: Globe,
  drive: FolderOpen, slides: Presentation, video: CirclePlay, screenshot: Image, file: FileText,
  notes: NotebookPen, other: Link2,
};
const RESOURCE_HUES: Record<ResourceType, number> = {
  confluence: 250, figma: 330, prototype: 175, github: 280, live: 150, drive: 95,
  slides: 55, video: 25, screenshot: 200, file: 230, notes: 75, other: 260,
};

export function ResourceIcon({ type, className }: { type: ResourceType; className?: string }) {
  const I = RESOURCE_ICONS[type];
  const h = RESOURCE_HUES[type];
  return (
    <span className={cn('inline-flex size-10 shrink-0 items-center justify-center rounded-lg', className)}
      style={{ background: `oklch(0.95 0.035 ${h})`, color: `oklch(0.45 0.13 ${h})` }}>
      <I className="size-[18px]" />
    </span>
  );
}

export function ResourceCard({ resource, project, actions }: { resource: Resource; project?: Project; actions?: ReactNode }) {
  const { person } = useLookup();
  let host = '';
  try { host = new URL(resource.url).hostname.replace(/^www\./, ''); } catch { /* keep blank */ }
  return (
    <div className="panel lift group relative flex gap-3 p-4">
      <ResourceIcon type={resource.type} />
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <a href={resource.url} target="_blank" rel="noopener noreferrer" className="font-medium leading-snug outline-none after:absolute after:inset-0 after:rounded-2xl focus-visible:underline">
            {resource.title}
          </a>
          <ArrowUpRight className="text-muted-foreground size-4 shrink-0 transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
        </div>
        {resource.description && <p className="text-muted-foreground mt-0.5 line-clamp-2 text-sm">{resource.description}</p>}
        <div className="text-muted-foreground mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
          <span className="text-foreground/80 font-medium">{resourceLabel(resource.type)}</span>
          {host && <span>· {host}</span>}
          <span>· {person(resource.addedBy)?.name.split(' ')[0]} {timeAgo(resource.addedAt)}</span>
          {project && <Link to={`/projects/${project.id}`} className="relative z-10 underline-offset-2 hover:underline">· {project.name}</Link>}
        </div>
      </div>
      {actions && <div className="relative z-10 flex items-start gap-1">{actions}</div>}
    </div>
  );
}

// ---------- layout bits ----------

export function Chip({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cn('bg-secondary text-secondary-foreground inline-flex items-center rounded-full px-2.5 py-0.5 text-xs', className)}>{children}</span>;
}

export function PageHeader({ eyebrow, title, description, actions }: { eyebrow?: string; title: ReactNode; description?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow && <div className="eyebrow mb-2">{eyebrow}</div>}
        <h1 className="display text-4xl leading-tight sm:text-[2.75rem]">{title}</h1>
        {description && <p className="text-muted-foreground mt-2 max-w-2xl">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function SectionTitle({ title, action, className }: { title: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cn('mb-4 flex items-end justify-between gap-3', className)}>
      <h2 className="display text-2xl">{title}</h2>
      {action}
    </div>
  );
}

export function EmptyState({ icon: I = Sparkles, title, children, action }: { icon?: typeof Sparkles; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-dashed px-6 py-14 text-center">
      <span className="bg-gold/25 text-gold-ink mb-4 inline-flex size-12 items-center justify-center rounded-full"><I className="size-5" /></span>
      <div className="display text-xl">{title}</div>
      {children && <p className="text-muted-foreground mt-1 max-w-sm text-sm">{children}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Journey({ project, onEdit }: { project: Project; onEdit?: (key: (typeof STAGES)[number]['key']) => void }) {
  const cur = stageIndex(project.status);
  return (
    <ol className="relative">
      {STAGES.map((s, i) => {
        const entry = project.journey[s.key];
        const done = cur > i || (cur === 5);
        const current = cur === i;
        return (
          <li key={s.key} className="relative flex gap-4 pb-6 last:pb-0">
            {i < STAGES.length - 1 && <span className={cn('absolute top-8 left-[15px] h-[calc(100%-2rem)] w-px', done ? 'bg-foreground/70' : 'bg-border')} />}
            <span className={cn('relative z-10 inline-flex size-8 shrink-0 items-center justify-center rounded-full border text-xs font-semibold',
              done ? 'bg-foreground text-background border-foreground' : current ? 'bg-gold border-gold text-[#111] shadow-[0_0_0_5px_color-mix(in_oklch,var(--gold)_25%,transparent)]' : 'bg-card text-muted-foreground')}>
              {done ? <Check className="size-4" /> : i + 1}
            </span>
            <div className="min-w-0 flex-1 pt-1">
              <div className="flex flex-wrap items-center gap-x-2">
                <span className={cn('font-medium', !done && !current && 'text-muted-foreground')}>{s.label}</span>
                {current && <span className="text-gold-ink text-[11px] font-semibold tracking-wider uppercase">Current</span>}
                {entry?.date && (done || current) && <span className="text-muted-foreground text-xs">{new Date(entry.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>}
              </div>
              <p className="text-muted-foreground mt-0.5 text-sm">{entry?.note || s.hint}</p>
              {onEdit && (done || current) && (
                <button onClick={() => onEdit(s.key)} className="text-muted-foreground hover:text-foreground mt-1 cursor-pointer text-xs underline-offset-2 hover:underline">
                  {entry?.note ? 'Edit note' : 'Add note'}
                </button>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
