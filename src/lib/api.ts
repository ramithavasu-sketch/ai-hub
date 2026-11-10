/**
 * One set of actions, two back ends. Demo mode runs the rules in src/lib/server.ts
 * against this browser's sample data; live mode (the Google Apps Script web app) sends
 * each action to gas/Code.js, which runs the same rules on the server against the
 * shared Google Sheet.
 */
import * as server from './server';
import type { AccessRole, Db, Person, StageKey, Status } from './types';

export const LIVE = import.meta.env.VITE_BACKEND === 'gas';
export const MAX_UPLOAD_MB = 20;

export interface UploadedFile { name: string; url: string; mimeType: string }
export type DocReading = ReturnType<typeof server.fieldsFromText>;

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
  /** Save a file and return a link to it (live: the AI Hub's Google Drive folder). */
  uploadFile(file: File): Promise<UploadedFile>;
  /** Read a project document and return the form fields it fills. */
  readDocument(file: File): Promise<DocReading>;
}

function checkSize(file: File) {
  if (file.size > MAX_UPLOAD_MB * 1024 * 1024) throw new server.Invalid(`${file.name} is too big. Files can be up to ${MAX_UPLOAD_MB} MB.`);
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
    // The demo has no Google Drive, so only plain-text documents can be read here.
    uploadFile: async () => { throw new server.Invalid('Uploading files works on the live AI Hub. In this demo, add a link instead.'); },
    readDocument: async (file) => {
      checkSize(file);
      if (!/^text\//.test(file.type) && !/\.(txt|md)$/i.test(file.name))
        throw new server.Invalid('This demo can only read .txt files. Word and PDF files work on the live AI Hub.');
      return server.fieldsFromText(await file.text());
    },
  };
}

// ---------- live: Google Apps Script ----------

interface Reply { result: unknown; me: Person; data: Db | null; appUrl: string }

type ServerFns = { api(name: string, args: unknown[]): void; uploadFile(file: FileArg): void; readDocument(file: FileArg): void };
interface FileArg { name: string; mimeType: string; data: string }

declare const google: {
  script: { run: { withSuccessHandler(f: (r: unknown) => void): { withFailureHandler(f: (e: Error) => void): ServerFns } } };
};

/** Run a function in gas/Code.js. */
function runServer<T>(pick: (fns: ServerFns) => void): Promise<T> {
  return new Promise((resolve, reject) =>
    pick(google.script.run
      .withSuccessHandler((r) => resolve(r as T))
      .withFailureHandler((e) => reject(new Error(String(e?.message || 'Something went wrong. Please try again.').replace(/^(Exception|Error):\s*/, ''))))),
  );
}

const call = (name: string, args: unknown[] = []) => runServer<Reply>((fns) => fns.api(name, args));

/** Files travel to Apps Script as base64 text. */
async function fileArg(file: File): Promise<FileArg> {
  checkSize(file);
  const url = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error(`We couldn’t open ${file.name}.`));
    reader.readAsDataURL(file);
  });
  return { name: file.name, mimeType: file.type || 'application/octet-stream', data: url.slice(url.indexOf(',') + 1) };
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
  uploadFile: async (file) => { const f = await fileArg(file); return runServer<UploadedFile>((fns) => fns.uploadFile(f)); },
  readDocument: async (file) => { const f = await fileArg(file); return runServer<DocReading>((fns) => fns.readDocument(f)); },
};
