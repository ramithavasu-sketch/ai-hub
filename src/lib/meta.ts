import type { ResourceType, StageKey, Status } from './types';

export const STATUSES: { key: Status; label: string; tone: string; dot: string }[] = [
  { key: 'idea', label: 'Idea Proposed', tone: 'bg-gold/20 text-gold-ink', dot: 'bg-gold' },
  { key: 'discussion', label: 'Under Discussion', tone: 'bg-blue/10 text-blue', dot: 'bg-blue/60' },
  { key: 'research', label: 'Research / Exploration', tone: 'bg-violet/10 text-violet', dot: 'bg-violet' },
  { key: 'prototype', label: 'Prototype Development', tone: 'bg-teal/10 text-teal', dot: 'bg-teal' },
  { key: 'in_progress', label: 'In Progress', tone: 'bg-blue/12 text-blue', dot: 'bg-blue' },
  { key: 'testing', label: 'Testing', tone: 'bg-warning/15 text-warning', dot: 'bg-warning' },
  { key: 'completed', label: 'Completed', tone: 'bg-success/12 text-success', dot: 'bg-success' },
  { key: 'on_hold', label: 'On Hold', tone: 'bg-muted text-muted-foreground', dot: 'bg-muted-foreground/60' },
  { key: 'archived', label: 'Archived', tone: 'bg-muted text-muted-foreground/80', dot: 'bg-muted-foreground/40' },
];

export const statusMeta = (s: Status) => STATUSES.find((x) => x.key === s) ?? STATUSES[0];

export const ACTIVE_STATUSES: Status[] = ['discussion', 'research', 'prototype', 'in_progress', 'testing'];

export const STAGES: { key: StageKey; label: string; hint: string }[] = [
  { key: 'idea', label: 'Idea Proposed', hint: 'Initial concept and problem identified' },
  { key: 'research', label: 'Research & Discussion', hint: 'Documentation and meeting notes added' },
  { key: 'prototype', label: 'Prototype Created', hint: 'Prototype and demo links available' },
  { key: 'testing', label: 'Testing', hint: 'Feedback, observations and improvements' },
  { key: 'launch', label: 'Final Implementation', hint: 'Final project link and outcome' },
];

/** How far along the journey a status sits (index of the current stage). */
export function stageIndex(s: Status): number {
  switch (s) {
    case 'idea': return 0;
    case 'discussion':
    case 'research': return 1;
    case 'prototype': return 2;
    case 'in_progress':
    case 'testing': return 3;
    case 'completed': return 5;
    default: return -1;
  }
}

export const RESOURCE_TYPES: { key: ResourceType; label: string }[] = [
  { key: 'confluence', label: 'Confluence' },
  { key: 'figma', label: 'Figma design' },
  { key: 'prototype', label: 'Prototype' },
  { key: 'github', label: 'GitHub repo' },
  { key: 'live', label: 'Live project' },
  { key: 'drive', label: 'Google Drive' },
  { key: 'slides', label: 'Presentation' },
  { key: 'video', label: 'Demo video' },
  { key: 'screenshot', label: 'Screenshots' },
  { key: 'file', label: 'Supporting file' },
  { key: 'notes', label: 'Meeting notes' },
  { key: 'other', label: 'Other' },
];

export const resourceLabel = (t: ResourceType) => RESOURCE_TYPES.find((x) => x.key === t)?.label ?? 'Link';
