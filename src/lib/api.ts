/**
 * One set of actions, two back ends. Demo mode runs the rules in src/lib/server.ts
 * against this browser's sample data; live mode calls the matching database functions
 * in supabase/migrations, which enforce the same rules for everyone.
 */
import { createClient } from '@supabase/supabase-js';
import * as server from './server';
import type { AccessRole, Db, Person, Project, Resource, StageKey, Status } from './types';

export const LIVE = !!import.meta.env.VITE_SUPABASE_URL;

export const supabase = LIVE
  ? createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY, {
      auth: { flowType: 'pkce', detectSessionInUrl: true, persistSession: true },
    })
  : null;

export interface ProfileInput { title?: string; departmentId?: string; bio?: string; interests?: string[] }

export interface Api {
  load(): Promise<Db>;
  saveProject(input: server.ProjectInput, id?: string): Promise<string>;
  setJourneyNote(projectId: string, stage: StageKey, note: string): Promise<void>;
  setStatus(projectId: string, status: Status): Promise<void>;
  publish(projectId: string): Promise<void>;
  deleteProject(projectId: string): Promise<void>;
  toggleFeatured(projectId: string): Promise<void>;
  saveResource(projectId: string, input: server.ResourceInput, id?: string): Promise<void>;
  deleteResource(projectId: string, id: string): Promise<void>;
  addUpdate(projectId: string, title: string, body: string): Promise<void>;
  addComment(projectId: string, body: string): Promise<void>;
  deleteComment(projectId: string, id: string): Promise<void>;
  setAccess(personId: string, role: AccessRole): Promise<void>;
  setActive(personId: string, active: boolean): Promise<void>;
  addDepartment(name: string, description: string): Promise<void>;
  updateProfile(input: ProfileInput): Promise<void>;
}

// ---------- demo: sample data in this browser ----------

export function demoApi(meId: () => string): Api {
  const run = async <T>(fn: (db: Db, me: Person) => T): Promise<T> => {
    const db = server.load();
    const me = db.people.find((p) => p.id === meId()) ?? db.people[0];
    return fn(db, me);
  };
  return {
    load: async () => server.load(),
    saveProject: (input, id) => run((db, m) => server.saveProject(db, m, input, id).id),
    setJourneyNote: (pid, stage, note) => run((db, m) => server.setJourneyNote(db, m, pid, stage, note)),
    setStatus: (pid, s) => run((db, m) => server.setStatus(db, m, pid, s)),
    publish: (pid) => run((db, m) => server.publish(db, m, pid)),
    deleteProject: (pid) => run((db, m) => server.deleteProject(db, m, pid)),
    toggleFeatured: (pid) => run((db, m) => server.toggleFeatured(db, m, pid)),
    saveResource: (pid, input, id) => run((db, m) => server.saveResource(db, m, pid, input, id)),
    deleteResource: (pid, id) => run((db, m) => server.deleteResource(db, m, pid, id)),
    addUpdate: (pid, t, b) => run((db, m) => server.addUpdate(db, m, pid, t, b)),
    addComment: (pid, b) => run((db, m) => server.addComment(db, m, pid, b)),
    deleteComment: (pid, id) => run((db, m) => server.deleteComment(db, m, pid, id)),
    setAccess: (id, role) => run((db, m) => server.setAccess(db, m, id, role)),
    setActive: (id, a) => run((db, m) => server.setActive(db, m, id, a)),
    addDepartment: (n, d) => run((db, m) => server.addDepartment(db, m, n, d)),
    updateProfile: (input) => run((db, m) => server.updateProfile(db, m, input)),
  };
}

// ---------- live: the shared database ----------

type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

const toPerson = (r: Row): Person => ({
  id: r.id, name: r.name, email: r.email, title: r.title, departmentId: r.department_id ?? '',
  bio: r.bio, interests: r.interests, accessRole: r.access_role, active: r.active,
});

