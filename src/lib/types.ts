export type AccessRole = 'admin' | 'contributor' | 'viewer';

export type Status =
  | 'idea'
  | 'discussion'
  | 'research'
  | 'prototype'
  | 'in_progress'
  | 'testing'
  | 'completed'
  | 'on_hold'
  | 'archived';

export type Visibility = 'published' | 'draft' | 'restricted';

export type ResourceType =
  | 'confluence'
  | 'figma'
  | 'prototype'
  | 'github'
  | 'live'
  | 'drive'
  | 'slides'
  | 'video'
  | 'screenshot'
  | 'file'
  | 'notes'
  | 'other';

export type StageKey = 'idea' | 'research' | 'prototype' | 'testing' | 'launch';

export interface Department {
  id: string;
  name: string;
  description: string;
  hue: number;
}

export interface Person {
  id: string;
  name: string;
  email: string;
  title: string;
  departmentId: string;
  bio: string;
  interests: string[];
  accessRole: AccessRole;
  active: boolean;
  /** Profile picture as a small JPEG data URL, or empty for initials. */
  photo?: string;
}

export interface Project {
  id: string;
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
  visibility: Visibility;
  /** Extra people who may see a restricted project. */
  allowedIds: string[];
  technologies: string[];
  tags: string[];
  featured: boolean;
  proposedAt: string;
  createdAt: string;
  updatedAt: string;
  journey: Partial<Record<StageKey, { note: string; date: string }>>;
  notes: string;
}

export interface Resource {
  id: string;
  projectId: string;
  title: string;
  type: ResourceType;
  description: string;
  url: string;
  addedBy: string;
  addedAt: string;
}

export interface Update {
  id: string;
  projectId: string;
  authorId: string;
  date: string;
  title: string;
  body: string;
}

export interface Comment {
  id: string;
  projectId: string;
  authorId: string;
  date: string;
  body: string;
}

export interface Activity {
  id: string;
  projectId: string;
  actorId: string;
  date: string;
  action: string;
}

export type FeedbackRating = 'works_well' | 'could_be_better';
export type FeedbackStatus = 'new' | 'in_progress' | 'done';

/** Feedback someone sent about a page of the AI Hub. Admins see all of it; others only their own. */
export interface Feedback {
  id: string;
  authorId: string;
  date: string;
  /** Readable page name, e.g. "Project: Call Evaluator". */
  page: string;
  /** In-app route, so admins can open the same page. */
  path: string;
  rating: FeedbackRating;
  message: string;
  status: FeedbackStatus;
  /** Optional image: a Google Drive link (live) or a small data URL (demo). */
  imageUrl?: string;
}

export interface Db {
  version: number;
  departments: Department[];
  people: Person[];
  projects: Project[];
  resources: Resource[];
  updates: Update[];
  comments: Comment[];
  activity: Activity[];
  feedback: Feedback[];
}
