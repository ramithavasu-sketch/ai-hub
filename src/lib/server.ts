/**
 * The "server" for development mode. Every function takes the acting person and
 * enforces permissions here, not in the UI, so the same rules can move to a real
 * backend (database row-level security) later. Data lives in this browser only.
 */
import { buildSeed, DB_VERSION } from './seed';
import type { AccessRole, Db, FeedbackRating, FeedbackStatus, Person, Project, Resource, Status, StageKey, Visibility } from './types';
import { stageIndex, STAGES } from './meta';

const KEY = 'aihub.db';

export class Forbidden extends Error {}
export class Invalid extends Error {}

export function load(): Db {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const db = JSON.parse(raw) as Db;
      if (db.version === DB_VERSION) return db;
    }
  } catch { /* fall through to a fresh seed */ }
  const db = buildSeed();
  save(db);
  return db;
}

export function save(db: Db) {
  try { localStorage.setItem(KEY, JSON.stringify(db)); } catch { /* storage full or blocked */ }
}

export function reset(): Db {
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
  return load();
}

const now = () => new Date().toISOString();
const uid = (p: string) => `${p}-${Math.random().toString(36).slice(2, 9)}`;

// ---------- permissions ----------

export const isAdmin = (actor: Person) => actor.accessRole === 'admin';

export const isMember = (actor: Person, p: Project) =>
  p.ownerId === actor.id || p.contributorIds.includes(actor.id);

export function canView(actor: Person, p: Project) {
  if (isAdmin(actor) || isMember(actor, p)) return true;
  if (p.visibility === 'draft') return false;
  if (p.visibility === 'restricted') return p.allowedIds.includes(actor.id);
  return true;
}

export const canEdit = (actor: Person, p: Project) =>
  isAdmin(actor) || (actor.accessRole !== 'viewer' && isMember(actor, p)) || p.ownerId === actor.id;

export const canCreate = (actor: Person) => actor.accessRole !== 'viewer';

function must(ok: boolean, msg = 'You do not have permission to do that.') {
  if (!ok) throw new Forbidden(msg);
}

function getProject(db: Db, actor: Person, id: string) {
  const p = db.projects.find((x) => x.id === id);
  if (!p || !canView(actor, p)) throw new Forbidden('Project not found or not shared with you.');
  return p;
}

// ---------- reads (always filtered by permission) ----------

export const visibleProjects = (db: Db, actor: Person) => db.projects.filter((p) => canView(actor, p));

export function projectBundle(db: Db, actor: Person, id: string) {
  const p = db.projects.find((x) => x.id === id);
  if (!p || !canView(actor, p)) return null;
  const byDate = <T extends { date?: string; addedAt?: string }>(a: T, b: T) =>
    (b.date ?? b.addedAt ?? '').localeCompare(a.date ?? a.addedAt ?? '');
  return {
    project: p,
    resources: db.resources.filter((r) => r.projectId === id).sort(byDate),
    updates: db.updates.filter((u) => u.projectId === id).sort(byDate),
    comments: db.comments.filter((c) => c.projectId === id).sort((a, b) => a.date.localeCompare(b.date)),
    activity: db.activity.filter((a) => a.projectId === id).sort(byDate),
  };
}

/** Resources across every project the actor can see. */
export const visibleResources = (db: Db, actor: Person) => {
  const ids = new Set(visibleProjects(db, actor).map((p) => p.id));
  return db.resources.filter((r) => ids.has(r.projectId));
};

// ---------- validation ----------

