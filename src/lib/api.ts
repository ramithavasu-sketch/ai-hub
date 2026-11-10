/**
 * One set of actions, two back ends. Demo mode runs the rules in src/lib/server.ts
 * against this browser's sample data; live mode (the Google Apps Script web app) sends
 * each action to gas/Code.js, which runs the same rules on the server against the
 * shared Google Sheet.
 */
import * as server from './server';
import type { AccessRole, Db, FeedbackRating, FeedbackStatus, Person, StageKey, Status } from './types';

export const LIVE = import.meta.env.VITE_BACKEND === 'gas';
export const MAX_UPLOAD_MB = 50; // attachments
export const MAX_READ_MB = 20; // documents read to fill the form
const CHUNK = 4 * 1024 * 1024; // upload piece size; Drive needs a multiple of 256 KB

export interface UploadedFile { name: string; url: string; mimeType: string }
export type DocReading = ReturnType<typeof server.fieldsFromText>;

export interface ProfileInput { name?: string; title?: string; departmentId?: string; bio?: string; interests?: string[]; photo?: string }

export interface FeedbackInput { page: string; path: string; rating: FeedbackRating; message: string; imageUrl?: string }
export const MAX_FEEDBACK_IMAGE_MB = 10;

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
  submitFeedback(input: FeedbackInput): Promise<void>;
  /** Store an image for feedback and return its link. */
  attachFeedbackImage(file: File): Promise<string>;
  setFeedbackStatus(id: string, status: FeedbackStatus): Promise<void>;
  /** Save a file and return a link to it (live: the AI Hub's Google Drive folder). */
  uploadFile(file: File, onProgress?: (fraction: number) => void): Promise<UploadedFile>;
  /** Read a project document and return the form fields it fills. */
  readDocument(file: File): Promise<DocReading>;
}

function checkSize(file: File, maxMb: number) {
  if (file.size > maxMb * 1024 * 1024) throw new server.Invalid(`${file.name} is too big. Files can be up to ${maxMb} MB.`);
}

function checkImage(file: File) {
  if (!/^image\/(jpeg|png|webp|gif)$/.test(file.type)) throw new server.Invalid('Attach a picture (JPG, PNG, WebP or GIF).');
  checkSize(file, MAX_FEEDBACK_IMAGE_MB);
}

/** Draw an image no wider or taller than maxPx and return the largest JPEG data URL under maxChars. */
export async function shrinkImage(file: File, maxPx: number, maxChars: number): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new server.Invalid('We couldn’t open that picture. Try a JPG or PNG.'));
      i.src = url;
    });
    for (const px of [maxPx, Math.round(maxPx * 0.7), Math.round(maxPx * 0.5)]) {
      const scale = Math.min(1, px / Math.max(img.naturalWidth, img.naturalHeight));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
      const ctx = canvas.getContext('2d')!;
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      for (const q of [0.8, 0.6, 0.45]) {
        const data = canvas.toDataURL('image/jpeg', q);
        if (data.length <= maxChars) return data;
      }
    }
    throw new server.Invalid('That picture is too detailed to attach here. Try a smaller one.');
  } finally {
    URL.revokeObjectURL(url);
  }
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
    submitFeedback: (input) => run((db, m) => server.submitFeedback(db, m, input)),
    // No Google Drive in the demo: keep a shrunken copy in this browser instead.
    attachFeedbackImage: (file) => { checkImage(file); return shrinkImage(file, 1000, server.MAX_PHOTO_CHARS); },
    setFeedbackStatus: (id, st) => run((db, m) => server.setFeedbackStatus(db, m, id, st)),
    // The demo has no Google Drive, so only plain-text documents can be read here.
    uploadFile: async () => { throw new server.Invalid('Uploading files works on the live AI Hub. In this demo, add a link instead.'); },
    readDocument: async (file) => {
      checkSize(file, MAX_READ_MB);
      if (!/^text\//.test(file.type) && !/\.(txt|md)$/i.test(file.name))
        throw new server.Invalid('This demo can only read .txt files. Word and PDF files work on the live AI Hub.');
      return server.fieldsFromText(await file.text());
    },
  };
}

// ---------- live: Google Apps Script ----------

interface Reply { result: unknown; me: Person; data: Db | null; appUrl: string }

type ServerFns = {
  api(name: string, args: unknown[]): void;
  startUpload(name: string, mimeType: string, size: number, purpose?: string): void;
  uploadChunk(session: string, start: number, size: number, data: string, purpose?: string): void;
  readDocument(file: FileArg): void;
};
interface FileArg { name: string; mimeType: string; data: string }

declare const google: {
  script: { run: { withSuccessHandler(f: (r: unknown) => void): { withFailureHandler(f: (e: Error) => void): ServerFns } } };
};

/** Run a function in gas/Code.js. */
function runServer<T>(pick: (fns: ServerFns) => void): Promise<T> {
  return new Promise((resolve, reject) =>
    pick(google.script.run
      .withSuccessHandler((r) => resolve(r as T))
      .withFailureHandler((e) => {
        const message = String(e?.message || 'Something went wrong. Please try again.').replace(/^(Exception|Error):\s*/, '');
        // The page is older than the server (the AI Hub was updated while this tab was open).
        reject(new Error(/script function not found/i.test(message) ? 'The AI Hub was just updated. Refresh the page and try again.' : message));
      })),
  );
}

const call = (name: string, args: unknown[] = []) => runServer<Reply>((fns) => fns.api(name, args));

/** Files travel to Apps Script as base64 text. */
async function base64(blob: Blob, name: string): Promise<string> {
  const url = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error(`We couldn’t open ${name}.`));
    reader.readAsDataURL(blob);
  });
  return url.slice(url.indexOf(',') + 1);
}

/** Upload in pieces straight into the AI Hub's Drive folder (see startUpload in Code.js). */
async function uploadInPieces(file: File, onProgress?: (fraction: number) => void, purpose?: 'feedback'): Promise<UploadedFile> {
  checkSize(file, MAX_UPLOAD_MB);
  if (!file.size) throw new server.Invalid(`${file.name} is empty.`);
  const type = file.type || 'application/octet-stream';
  const session = await runServer<string>((fns) => fns.startUpload(file.name, type, file.size, purpose));
  for (let start = 0; start < file.size; start += CHUNK) {
    const data = await base64(file.slice(start, start + CHUNK), file.name);
    const done = await runServer<UploadedFile | null>((fns) => fns.uploadChunk(session, start, file.size, data, purpose));
    onProgress?.(Math.min(1, (start + CHUNK) / file.size));
    if (done) return done;
  }
  throw new Error('The upload didn’t finish. Please try again.');
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
  submitFeedback: (input) => send('submitFeedback', input),
  attachFeedbackImage: async (file) => { checkImage(file); return (await uploadInPieces(file, undefined, 'feedback')).url; },
  setFeedbackStatus: (id, st) => send('setFeedbackStatus', id, st),
  uploadFile: (file, onProgress) => uploadInPieces(file, onProgress),
  readDocument: async (file) => {
    checkSize(file, MAX_READ_MB);
    const f: FileArg = { name: file.name, mimeType: file.type || 'application/octet-stream', data: await base64(file, file.name) };
    return runServer<DocReading>((fns) => fns.readDocument(f));
  },
};