const toProject = (r: Row): Project => ({
  id: r.id, name: r.name, tagline: r.tagline, description: r.description, problem: r.problem,
  solution: r.solution, benefits: r.benefits, ownerId: r.owner_id, contributorIds: r.contributor_ids,
  departmentId: r.department_id, status: r.status, visibility: r.visibility, allowedIds: r.allowed_ids,
  technologies: r.technologies, tags: r.tags, featured: r.featured, proposedAt: r.proposed_at,
  createdAt: r.created_at, updatedAt: r.updated_at, journey: r.journey, notes: r.notes,
});

const toResource = (r: Row): Resource => ({
  id: r.id, projectId: r.project_id, title: r.title, type: r.type, description: r.description,
  url: r.url, addedBy: r.added_by, addedAt: r.added_at,
});

async function rpc<T = void>(fn: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase!.rpc(fn, args);
  if (error) throw new Error(error.message || 'Something went wrong. Please try again.');
  return data as T;
}

async function rows(table: string, order: string, limit = 5000): Promise<Row[]> {
  const { data, error } = await supabase!.from(table).select('*').order(order, { ascending: false }).limit(limit);
  if (error) throw new Error(error.message);
  return data ?? [];
}

export const liveApi: Api = {
  async load() {
    const [departments, people, projects, resources, updates, comments, activity] = await Promise.all([
      rows('departments', 'name'), rows('people', 'name'), rows('projects', 'updated_at'), rows('resources', 'added_at'),
      rows('updates', 'date'), rows('comments', 'date'), rows('activity', 'date', 2000),
    ]);
    return {
      version: 0,
      departments: departments.map((r) => ({ id: r.id, name: r.name, description: r.description, hue: r.hue })).sort((a, b) => a.name.localeCompare(b.name)),
      people: people.map(toPerson).sort((a, b) => a.name.localeCompare(b.name)),
      projects: projects.map(toProject),
      resources: resources.map(toResource),
      updates: updates.map((r) => ({ id: r.id, projectId: r.project_id, authorId: r.author_id, date: r.date, title: r.title, body: r.body })),
      comments: comments.map((r) => ({ id: r.id, projectId: r.project_id, authorId: r.author_id, date: r.date, body: r.body })),
      activity: activity.map((r) => ({ id: r.id, projectId: r.project_id, actorId: r.actor_id, date: r.date, action: r.action })),
    };
  },
  saveProject: (input, id) => rpc<string>('save_project', { p_input: input, p_id: id ?? null }),
  setJourneyNote: (pid, stage, note) => rpc('set_journey_note', { p_id: pid, p_stage: stage, p_note: note }),
  setStatus: (pid, s) => rpc('set_status', { p_id: pid, p_status: s }),
  publish: (pid) => rpc('publish_project', { p_id: pid }),
  deleteProject: (pid) => rpc('delete_project', { p_id: pid }),
  toggleFeatured: (pid) => rpc('toggle_featured', { p_id: pid }),
  saveResource: (pid, input, id) => rpc('save_resource', { p_project: pid, p_input: input, p_id: id ?? null }),
  deleteResource: (pid, id) => rpc('delete_resource', { p_project: pid, p_id: id }),
  addUpdate: (pid, t, b) => rpc('add_update', { p_project: pid, p_title: t, p_body: b }),
  addComment: (pid, b) => rpc('add_comment', { p_project: pid, p_body: b }),
  deleteComment: (pid, id) => rpc('delete_comment', { p_project: pid, p_id: id }),
  setAccess: (id, role) => rpc('set_access', { p_person: id, p_role: role }),
  setActive: (id, a) => rpc('set_active', { p_person: id, p_active: a }),
  addDepartment: (n, d) => rpc('add_department', { p_name: n, p_description: d }),
  updateProfile: (input) => rpc('update_profile', { p_input: input }),
};

/** The signed-in person's own profile, even if deactivated (so the app can say why). */
export async function whoami(): Promise<Person | null> {
  const r = await rpc<Row | null>('whoami', {});
  return r ? toPerson(r) : null;
}
