// Entry point for the Apps Script build: the same rules the demo uses, bundled into
// gas/rules.js as one global (AIHub) that gas/Code.js calls on the server.
export {
  canView, saveProject, setJourneyNote, setStatus, publish, deleteProject, toggleFeatured,
  saveResource, deleteResource, addUpdate, addComment, deleteComment, setAccess, setActive,
  addDepartment, updateProfile,
} from './lib/server';