// A regex rather than new URL(): Google Apps Script has no URL class.
export const validUrl = (url: string) => /^https?:\/\/[^\s/?#]+\S*$/i.test(url.trim());

function clean(s: unknown, max = 4000) {
  return String(s ?? '').trim().slice(0, max);
}

// ---------- writes ----------

function log(db: Db, projectId: string, actorId: string, action: string) {
  db.activity.push({ id: uid('a'), projectId, actorId, date: now(), action });
}

function touch(p: Project) { p.updatedAt = now(); }

export interface ProjectInput {
  name: string;
  tagline: string;
  description: string;
  problem: string;
  solution: string;
  benefits: string;
  ownerId: string;
  contributorIds: string[];
  departmentId: string;
  status: Status;
  technologies: string[];
  tags: string[];
  notes: string;
  visibility: Visibility;
  allowedIds: string[];
}

export function saveProject(db: Db, actor: Person, input: ProjectInput, id?: string): Project {
  const draft = input.visibility === 'draft';
  const name = clean(input.name, 120);
  if (!name) throw new Invalid('Give the project a name.');
  if (!draft) {
    for (const [k, label] of [['description', 'a short description'], ['problem', 'the problem being addressed'], ['solution', 'the proposed solution']] as const)
      if (!clean(input[k])) throw new Invalid(`Add ${label}, or save as a draft for now.`);
    if (!input.departmentId) throw new Invalid('Choose a department.');
  }
  if (!db.people.some((x) => x.id === input.ownerId)) throw new Invalid('Choose a project owner.');

  const fields = {
    name,
    tagline: clean(input.tagline, 140),
    description: clean(input.description),
    problem: clean(input.problem),
    solution: clean(input.solution),
    benefits: clean(input.benefits),
    departmentId: input.departmentId || db.departments[0].id,
    status: input.status,
    technologies: [...new Set(input.technologies.map((t) => clean(t, 40)).filter(Boolean))],
    tags: [...new Set(input.tags.map((t) => clean(t, 40).toLowerCase()).filter(Boolean))],
    notes: clean(input.notes),
    visibility: input.visibility,
    allowedIds: input.allowedIds.filter((x) => db.people.some((p) => p.id === x)),
  };

  if (id) {
    const p = getProject(db, actor, id);
    must(canEdit(actor, p));
    // Only the owner or an admin can hand the project to someone else.
    if (input.ownerId !== p.ownerId) must(isAdmin(actor) || p.ownerId === actor.id, 'Only the owner or an admin can change the owner.');
    const statusChanged = p.status !== input.status;
    Object.assign(p, fields, {
      ownerId: input.ownerId,
      contributorIds: [...new Set(input.contributorIds)].filter((x) => x !== input.ownerId),
    });
    if (statusChanged) recordStage(p, input.status);
    touch(p);
    log(db, p.id, actor.id, statusChanged ? `moved the project to “${statusLabel(input.status)}”` : 'edited project details');
    save(db);
    return p;
  }

  must(canCreate(actor), 'Viewers cannot create projects. Ask an admin for contributor access.');
  // Non-admins always own what they create.
  const ownerId = isAdmin(actor) ? input.ownerId : actor.id;
  const p: Project = {
    id: uid('p'), ...fields, ownerId,
    contributorIds: [...new Set(input.contributorIds)].filter((x) => x !== ownerId),
    featured: false, proposedAt: now(), createdAt: now(), updatedAt: now(), journey: {},
  };
  p.journey.idea = { note: 'Idea proposed', date: now() };
  recordStage(p, p.status);
  db.projects.push(p);
  log(db, p.id, actor.id, draft ? 'started a draft' : 'created the project');
  save(db);
  return p;
}

const statusLabel = (s: Status) => s.replace('_', ' ');

/** When status moves forward, stamp the matching journey stage if it is empty. */
function recordStage(p: Project, status: Status) {
  const i = Math.min(stageIndex(status), STAGES.length - 1);
  if (i < 0) return;
  const key = STAGES[i].key;
  if (!p.journey[key]) p.journey[key] = { note: '', date: now() };
}

export function setJourneyNote(db: Db, actor: Person, projectId: string, stage: StageKey, note: string) {
  const p = getProject(db, actor, projectId);
  must(canEdit(actor, p));
  p.journey[stage] = { note: clean(note, 600), date: p.journey[stage]?.date ?? now() };
  touch(p);
  log(db, p.id, actor.id, `updated the journey: ${STAGES.find((s) => s.key === stage)?.label}`);
  save(db);
}

export function setStatus(db: Db, actor: Person, projectId: string, status: Status) {
  const p = getProject(db, actor, projectId);
  must(canEdit(actor, p));
  p.status = status;
  recordStage(p, status);
  touch(p);
  log(db, p.id, actor.id, `moved the project to “${statusLabel(status)}”`);
  save(db);
}

export function publish(db: Db, actor: Person, projectId: string) {
  const p = getProject(db, actor, projectId);
  must(canEdit(actor, p));
  for (const k of ['description', 'problem', 'solution'] as const)
    if (!p[k]) throw new Invalid('Fill in the description, problem and solution before publishing.');
  p.visibility = 'published';
  touch(p);
  log(db, p.id, actor.id, 'published the project');
  save(db);
}

export function deleteProject(db: Db, actor: Person, projectId: string) {
  const p = getProject(db, actor, projectId);
  // Published work is archived, not deleted; only drafts can be removed by their owner.
  must(isAdmin(actor) || (p.ownerId === actor.id && p.visibility === 'draft'), 'Only drafts can be deleted. Archive published projects instead.');
  db.projects = db.projects.filter((x) => x.id !== projectId);
  for (const k of ['resources', 'updates', 'comments', 'activity'] as const)
    (db[k] as { projectId: string }[]) = (db[k] as { projectId: string }[]).filter((x) => x.projectId !== projectId);
  save(db);
}

export function toggleFeatured(db: Db, actor: Person, projectId: string) {
  must(isAdmin(actor), 'Only admins can feature projects.');
  const p = getProject(db, actor, projectId);
  p.featured = !p.featured;
  save(db);
}

// Resources

export interface ResourceInput { title: string; type: Resource['type']; description: string; url: string }

export function saveResource(db: Db, actor: Person, projectId: string, input: ResourceInput, id?: string) {
  const p = getProject(db, actor, projectId);
  must(canEdit(actor, p), 'Only the owner and contributors can manage resources.');
  const title = clean(input.title, 120);
  if (!title) throw new Invalid('Give the resource a title.');
  if (!validUrl(input.url)) throw new Invalid('Enter a full link that starts with https://');
  const fields = { title, type: input.type, description: clean(input.description, 300), url: input.url.trim() };
  if (id) {
    const r = db.resources.find((x) => x.id === id && x.projectId === projectId);
    if (!r) throw new Invalid('Resource not found.');
    Object.assign(r, fields);
    log(db, projectId, actor.id, `edited a resource: ${title}`);
  } else {
    db.resources.push({ id: uid('r'), projectId, addedBy: actor.id, addedAt: now(), ...fields });
    log(db, projectId, actor.id, `added a resource: ${title}`);
  }
  touch(p);
  save(db);
}

export function deleteResource(db: Db, actor: Person, projectId: string, id: string) {
  const p = getProject(db, actor, projectId);
  must(canEdit(actor, p));
  const r = db.resources.find((x) => x.id === id && x.projectId === projectId);
  if (!r) return;
  db.resources = db.resources.filter((x) => x !== r);
  log(db, projectId, actor.id, `removed a resource: ${r.title}`);
  touch(p);
  save(db);
}

// Updates & comments

export function addUpdate(db: Db, actor: Person, projectId: string, title: string, body: string) {
  const p = getProject(db, actor, projectId);
  must(canEdit(actor, p), 'Only the owner and contributors can post updates.');
  if (!clean(title)) throw new Invalid('Give the update a short title.');
  db.updates.push({ id: uid('up'), projectId, authorId: actor.id, date: now(), title: clean(title, 140), body: clean(body, 2000) });
  log(db, projectId, actor.id, `posted an update: ${clean(title, 140)}`);
  touch(p);
  save(db);
}

export function addComment(db: Db, actor: Person, projectId: string, body: string) {
  getProject(db, actor, projectId); // anyone who can see the project may comment
  if (!clean(body)) throw new Invalid('Write something first.');
  db.comments.push({ id: uid('c'), projectId, authorId: actor.id, date: now(), body: clean(body, 2000) });
  save(db);
}

export function deleteComment(db: Db, actor: Person, projectId: string, id: string) {
  const c = db.comments.find((x) => x.id === id && x.projectId === projectId);
  if (!c) return;
  must(c.authorId === actor.id || isAdmin(actor));
  db.comments = db.comments.filter((x) => x !== c);
  save(db);
}

// Admin

export function setAccess(db: Db, actor: Person, personId: string, role: AccessRole) {
  must(isAdmin(actor), 'Only admins can change access.');
  if (personId === actor.id && role !== 'admin') throw new Invalid('You cannot remove your own admin access.');
  const p = db.people.find((x) => x.id === personId);
  if (p) p.accessRole = role;
  save(db);
}

export function setActive(db: Db, actor: Person, personId: string, active: boolean) {
  must(isAdmin(actor), 'Only admins can change access.');
  if (personId === actor.id) throw new Invalid('You cannot deactivate yourself.');
  const p = db.people.find((x) => x.id === personId);
  if (p) p.active = active;
  save(db);
}

export function addDepartment(db: Db, actor: Person, name: string, description: string) {
  must(isAdmin(actor), 'Only admins can manage departments.');
  const n = clean(name, 60);
  if (!n) throw new Invalid('Name the department.');
  if (db.departments.some((d) => d.name.toLowerCase() === n.toLowerCase())) throw new Invalid('That department already exists.');
  db.departments.push({ id: uid('d'), name: n, description: clean(description, 200), hue: Math.floor(Math.random() * 360) });
  save(db);
}

/** Longest profile picture accepted (the page shrinks photos to about 10 KB first). */
export const MAX_PHOTO_CHARS = 45000;

export function updateProfile(db: Db, actor: Person, input: { name?: string; title?: string; departmentId?: string; bio?: string; interests?: string[]; photo?: string }) {
  const me = db.people.find((x) => x.id === actor.id);
  if (!me) return;
  if (input.name !== undefined) {
    if (!clean(input.name, 80)) throw new Invalid('Add your name.');
    me.name = clean(input.name, 80);
  }
  if (input.departmentId !== undefined) {
    if (!db.departments.some((d) => d.id === input.departmentId)) throw new Invalid('Choose your department.');
    me.departmentId = input.departmentId;
  }
  if (input.title !== undefined) me.title = clean(input.title, 80);
  if (input.bio !== undefined) me.bio = clean(input.bio, 600);
  if (input.interests !== undefined) me.interests = [...new Set(input.interests.map((s) => clean(s, 40)).filter(Boolean))].slice(0, 8);
  if (input.photo !== undefined) {
    const photo = String(input.photo);
    if (photo && (!/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(photo) || photo.length > MAX_PHOTO_CHARS)) throw new Invalid('That picture couldn’t be used. Try a JPG or PNG photo.');
    me.photo = photo;
  }
  save(db);
}

// ---------- feedback ----------

export const FEEDBACK_PER_DAY = 20;

/** Anyone signed in may send feedback about the page they're on. */
export function submitFeedback(db: Db, actor: Person, input: { page: string; path: string; rating: FeedbackRating; message: string; imageUrl?: string }) {
  if (input.rating !== 'works_well' && input.rating !== 'could_be_better') throw new Invalid('Choose “Works well” or “Could be better”.');
  const message = clean(input.message, 2000);
  if (input.rating === 'could_be_better' && !message) throw new Invalid('Tell us what could be better.');
  const imageUrl = String(input.imageUrl ?? '').trim();
  const okImage = !imageUrl
    || (/^https:\/\/(drive|docs)\.google\.com\/\S+$/.test(imageUrl) && imageUrl.length <= 500)
    || (/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(imageUrl) && imageUrl.length <= MAX_PHOTO_CHARS);
  if (!okImage) throw new Invalid('That image couldn’t be attached. Try again or send without it.');
  const dayAgo = new Date(Date.now() - 86_400_000).toISOString();
  if (db.feedback.filter((f) => f.authorId === actor.id && f.date > dayAgo).length >= FEEDBACK_PER_DAY)
    throw new Invalid('Thanks for all the feedback! You can send more tomorrow.');
  db.feedback.push({
    id: uid('f'), authorId: actor.id, date: now(), page: clean(input.page, 120) || 'AI Hub',
    path: /^\/[\w\-/?=&%.]*$/.test(String(input.path)) ? clean(input.path, 200) : '/',
    rating: input.rating, message, status: 'new', imageUrl,
  });
  save(db);
}

export function setFeedbackStatus(db: Db, actor: Person, id: string, status: FeedbackStatus) {
  must(isAdmin(actor), 'Only admins can track feedback.');
  if (!['new', 'in_progress', 'done'].includes(status)) throw new Invalid('Choose a status.');
  const f = db.feedback.find((x) => x.id === id);
  if (!f) throw new Invalid('That feedback was not found.');
  f.status = status;
  save(db);
}

// ---------- reading a project document ----------

/** Form fields a project document can fill in. */
export type DocField = 'name' | 'tagline' | 'description' | 'problem' | 'solution' | 'benefits' | 'technologies' | 'tags' | 'notes';

// Headings people commonly use for each field, matched after numbering, bullets,
// markdown marks and a trailing colon are stripped.
const DOC_HEADINGS: [DocField, RegExp][] = [
  ['name', /^(project (name|title)|name|title)$/],
  ['tagline', /^(one[ -]?line(r| summary)?|tagline|summary|elevator pitch)$/],
  ['description', /^((short |project )?description|overview|about( the project)?|what (it|this) (does|is)|introduction)$/],
  ['problem', /^((the )?problem( statement| being addressed| to solve)?|challenges?|pain points?|current (situation|state|process)|background)$/],
  ['solution', /^((the )?(proposed )?solution|approach|how it works|(the )?idea|proposal)$/],
  ['benefits', /^(expected (outcomes?|results|benefits|impact)|outcomes?|benefits|impact|value|results|success (metrics|measures|criteria))$/],
  ['technologies', /^((ai )?tools( used)?|(ai )?technolog(y|ies)( used)?|tech(nology)? stack|stack)$/],
  ['tags', /^(keywords|tags)$/],
  ['notes', /^((additional )?notes|next steps|comments|other information)$/],
];

const LIMITS: Partial<Record<DocField, number>> = { name: 120, tagline: 140 };

function headingField(label: string): DocField | null {
  const key = label.toLowerCase()
    .replace(/[*_#>`]/g, '')
    .replace(/^\s*([-•●▪◦]|\(?\d+[.)]|[a-z][.)])\s+/, '')
    .replace(/[:：]\s*$/, '')
    .replace(/\s+/g, ' ')
    .trim();
  return DOC_HEADINGS.find(([, re]) => re.test(key))?.[0] ?? null;
}

/**
 * Pull project fields out of a document's plain text by looking for headings such as
 * "Problem" or "Proposed solution:". Lines before the first heading give the name
 * (first short line) and, if there is no description heading, the description.
 */
export function fieldsFromText(text: string): { fields: Partial<Record<DocField, string>>; found: DocField[] } {
  const parts: Partial<Record<DocField, string[]>> = {};
  const intro: string[] = [];
  let current: DocField | null = null;
  for (const raw of String(text ?? '').replace(/\r\n?/g, '\n').replace(/\v/g, '\n').split('\n')) {
    const line = raw.trim();
    const whole = line.length <= 60 ? headingField(line) : null;
    const inline = !whole && line.match(/^([^:：]{1,40})[:：]\s*(.+)$/);
    const inlineField = inline ? headingField(inline[1]) : null;
    if (whole || inlineField) {
      current = (whole || inlineField)!;
      parts[current] ??= [];
      if (inlineField && inline) parts[current]!.push(inline[2].trim());
    } else if (current) parts[current]!.push(line);
    else intro.push(line);
  }

  const tidy = (lines: string[]) => lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
  const fields: Partial<Record<DocField, string>> = {};
  for (const [k, lines] of Object.entries(parts) as [DocField, string[]][]) {
    let v = k === 'technologies' || k === 'tags'
      ? lines.map((l) => l.replace(/^([-•●▪◦*]|\d+[.)])\s*/, '').trim()).filter(Boolean).join(', ')
      : tidy(lines);
    if (k === 'name' || k === 'tagline') v = v.split('\n')[0];
    if (v) fields[k] = clean(v, LIMITS[k]);
  }

  const introText = tidy(intro);
  if (!fields.name && introText) {
    const first = introText.split('\n')[0].replace(/^#+\s*/, '').trim();
    if (first.length <= 100) {
      fields.name = clean(first, 120);
      intro.splice(0, intro.findIndex((l) => l.trim()) + 1);
    }
  }
  const rest = tidy(intro);
  if (!fields.description && rest) fields.description = clean(rest, 2000);
  return { fields, found: Object.keys(fields) as DocField[] };
}

/** Best resource type for an uploaded file. */
export function resourceTypeFor(fileName: string, mimeType: string): Resource['type'] {
  if (mimeType.startsWith('image/')) return 'screenshot';
  if (mimeType.startsWith('video/')) return 'video';
  if (/presentation|powerpoint|keynote/.test(mimeType) || /\.(pptx?|key|odp)$/i.test(fileName)) return 'slides';
  return 'file';
}
