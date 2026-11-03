/**
 * One set of actions, two back ends. Demo mode runs the rules in src/lib/server.ts
 * against this browser's sample data; live mode (the Google Apps Script web app) sends
 * each action to gas/Code.js, which runs the same rules on the server against the
 * shared Google Sheet.
 */
import * as server from './server';
import type { AccessRole, Db, Person, StageKey, Status } from './types';

export const LIVE = import.meta.env.VITE_BACKEND === 'gas';

export interface ProfileInput { name?: string; title?: string; departmentId?: string; bio?: string; interests?: string[] }

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

// ---------- live: Google Apps Script ----------

interface Reply { result: unknown; me: Person; data: Db | null; appUrl: string }

declare const google: {
  script: { run: { withSuccessHandler(f: (r: Reply) => void): { withFailureHandler(f: (e: Error) => void): { api(name: string, args: unknown[]): void } } } };
};

function call(name: string, args: unknown[] = []): Promise<Reply> {
  return new Promise((resolve, reject) =>
    google.script.run
      .withSuccessHandler(resolve)
      .withFailureHandler((e) => reject(new Error(String(e?.message || 'Something went wrong. Please try again.').replace(/^(Exception|Error):\s*/, ''))))
      .api(name, args),
  );
}

// Every reply carries fresh data, so the reload that follows an action can reuse it
// instead of making a second trip to the server.
let latest: Reply | null = null;
const send = async <T>(name: string, ...args: unknown[]) => {
  latest = await call(name, args);
  return latest.result as T;
};

/** Who is signed in (joining on first visit), plus everything they may see. */
export async function boot(): Promise<Reply> {
  latest = await call('load');
  return latest;
}

/** Google account links for the profile menu. Both come back to the AI Hub afterwards. */
export function accountLinks(appUrl: string) {
  // Without the app's address, Google's own pages still work; they just don't return here.
  if (!appUrl) return { switchAccount: 'https://accounts.google.com/AccountChooser', signOut: 'https://accounts.google.com/Logout' };
  const back = encodeURIComponent(appUrl);
  return {
    switchAccount: `https://accounts.google.com/AccountChooser?continue=${back}`,
    signOut: `https://www.google.com/accounts/Logout?continue=https://appengine.google.com/_ah/logout?continue=${back}`,
  };
}

export const liveApi: Api = {
  async load() {
    const r = latest ?? (await call('load'));
    latest = null;
    if (!r.data) throw new Error('Your access to the AI Hub is turned off.');
    return r.data;
  },
  saveProject: (input, id) => send<string>('saveProject', input, id ?? null),
  setJourneyNote: (pid, stage, note) => send('setJourneyNote', pid, stage, note),
  setStatus: (pid, s) => send('setStatus', pid, s),
  publish: (pid) => send('publish', pid),
  deleteProject: (pid) => send('deleteProject', pid),
  toggleFeatured: (pid) => send('toggleFeatured', pid),
  saveResource: (pid, input, id) => send('saveResource', pid, input, id ?? null),
  deleteResource: (pid, id) => send('deleteResource', pid, id),
  addUpdate: (pid, t, b) => send('addUpdate', pid, t, b),
  addComment: (pid, b) => send('addComment', pid, b),
  deleteComment: (pid, id) => send('deleteComment', pid, id),
  setAccess: (id, role) => send('setAccess', id, role),
  setActive: (id, a) => send('setActive', id, a),
  addDepartment: (n, d) => send('addDepartment', n, d),
  updateProfile: (input) => send('updateProfile', input),
};
